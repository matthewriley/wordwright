# Wordwright

A lightweight markdown editor for macOS and Windows, built on Tauri v2
(Rust host) + React/TypeScript (Vite) for the frontend.

## Layout

- `src/` — the React frontend.
  - `src/editor/` — the ProseMirror-based editor: schema, markdown
    parser/serializer, plugins (input rules, keymap, tables, find/
    replace), toolbar, tab strip, and the modal/popover components
    (link insert, table grid picker, preferences, confirm-discard).
  - `src/editor/store.ts` — the app's state: a `TabManager` owning one
    `Document` per open tab, each with its own ProseMirror `EditorView`,
    undo history, and dirty-tracking. Exposed to components via
    `useSyncExternalStore`-based hooks.
  - `src/menu.ts` — builds the native OS menu bar via
    `@tauri-apps/api/menu`.
  - `src/keyboard-shortcuts.ts` — a Windows-only JS-level fallback for
    keyboard shortcuts. Tauri's native menu accelerator dispatch doesn't
    reliably fire on Windows while the WebView2 control has keyboard
    focus; this listener is what actually runs those shortcuts there.
    macOS's native accelerators work correctly and don't need it.
  - `src/file-operations.ts` — open/save/save-as, and the shared
    "load this path into a new tab" helper used by both the native file
    dialog and OS-triggered file opens.
  - `src/os-file-open.ts` — receives a file path the OS launched/handed
    the app (double-click, "Open With", or a second launch redirected
    to this instance).
- `src-tauri/` — the Rust host: window/menu setup, the single-instance
  plugin wiring, and the Windows DPI-awareness manifest
  (`windows-app-manifest.xml`, wired via a custom `build.rs`).
- `icons/` — the design source of truth for the app icon (SVGs,
  regeneration script, per-platform exports). `src-tauri/icons/` holds
  copies of the files Tauri's bundler actually consumes; regenerate from
  `icons/generate_icons.py` and re-copy rather than hand-editing the
  `src-tauri/icons/` copies directly.
- `scripts/apply-macos-document-icon.sh` — a required post-build step on
  macOS (`npm run build:macos-doc-icon`, run after `npm run tauri
  build`). Tauri's `fileAssociations` config has no icon field on either
  platform; on macOS specifically, Finder resolves a file's icon by which
  app *exports* its Uniform Type Identifier, not by which app is set as
  the default handler — this script patches the built `.app`'s
  `Info.plist` to export Wordwright's own UTI with its own icon, and
  re-signs the app afterward (required, since editing `Info.plist`
  post-bundle invalidates Tauri's own signature).

## Editor architecture notes

- The document model round-trips through `markdown-it` (parse) and a
  custom serializer (`src/editor/markdown-serializer.ts`) — semantic/
  idempotent round-tripping is the goal, not byte-for-byte preservation
  of a hand-written file's original formatting.
- Undo/Redo and Select All route through ProseMirror's own commands
  (`prosemirror-history`, `prosemirror-commands`), bound both in the
  native menu and in ProseMirror's own keymap plugin directly — not
  through the webview's native undo manager, which is a separate history
  stack that can desync from ProseMirror's.
- Each tab's `EditorView` is mounted once and hidden via CSS when its tab
  isn't active (rather than tearing down/rebuilding on switch), which is
  what makes per-tab undo history, scroll position, and Source-view state
  persist across tab switches for free.

## Conventions

- No comments explaining *what* code does — only *why*, for non-obvious
  constraints (a platform quirk, a workaround, an invariant that would
  surprise a reader).
- Prefer reusing an existing pattern (a hook, a store shape, a modal
  controller) over inventing a new one for a similar need — search for
  one before adding new state-management machinery.

## Commands

```bash
npm run dev            # Vite dev server only (no Tauri window)
npm run tauri dev       # full app, hot-reloading
npm run build           # typecheck + Vite production build
npm run tauri build     # native app bundle
npm run test            # Vitest
npx tsc --noEmit        # typecheck only
```
