# Security Policy

## Supported Versions

Only the latest released version of Wordwright is supported with security
fixes.

## Reporting a Vulnerability

Please use GitHub's private vulnerability reporting for this repository:
open the **Security** tab and click **Report a vulnerability**. This keeps
the report private between you and the maintainer until a fix is available.

If you'd rather not use GitHub, email contributions@matthewriley.us with
details.

Please don't open a public issue for a security vulnerability.

## Software Bill of Materials

Each release ships CycloneDX SBOMs (`*.cdx.json`) as release assets,
covering the bundled npm dependencies and the per-platform Rust
dependencies. The OS web engine (WKWebView on macOS, WebView2 on Windows)
is out of scope: it comes with the OS or the WebView2 Evergreen runtime
and is not bundled with the app.

You should expect an initial response within a few days. There's no bug
bounty program — this is a personal project — but reports are taken
seriously and credited in the fix's release notes unless you'd prefer
otherwise.
