# Wordwright

A lightweight markdown editor for macOS and Windows.

Yes, this is yet another markdown editor. The world did not appear to be
short of them. But somewhere along the way they all started growing —
accounts, sync, plugins, dashboards, telemetry — and "opens a `.md`
file and lets you write" turned into a subscription tier. Wordwright
goes the other way: it opens your files, stays fast, and minds its own
business. That's the whole idea.

## Why you might like it

- **Quick to load.** No splash screen, no sign-in, no "getting things
  ready for you." It opens like a text editor should.
- **Small memory footprint.** A thin native shell around the system web
  view — it will never headline your task manager.
- **Simple features, focused on markdown authoring.** Formatting
  toolbar, tables, task lists, find & replace, tabs, a lossless
  source-view toggle, dark mode. That's the list, and it's short on
  purpose.
- **No usage analytics.** Nothing you type, open, or click is counted,
  logged, or sent anywhere.
- **No user metrics.** There is no dashboard with you in it. There
  isn't even a dashboard.
- **No ads.** It's a markdown editor, not a billboard.

The only network request Wordwright ever makes is checking GitHub for a
newer version, so it can offer to update itself.

## Download

Installers for macOS (Apple Silicon) and Windows (x64, ARM64) are on the
[Releases](https://github.com/matthewriley/wordwright/releases) page.
Updates are offered in-app and install in place — one prompt, not a
recurring nag. Each release also ships CycloneDX SBOMs alongside the
installers, for anyone who wants to audit exactly what's inside.

## Where this is going (and where it isn't)

Wordwright's mission is fixed: a small, fast, focused markdown editor.
It is not on a journey to become a notes platform, a team workspace, or
anything with the word "cloud" in the pitch. At some point it will
simply be **feature complete**, and from then on the only changes it
will take are security fixes and dependency updates. If you contribute,
please read [CONTRIBUTING.md](CONTRIBUTING.md) first — it's the same
mission statement, written for pull requests.

## Building from source

Requirements: [Node.js](https://nodejs.org) 20+, a stable
[Rust](https://www.rust-lang.org/tools/install) toolchain, and the
platform build tools from
[Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev      # run the app, hot-reloading
npm run tauri build    # produce a native installer/app bundle
npm test               # Vitest
```

The editor is [ProseMirror](https://prosemirror.net) with a custom
`markdown-it`-backed parser/serializer for round-tripping
GitHub-flavored markdown; the shell is [Tauri v2](https://v2.tauri.app)
(Rust host, native menus and window chrome — no bundled Node/Electron
runtime); the frontend is React + TypeScript + Vite.

## License

[MIT](LICENSE)
