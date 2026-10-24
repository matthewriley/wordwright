import { Menu, Submenu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { undo, redo } from "prosemirror-history";
import { selectAll } from "prosemirror-commands";
import { run, tabManager } from "./editor/store";
import { openFindBar } from "./editor/FindBar";
import { openPreferences } from "./editor/PreferencesModal";
import { newTab, openFile, requestCloseTab, saveFile, saveFileAs } from "./file-operations";
import { checkForUpdates } from "./updater";

const APP_NAME = "Wordwright";
const ABOUT_METADATA = { name: APP_NAME, version: "1.0.0" };

// Built once on startup (App.tsx) via Menu.setAsAppMenu() — not
// setAsWindowMenu(), which is unsupported on macOS. Undo/Redo/Select All
// are plain MenuItems calling ProseMirror commands directly, NOT
// PredefinedMenuItem: those route to WKWebView's own native
// NSUndoManager-backed contenteditable undo stack, a completely separate
// history from prosemirror-history, and can desync or corrupt the
// document (confirmed via the actual muda macOS backend source). Cut/
// Copy/Paste are safe as PredefinedMenuItems — those route to the
// webview's native clipboard pipeline, the same path Cmd+C/X/V already
// use today.
export async function buildAppMenu(): Promise<void> {
  const isMacOS = platform() === "macos";

  // macOS reserves the first top-level submenu for the app itself: AppKit
  // always renders it with the running process's name, no matter what
  // `text` is set, so it must actually BE the app menu (About/Services/
  // Hide/Quit) rather than File — otherwise File's items end up trapped
  // under a menu labeled "Wordwright" (confirmed via live testing).
  const appMenu = isMacOS
    ? await Submenu.new({
        text: APP_NAME,
        items: [
          { item: { About: ABOUT_METADATA } },
          { item: "Separator" },
          { id: "check-for-updates", text: "Check for Updates…", action: () => void checkForUpdates(true) },
          { id: "preferences", text: "Preferences…", accelerator: "CmdOrCtrl+,", action: () => openPreferences() },
          { item: "Separator" },
          { item: "Services" },
          { item: "Separator" },
          { item: "Hide" },
          { item: "HideOthers" },
          { item: "ShowAll" },
          { item: "Separator" },
          // A plain MenuItem, not PredefinedMenuItem's "Quit": that routes
          // straight to NSApplication.terminate: and never emits the
          // window's closeRequested event, so it skipped our unsaved-
          // changes prompt entirely (confirmed via live testing). Routing
          // through the window's own close() reuses the exact same
          // dirty-check flow already wired in App.tsx's onCloseRequested.
          { id: "quit", text: `Quit ${APP_NAME}`, accelerator: "CmdOrCtrl+Q", action: () => void getCurrentWindow().close() },
        ],
      })
    : null;

  const fileMenu = await Submenu.new({
    text: "File",
    items: [
      { id: "new", text: "New", accelerator: "CmdOrCtrl+N", action: () => newTab() },
      { id: "open", text: "Open…", accelerator: "CmdOrCtrl+O", action: () => void openFile() },
      { id: "save", text: "Save", accelerator: "CmdOrCtrl+S", action: () => void saveFile(tabManager.activeDocument()!) },
      { id: "save-as", text: "Save As…", accelerator: "CmdOrCtrl+Shift+S", action: () => void saveFileAs(tabManager.activeDocument()!) },
      { item: "Separator" },
      // Closes the active TAB, not the window — Cmd+W is the conventional
      // "close this document" shortcut once tabs exist. Closing the last
      // tab still closes the window: requestCloseTab() itself calls
      // getCurrentWindow().close() when that empties the tab list.
      {
        id: "close-tab",
        text: "Close Tab",
        // Shown here for discoverability. On Windows this label is
        // documentation only — Tauri's native accelerator dispatch never
        // fires while WebView2 has keyboard focus, so keyboard-shortcuts.ts
        // is what actually executes it there. macOS fires it natively.
        accelerator: "CmdOrCtrl+W",
        action: () => void requestCloseTab(tabManager.activeDocument()!.id),
      },
    ],
  });

  const editMenu = await Submenu.new({
    text: "Edit",
    items: [
      { id: "undo", text: "Undo", accelerator: "CmdOrCtrl+Z", action: () => run(undo) },
      { id: "redo", text: "Redo", accelerator: "CmdOrCtrl+Shift+Z", action: () => run(redo) },
      { item: "Separator" },
      { item: "Cut" },
      { item: "Copy" },
      { item: "Paste" },
      { item: "Separator" },
      { id: "select-all", text: "Select All", accelerator: "CmdOrCtrl+A", action: () => run(selectAll) },
      { item: "Separator" },
      { id: "find", text: "Find…", accelerator: "CmdOrCtrl+F", action: () => openFindBar() },
    ],
  });

  const viewMenu = await Submenu.new({
    text: "View",
    // No app-level menu exists on Windows to host Preferences (unlike
    // macOS's app menu above), so it lives here instead — the closest
    // already-established generic menu. No native "Fullscreen" item:
    // redundant with the window's own chrome on both platforms (the
    // green traffic-light button on macOS, maximize on Windows, which
    // has no equivalent "fullscreen" convention at all for an app like
    // this one).
    items: isMacOS
      ? [{ id: "source", text: "Source", accelerator: "CmdOrCtrl+/", action: () => tabManager.activeDocument()?.toggleSourceMode() }]
      : [
          { id: "source", text: "Source", accelerator: "CmdOrCtrl+/", action: () => tabManager.activeDocument()?.toggleSourceMode() },
          { item: "Separator" },
          { id: "preferences", text: "Preferences…", accelerator: "CmdOrCtrl+,", action: () => openPreferences() },
        ],
  });

  // On macOS, About and Check for Updates… already live in the app menu
  // above (native convention) — an empty "Help" submenu is normal there,
  // since AppKit auto-injects its own search field into any submenu
  // titled exactly "Help".
  const helpMenu = await Submenu.new({
    text: "Help",
    items: isMacOS
      ? []
      : [
          { id: "check-for-updates", text: "Check for Updates…", action: () => void checkForUpdates(true) },
          { item: "Separator" },
          { item: { About: ABOUT_METADATA } },
        ],
  });

  const menu = await Menu.new({
    items: appMenu ? [appMenu, fileMenu, editMenu, viewMenu, helpMenu] : [fileMenu, editMenu, viewMenu, helpMenu],
  });
  await menu.setAsAppMenu();
}
