#!/usr/bin/env bash
# Stamp CITATION.cff with the version being published and the release date.
#
#   scripts/update-citation-cff.sh [YYYY-MM-DD]
#
# The version comes from package.json (the release's version of record,
# already bumped alongside tauri.conf.json and Cargo.toml by then); the
# date defaults to today. Run on release day, before the public sync in
# publish/README.md — CITATION.cff is in publish-filter.txt's allow-list,
# so without this step it publishes with the previous release's metadata.

set -euo pipefail
cd "$(dirname "$0")/.."

usage() { sed -n '3,5p' "$0" >&2; exit 1; }

date_released="${1:-$(date +%Y-%m-%d)}"
[[ "$date_released" =~ ^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$ ]] || usage

version="$(jq -r .version package.json)"

# -i.bak instead of -i '' so the same invocation works under both the
# BSD sed shipped with macOS and GNU sed (the file this edits is
# published, and the script may be run off a Linux checkout).
sed -i.bak \
  -e "s/^version: .*/version: $version/" \
  -e "s/^date-released: .*/date-released: \"$date_released\"/" \
  CITATION.cff
rm CITATION.cff.bak

grep -q "^version: $version$" CITATION.cff
grep -q "^date-released: \"$date_released\"$" CITATION.cff
echo "CITATION.cff: version $version, date-released $date_released"
