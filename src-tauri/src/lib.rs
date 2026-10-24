use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
use tauri::RunEvent;

// Paths from an OS file-open that arrived before the frontend was ready to
// listen (see queue_open below) — drained once via the take_pending_files
// command on startup, so nothing queued during Rust-side startup is lost
// waiting for a JS event listener to attach.
struct PendingOpens(Mutex<Vec<String>>);

// Fed from three places: a second-instance launch's argv (single_instance
// plugin), this instance's own launch argv (.setup(), Windows/Linux), and
// RunEvent::Opened (macOS, both its first launch and any later opens while
// running — see the .run() closure below for why). Always pushes to the
// pending queue (covers the startup race) and best-effort emits a live
// event (covers a later open while the frontend is already listening);
// also brings the window to front, which is the actual "single instance"
// behavor from the user's perspective.
fn queue_open<R: Runtime>(app: &AppHandle<R>, path: String) {
    if let Some(state) = app.try_state::<PendingOpens>() {
        state.0.lock().unwrap().push(path.clone());
    }
    let _ = app.emit("open-file", path);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn take_pending_files(state: State<PendingOpens>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // First plugin registered, per its own docs — it needs to detect
        // and redirect a second launch before any other plugin's setup
        // work runs in that (about to exit) second process.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            for path in argv.into_iter().skip(1) {
                queue_open(app, path);
            }
        }))
        .manage(PendingOpens(Mutex::new(Vec::new())))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        // Update flow is driven entirely from the frontend (src/updater.ts);
        // process is only registered for relaunch() after an install.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![take_pending_files])
        .setup(|app| {
            // This instance's own launch args — covers Windows/Linux
            // opening a file for the first time (macOS delivers that via
            // RunEvent::Opened instead, handled below). Runs before the
            // webview loads any frontend content, so there's no race with
            // the frontend's own startup check.
            for path in std::env::args().skip(1) {
                if !path.starts_with('-') {
                    queue_open(app.handle(), path);
                }
            }

            // Disables WebView2's own reserved "browser accelerator keys"
            // (Ctrl+F/Ctrl+P/F5/etc.) so they can't trigger WebView2's own
            // browser-style UI (find-in-page, print, reload) inside what's
            // meant to be a native desktop app. Investigated as a fix for
            // Ctrl+W not closing tabs, but live diagnosis showed the real
            // cause is elsewhere (Tauri's own Windows accelerator dispatch
            // — see keyboard-shortcuts.ts on the frontend for the actual
            // fix); this setting is unrelated to that bug and kept only as
            // a reasonable defensive default. Tauri doesn't expose it
            // directly, so this drops to the raw WebView2 COM settings object
            // via the officially-supported with_webview() escape hatch — the
            // one exception to this project's "thin Rust host" rule, since
            // there's no other way to reach native host configuration
            // Tauri's own API doesn't cover.
            #[cfg(windows)]
            {
                use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
                use windows::core::Interface;

                let window = app.get_webview_window("main").expect("main window must exist");
                window.with_webview(|platform_webview| unsafe {
                    let Ok(core) = platform_webview.controller().CoreWebView2() else { return };
                    let Ok(settings) = core.Settings() else { return };
                    let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() else { return };
                    let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
                })?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // .run(context) is a shorthand for .build(context)?.run(|_, _| {}) — a
    // no-op event callback that silently drops RunEvent::Opened, the only
    // way macOS delivers an opened file (both on first launch and any
    // later open while already running; Windows/Linux never emit this,
    // relying on argv instead — see queue_open's other two call sites).
    app.run(move |_app_handle, _event| {
        // RunEvent::Opened only exists on macOS/iOS/Android (Windows/Linux
        // rely solely on argv instead — see queue_open's other two call
        // sites) — the variant itself doesn't compile on other platforms,
        // not just "never fires", so the whole match is cfg-gated.
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let RunEvent::Opened { urls } = _event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    queue_open(_app_handle, path.to_string_lossy().into_owned());
                }
            }
        }
    });
}
