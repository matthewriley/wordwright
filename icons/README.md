# Wordwright Icon Package v3

Production assets for the accepted **Option 5: Minimal Mark** configuration.
This folder is the design source of truth — the app icon files Tauri
actually loads are copied from here into `src-tauri/icons/` (see Status
below); nothing under `src-tauri/` should be edited directly.

## Status

- **App icon**: wired up. `src-tauri/icons/{icon.icns,icon.ico,32x32.png,128x128.png,128x128@2x.png}`
  are copies of the matching files below (`macos/app/Wordwright.icns`,
  `windows/wordwright.ico`, `macos/app/Wordwright.iconset/icon_{32x32,128x128,128x128@2x}.png`),
  referenced from `src-tauri/tauri.conf.json`'s `bundle.icon` list.
- **Document icon**: wired up on **macOS** and **Windows NSIS**; **not**
  on **Windows MSI** (documented gap below). `tauri.conf.json`'s
  `bundle.fileAssociations` schema (`tauri-utils` `FileAssociation`
  struct) has no `icon` field at all, so neither platform's file-
  association config can reference a document icon directly — both
  needed a workaround:
  - **macOS**: `bundle.resources` copies `macos/document/WordwrightMarkdown.icns`
    into `Contents/Resources/` automatically at bundle time, but there's
    no `afterBundleCommand`-style hook to patch the bundle after —
    `scripts/apply-macos-document-icon.sh` does that, and **must be run
    after every `npm run tauri build`** (`npm run build:macos-doc-icon`).
    It sets `Info.plist`'s `CFBundleTypeIconFile`, but that alone turned
    out **not** to be what actually drives Finder's generic per-file
    icon on a machine with another markdown editor installed (confirmed
    live: Typora exports its own UTI, `io.typora.markdown`, conforming to
    `net.daringfireball.markdown` with the `.md`/`.markdown` extension
    tags bound directly to it and its own `UTTypeIconFile` — Finder
    resolves the icon from whichever app *exports* the type, entirely
    independent of which app is set as the default "Open With" handler).
    The script also adds a full `UTExportedTypeDeclarations` entry
    exporting Wordwright's own UTI (`app.wordwright.markdown`) with its
    own icon, so it can actually compete for the icon the same way. Also
    re-signs the app ad-hoc, since editing `Info.plist` post-bundle
    invalidates Tauri's own signature.
  - **Windows (NSIS)**: `bundle.resources` places
    `windows/wordwright-markdown.ico` directly in `$INSTDIR`, and
    `src-tauri/windows/document-icon-hook.nsh` (wired via
    `bundle.windows.nsis.installerHooks`) overwrites the
    `Markdown Document` class's `DefaultIcon` registry value right after
    the installer creates it — no extra build step needed, it's baked
    into `tauri build` itself.
  - **Windows (MSI/WiX)**: not implemented — would need a separate custom
    WiX fragment (`fragmentPaths`/`componentGroupRefs`), and MSI hasn't
    actually been used in this project's Windows testing so far (NSIS
    only). `.md` files installed via the MSI still show the plain app
    icon. Easy to pick up later if the MSI installer ever gets used.
- **Windows DPI-awareness manifest** (`src-tauri/windows-app-manifest.xml`,
  wired via a custom `build.rs`): unrelated to the icon *files* themselves,
  but found while chasing a blurry-looking Windows taskbar icon — Tauri's
  own default manifest declares no DPI-awareness at all, which leaves an
  app in the legacy DPI-unaware compatibility mode (Windows bitmap-
  stretches the whole process to fill the real display). Fixed regardless,
  since it's a real correctness issue independent of the icon investigation.
  The taskbar blur itself turned out to be specific to the ARM64 Windows
  test VM (confirmed on a real x64 machine on the same network: icon
  renders correctly there) — likely a display-driver limitation of the
  virtualized test environment under emulated high-DPI scaling, not a
  defect in any of these assets.

## Visual source of truth

Version 3 applies two explicit corrections from visual QA against the accepted concept:

1. **Level W top:** the left top, center peak, and right top are aligned to the same horizontal level.
2. **Two-color mark:** the W uses Base terracotta and the down arrow uses Deep terracotta.

Colors:

- W / Base terracotta: `#CC6C4D`
- Arrow / Deep terracotta: `#9E4F36`
- App tile / Soft cream: `#F6E4DB`
- App appearance: light only

The accepted concept board is preserved at `reference/accepted-option-5-board.png`. The comparison image that motivated the v3 corrections is preserved at `reference/user-comparison-v2.png`.

## Source files

- `source/wordwright-app.svg` - canonical application icon
- `source/wordwright-mark.svg` - transparent W + arrow mark
- `source/wordwright-markdown.svg` - canonical Markdown document icon
- `source/wordwright-markdown-small.svg` - small document variant without `.md`

## Windows

- `windows/wordwright.ico`: 16, 20, 24, 32, 40, 48, 64, 128, 256 px
- `windows/wordwright-markdown.ico`: same embedded sizes
- Individual PNGs are in `windows/app/png` and `windows/document/png`.

## macOS

- `macos/app/Wordwright.icns`
- `macos/app/Wordwright.iconset/` contains 1x/2x source PNGs through 1024 px
- `macos/document/WordwrightMarkdown.icns`
- `macos/document/WordwrightMarkdown.iconset/`
- `macos/document/badge/` contains transparent W + arrow assets for native document composition

## Regeneration

Run `generate_icons.py` with Python, Pillow, and CairoSVG installed. All generated formats derive from the same SVG geometry and color constants.
