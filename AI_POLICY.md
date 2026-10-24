# AI Policy

AI assistance (LLMs) is welcome here — for writing code, tests, and
docs, and for help writing issues and pull requests. Use the tools
freely. What matters is what lands in the repo, not how it was drafted.

## The standard (everyone, maintainer included)

- **A human is responsible for every contribution.** You don't need to
  have personally reviewed every line an AI generated — but you do need
  to stand behind the change as a whole. "The AI wrote it" is not a
  defense for a change that doesn't work.
- **Code changes are tested on both macOS and Windows.** The app ships
  on both, so a change that has only run on one isn't done. In your PR,
  say what you ran and where. If you can't test on one of the
  platforms, say so — the maintainer can help cover it. (Docs-only
  changes are obviously exempt.)
- **All unit tests pass** (`npm test`), and if your change touches
  behavior the tests cover — or should cover — add or update them.
- **No autonomous agent submissions.** Pull requests opened or driven
  by unattended bots will be closed, perhaps without notice. Agentic
  coding tools (Claude Code, Copilot, Cursor, and friends) are fine
  when a human directs the work, runs the tests, and opens the PR
  themselves.

## Communication

AI help with writing — issues, PR descriptions, review replies — is
fine, including translation and ESL assistance. Just make sure the
words reflect your own thinking: the human behind the account should be
able to stand behind the content and engage with review questions about
it, however the text was produced.

Sharing a short excerpt from an AI interaction is welcome when it adds
context: keep it brief, mark it as a quote (`>`), and add your own
words about why it matters. Please don't paste transcripts.

## Disclosure

Noting AI assistance in a PR (a line in the description, a
`Co-Authored-By` trailer) is appreciated transparency, but it's
optional — the standard above is the same either way.
