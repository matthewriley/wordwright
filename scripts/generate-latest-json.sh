#!/usr/bin/env bash
# Generate the Tauri updater manifest (latest.json) for a release.
#
#   scripts/generate-latest-json.sh <version> <platform>=<sig-file> [...]
#
# e.g. scripts/generate-latest-json.sh 1.0.0 \
#   darwin-aarch64=src-tauri/target/release/bundle/macos/Wordwright.app.tar.gz.sig \
#   windows-x86_64=staging/Wordwright_1.0.0_x64-setup.nsis.zip.sig \
#   > latest.json
#
# Why this exists: tauri-cli 2.11 bundles and signs the updater artifacts
# (.app.tar.gz, .nsis.zip + .sig) but does NOT emit latest.json — the
# manifest is authored here instead. Asset URLs are derived from the sig
# filename (minus .sig) under the release tag v<version>, matching how
# publish/README.md tags releases. Upload latest.json as a release asset
# verbatim — plugins.updater.endpoints in tauri.conf.json points at
# releases/latest/download/latest.json.

set -euo pipefail
cd "$(dirname "$0")/.."

usage() { sed -n '3,5p' "$0" >&2; exit 1; }

version="${1:-}"
[[ "$version" =~ ^[0-9] ]] || usage
shift || usage
[[ $# -ge 1 ]] || usage

url_base="https://github.com/matthewriley/wordwright/releases/download/v$version"
platforms="{}"
for pair in "$@"; do
  platform="${pair%%=*}"
  sigfile="${pair#*=}"
  [[ "$platform" != "$sigfile" && -f "$sigfile" && "$sigfile" == *.sig ]] || {
    echo "expected <platform>=<path-to-.sig>, got: $pair" >&2; exit 1;
  }
  asset="$(basename "$sigfile")"
  asset="${asset%.sig}"
  # The whole .sig file is the manifest's signature string; command
  # substitution also strips its trailing newline.
  sig="$(cat "$sigfile")"
  platforms="$(jq --arg p "$platform" --arg u "$url_base/$asset" --arg s "$sig" \
    '. + {($p): {signature: $s, url: $u}}' <<< "$platforms")"
done

jq -n --arg v "$version" --arg d "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson p "$platforms" \
  '{version: $v, pub_date: $d, platforms: $p}'
