# Contributing to Wordwright

Thanks for considering a contribution.

## The mission comes first

Wordwright is, deliberately, a small, fast, focused markdown editor —
and it is staying that way. Contributions are judged against that
mission before anything else:

- **No usage analytics, no user metrics, no ads.** Ever. This includes
  "anonymous," "privacy-respecting," and "opt-in" variants. The only
  network request the app makes is the update check against GitHub
  Releases, and that is not changing.
- **No scope growth.** No accounts, no sync, no plugin systems, no
  collaboration features, no platform ambitions. A beautifully built PR
  for the wrong feature is still the wrong feature.
- **Small is a feature.** Startup time, memory footprint, and UI
  simplicity are product qualities worth protecting — a change that
  costs one of them needs to earn it.

Wordwright is heading toward **feature complete**: at some point the
feature set freezes, and from then on the project takes only security
fixes and dependency updates. PRs in that spirit — fixes, hardening,
dependency maintenance — are always welcome, before and after that
point.

And if the app you wish existed points in a different direction — do the
noblest thing in open source: **fork it, rename it, and make it yours.**
The MIT license positively encourages this, and we will read your
README with great interest from our small, finished app.

## Getting started

Fork the repo and open a pull request against `main`. See
[README.md](README.md) for build, run, and test instructions — no need to
duplicate them here.

## Before you open a PR

- For anything beyond a small fix, opening an issue first to discuss the
  approach saves everyone time.
- Keep changes focused. A bug fix doesn't need surrounding cleanup; a small
  feature doesn't need new abstractions "for later."
- Look for an existing pattern (a hook, a store shape, a modal controller)
  before introducing a new one for a similar need.
- Comments should explain *why*, not *what* — only add one where something
  non-obvious (a platform quirk, a workaround, an invariant) would surprise
  a reader. Well-named code and commit messages cover the rest.
- Run `npm run test` and `npx tsc --noEmit` before opening the PR.

## Using AI tools

AI-assisted contributions are welcome under the terms in
[AI_POLICY.md](AI_POLICY.md) — please read it before opening an issue or
PR.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
