# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/matthewriley/wordwright/releases/tag/v1.0.1
[1.0.0]: https://github.com/matthewriley/wordwright/releases/tag/v1.0.0
