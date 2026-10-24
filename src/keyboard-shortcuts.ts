import { platform } from "@tauri-apps/plugin-os";
import { tabManager } from "./editor/store";
import { openFindBar } from "./editor/FindBar";
import { openPreferences } from "./editor/PreferencesModal";
import { newTab, openFile, requestCloseTab, saveFile, saveFileAs } from "./file-operations";

// Windows-only fallback for the File menu's own accelerators. Confirmed via
// live diagnosis that Tauri's native menu accelerator dispatch never fires
// on Windows while the WebView2 control has keyboard focus (effectively
// always, during normal editing) — Tauri wires an automatic Win32 msg_hook
// that calls TranslateAcceleratorW using whichever hwnd the current message
// targets, which is WebView2's own child window rather than the top-level
// app window that owns the accelerator table, so it never matches. The
// keystroke still reaches the page's JS via ordinary DOM dispatch (also
// confirmed live), which is what this listener relies on. The native menu
// items keep their accelerator labels for discoverability; this is what
// actually runs them on Windows.
//
// Edit menu's Undo/Redo/Select All need no equivalent here — those are
// already bound directly in ProseMirror's own keymap plugin (Mod-z/
// Shift-Mod-z in buildKeymap(), Mod-a via prosemirror-commands' baseKeymap),
// a DOM-level handler on the contentEditable region that's independent of
// native menu accelerators and already works correctly on Windows.
//
// macOS's native accelerators already fire correctly (confirmed across
// every milestone so far), so this stays off there to avoid double-firing
// the same action for one keystroke.
export function installKeyboardShortcuts(): () => void {
  if (platform() !== "windows") return () => {};

  function handleKeyDown(event: KeyboardEvent) {
    if (!event.ctrlKey) return;
    const key = event.key.toLowerCase();

    if (key === "n" && !event.shiftKey) {
      event.preventDefault();
      newTab();
    } else if (key === "o") {
      event.preventDefault();
      void openFile();
    } else if (key === "s" && event.shiftKey) {
      event.preventDefault();
      void saveFileAs(tabManager.activeDocument()!);
    } else if (key === "s") {
      event.preventDefault();
      void saveFile(tabManager.activeDocument()!);
    } else if (key === "w") {
      event.preventDefault();
      void requestCloseTab(tabManager.activeDocument()!.id);
    } else if (key === "f") {
      event.preventDefault();
      openFindBar();
    } else if (key === ",") {
      event.preventDefault();
      openPreferences();
    } else if (key === "/") {
      event.preventDefault();
      tabManager.activeDocument()?.toggleSourceMode();
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
