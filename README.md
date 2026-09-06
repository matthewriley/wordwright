# Wordwright

A lightweight, native markdown editor for macOS and Windows, built with
[Tauri](https://tauri.app), Rust, and React.

- Live formatting for headings, lists, and inline styles as you type
- Round-trip **Source** view — toggle to raw markdown and back losslessly
- GitHub-flavored markdown: tables (with a grid picker and context menu),
  task lists, strikethrough
- Multi-document tabs, each with its own undo history
- Find & replace, with match-case and live highlighting
- Light, dark, and system-following appearance, with a small set of accent
  colors
- Native menus, file associations, and single-instance handling on both
  platforms

## Requirements

- [Node.js](https://nodejs.org) 20+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Platform build tools: Xcode Command Line Tools on macOS, or the MSVC
  Build Tools + WebView2 runtime on Windows — see
  [Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/)

## Development

```bash
npm install
npm run tauri dev
```

## Building

```bash
npm run tauri build
```

Produces a native app bundle (`.app`/`.dmg` on macOS, `.msi`/`.exe`
installer on Windows) under `src-tauri/target/release/bundle/`.

## Tech stack

- **Editor**: [ProseMirror](https://prosemirror.net), with a custom
  `markdown-it`-backed parser/serializer for round-tripping GitHub-flavored
  markdown
- **Shell**: [Tauri v2](https://v2.tauri.app) (Rust host, native menus and
  window chrome, no Node/Electron runtime)
- **Frontend**: React + TypeScript + Vite

## License

[MIT](LICENSE)
