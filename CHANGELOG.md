# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2]

### Added

- Markdown formatting keyboard shortcuts: bold, italic, strikethrough,
  inline code, code block, link, bullet/ordered/task lists, blockquote, and
  headings 1–3. A new **Format** menu lists them all with their chords, and
  toolbar tooltips now show the shortcut for the corresponding button.

### Changed

- Release builds now run in CI on the public repo, which builds, signs,
  notarizes, and publishes each artifact with SLSA Build L2 provenance and
  a CycloneDX SBOM per platform. Verify any download with
  `gh attestation verify <file> --repo matthewriley/wordwright`.

### Fixed

- Blockquote was one-way: clicking the toolbar button on an existing
  blockquote nested another `>` instead of removing it. The new
  Ctrl+Shift+. shortcut routes at the same command, so it's fixed too.

### Security

- Updated `markdown-it` to 14.3.3 and `prosemirror-view` to 1.43.0, closing
  the two open production advisories. `npm audit` now reports none.

## [1.0.1]

### Added

- macOS builds are now signed with a Developer ID certificate and
  notarized + stapled by Apple — first launch shows the normal
  "checked for malicious software" prompt instead of a Gatekeeper
  block.
- Windows installers are now signed via Azure Artifact Signing
  (Microsoft). Note for first install: SmartScreen may still warn until
  the new signing identity builds reputation over time — updates after
  that arrive in-app and don't re-prompt.

## [1.0.0]

Initial release. Ships CycloneDX SBOMs (`*.cdx.json`) as release assets
alongside the installers, covering the bundled npm dependencies and the
per-platform Rust dependencies.

[1.0.2]: https://github.com/matthewriley/wordwright/releases/tag/v1.0.2
[1.0.1]: https://github.com/matthewriley/wordwright/releases/tag/v1.0.1
[1.0.0]: https://github.com/matthewriley/wordwright/releases/tag/v1.0.0
