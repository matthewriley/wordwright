import { platform } from "@tauri-apps/plugin-os";
import { tabManager } from "./editor/store";
import { openFindBar } from "./editor/FindBar";
import { openPreferences } from "./editor/PreferencesModal";
import { matchFormatShortcut } from "./editor/format-shortcuts";
import { runFormatAction } from "./editor/format-actions";
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
// native menu accelerators and already works correctly on Windows. Bold,
// italic and the link modal are in the same position (spec 008's `routed:
// "editor"` entries) — ProseMirror's keymap has Mod-b/Mod-i, and Editor.tsx
// intercepts Mod-k itself, so binding them here as well would run each
// command twice for one keystroke.
//
// macOS's native accelerators already fire correctly (confirmed across
// every milestone so far), so this stays off there to avoid double-firing
// the same action for one keystroke.
export function installKeyboardShortcuts(): () => void {
  if (platform() !== "windows") return () => {};

  function handleKeyDown(event: KeyboardEvent) {
    if (!event.ctrlKey) return;
    const key = event.key.toLowerCase();

    // Spec 008's formatting shortcuts, matched on event.code rather than
    // event.key: with Ctrl+Shift held, .key reports the shifted character
    // ("*" for Shift+8, ">" for Shift+.), which no longer names the key
    // that was bound.
    const formatAction = matchFormatShortcut(event);
    if (formatAction) {
      if (!canFormat()) return;
      event.preventDefault();
      runFormatAction(formatAction);
      return;
    }

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

// This listener is on `window`, not on the editor, so unlike the keymap
// it fires wherever focus happens to be. Formatting must not run in three
// situations the File shortcuts don't care about:
//
//   - a modal is open (Link…, Preferences, update, discard prompt): Ctrl+B
//     typed in the URL field would bold the document behind the dialog;
//   - focus is in a non-editor input/textarea (the find bar's query box, a
//     source-mode textarea) — same problem, and the find bar is not a
//     <dialog>, so it needs the target check;
//   - the tab is in source mode: the toolbar disables every formatting
//     button there, because the ProseMirror document behind the textarea is
//     replaced wholesale from the textarea on the way back out, so a
//     formatting transaction issued now would be silently discarded.
function canFormat(): boolean {
  const activeDocument = tabManager.activeDocument();
  if (!activeDocument || activeDocument.sourceMode) return false;
  if (document.querySelector("dialog[open]")) return false;

  const target = document.activeElement;
  if (target instanceof HTMLElement && !target.closest(".ProseMirror")) {
    if (target.closest("input, textarea, select, [contenteditable='true']")) return false;
  }
  return true;
}
