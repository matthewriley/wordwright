#!/usr/bin/env bash
# Generate CycloneDX 1.5 SBOMs for a Wordwright release.
#
#   scripts/generate-sbom.sh [version] [target ...]
#
# version defaults to package.json's version. Targets are installer
# platform names; pass one per shipped installer (default: all known):
#
#   macos-aarch64     aarch64-apple-darwin
#   windows-x86_64    x86_64-pc-windows-msvc
#   windows-aarch64   aarch64-pc-windows-msvc
#
# Output: sbom/wordwright-<version>-frontend.cdx.json (npm, shared by all
# platforms) and sbom/wordwright-<version>-<target>.cdx.json (Cargo, per
# platform). Windows Cargo SBOMs are generated cross-target from the
# host — cargo-cyclonedx reads cargo metadata and compiles nothing, so
# this script only ever runs on macOS/Linux (bash 3.2-compatible).
#
# sbom/ is gitignored; the files are uploaded as GitHub Release assets,
# never committed (see specs/006-sbom.md).

set -euo pipefail
cd "$(dirname "$0")/.."

# `cargo install` drops binaries here; non-interactive shells may lack it.
export PATH="$HOME/.cargo/bin:$PATH"

triple_for() {
  case "$1" in
    macos-aarch64)    echo "aarch64-apple-darwin" ;;
    windows-x86_64)   echo "x86_64-pc-windows-msvc" ;;
    windows-aarch64)  echo "aarch64-pc-windows-msvc" ;;
    *) return 1 ;;
  esac
}

version=""
if [[ "${1:-}" =~ ^[0-9] ]]; then
  version="$1"; shift
fi
if [[ -z "$version" ]]; then
  version="$(jq -r .version package.json)"
fi

targets=("$@")
if [[ ${#targets[@]} -eq 0 ]]; then
  targets=(macos-aarch64 windows-x86_64 windows-aarch64)
fi
for t in "${targets[@]}"; do
  triple_for "$t" > /dev/null || { echo "unknown target: $t" >&2; exit 1; }
done

for tool in jq npx; do
  command -v "$tool" > /dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done
command -v cargo-cyclonedx > /dev/null || {
  echo "missing tool: cargo-cyclonedx (cargo install cargo-cyclonedx)" >&2; exit 1;
}

mkdir -p sbom

# npm: one SBOM for the bundled frontend deps. cyclonedx-npm reads the
# installed tree, so reinstall from the lockfile first — a stale
# node_modules silently produces a stale SBOM.
npm ci
npx --yes @cyclonedx/cyclonedx-npm --omit dev --spec-version 1.5 \
  --output-file "sbom/wordwright-$version-frontend.cdx.json"

# Cargo: one SBOM per target platform. --no-build-deps drops build.rs
# dependencies (e.g. tauri-build), which never ship in the binary — same
# rationale as --omit dev on the npm side. cargo-cyclonedx writes next to
# the manifest and embeds the absolute manifest path in bom-refs; the sed
# strips that local path before the file leaves the repo.
for t in "${targets[@]}"; do
  triple="$(triple_for "$t")"
  tmp="sbom-tmp-$t"
  (cd src-tauri && cargo cyclonedx -q --format json --spec-version 1.5 \
    --no-build-deps --target "$triple" --override-filename "$tmp")
  sed 's|path+file://[^"#]*#||g' "src-tauri/$tmp.json" \
    > "sbom/wordwright-$version-$t.cdx.json"
  rm "src-tauri/$tmp.json"
done

# Validate: every file parses, expected components are present, and dev
# dependencies were left out (spec 006's minimum checks).
for f in sbom/wordwright-"$version"-*.cdx.json; do
  jq empty "$f"
done
jq -e '[.components[].name] | any(. == "prosemirror-model")' \
  "sbom/wordwright-$version-frontend.cdx.json" > /dev/null
jq -e '[.components[].name] | any(. == "vite") | not' \
  "sbom/wordwright-$version-frontend.cdx.json" > /dev/null
for t in "${targets[@]}"; do
  jq -e '[.components[].name] | any(. == "tauri")' \
    "sbom/wordwright-$version-$t.cdx.json" > /dev/null
done

for f in sbom/wordwright-"$version"-*.cdx.json; do
  echo "$f: $(jq '.components | length' "$f") components"
done
echo "Recommended before release: osv-scanner --sbom=<file> (or grype sbom:<file>) on each."
