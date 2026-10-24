#!/bin/bash
# Run after `npm run tauri build` on macOS. Tauri's fileAssociations config
# has no icon field (verified against the actual tauri-utils source) and
# there's no afterBundleCommand hook to patch the bundle post-build, so this
# has to be a separate manual step.
#
# Two things turned out to be necessary, not one:
#
# 1. CFBundleTypeIconFile under CFBundleDocumentTypes — the "obvious" fix,
#    and correct per Tauri's own document-type declaration, but confirmed
#    LIVE not to be what actually drives Finder's generic per-file icon.
# 2. A full UTExportedTypeDeclarations entry, exporting our OWN UTI
#    (app.wordwright.markdown). On a machine with another markdown editor
#    installed (e.g. Typora, which exports io.typora.markdown with its own
#    UTTypeIconFile and claims the md/markdown extension tags directly),
#    Finder's icon is governed by whichever app EXPORTS/OWNS the type for
#    that extension — completely independent of which app is set as the
#    default "Open With" handler (confirmed live: switching the default
#    handler back and forth had zero effect on the icon shown). Tauri's
#    `exportedType` config (the ExportedFileAssociation struct) has no icon
#    field either, so this can't be done through tauri.conf.json at all —
#    it has to be added directly here.
#
# Both point at WordwrightMarkdown.icns, already bundled via
# tauri.conf.json's bundle.resources into Contents/Resources/. Re-signs
# ad-hoc afterward, since editing Info.plist after Tauri's own bundling
# step invalidates whatever signature it already applied.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Optional first argument: path to a different Wordwright.app (e.g. one
# mounted inside a read-write-converted .dmg, when patching the shipped
# disk image's copy — see publish/README.md).
APP="${1:-$SCRIPT_DIR/../src-tauri/target/release/bundle/macos/Wordwright.app}"
PLIST="$APP/Contents/Info.plist"
UTI="app.wordwright.markdown"

if [ ! -f "$PLIST" ]; then
  echo "error: $PLIST not found — run 'npm run tauri build' first" >&2
  exit 1
fi

PB=/usr/libexec/PlistBuddy

# Delete-then-add makes this safe to re-run against an Info.plist that
# already has these keys from a previous run of this script.
"$PB" -c "Delete :CFBundleDocumentTypes:0:CFBundleTypeIconFile" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :CFBundleDocumentTypes:0:CFBundleTypeIconFile string WordwrightMarkdown.icns" "$PLIST"

"$PB" -c "Delete :UTExportedTypeDeclarations" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :UTExportedTypeDeclarations array" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0 dict" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeIdentifier string $UTI" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeDescription string 'Markdown Document'" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeIconFile string WordwrightMarkdown.icns" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeConformsTo array" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeConformsTo:0 string net.daringfireball.markdown" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeConformsTo:1 string public.plain-text" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeTagSpecification dict" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension array" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension:0 string md" "$PLIST"
"$PB" -c "Add :UTExportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension:1 string markdown" "$PLIST"

codesign --force --deep -s - "$APP"

echo "Document icon + exported UTI ($UTI) wired up, app re-signed: $APP"
