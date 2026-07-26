> [🇰🇷 한국어](CONTRIBUTING.md) | 🇺🇸 **English**

# Contributing to AgentGuard

Welcome! This project is **MIT-licensed** open source, and the copyright notice of its author
**DONGHUN LEE** must be preserved in every copy.

## The easiest contribution — a one-line detection scenario

New attack/leak patterns are added with **a single line of data**, no code changes.

1. Open `core/rulepacks/scenarios_data.py`
2. Add one `Scenario(...)` line to the `SCENARIOS` list
3. Run the tests — confirm that inspection, the editor, the extension, and the interpreter all catch it together

```bash
AG_AI_PROVIDER=off python -m unittest discover -s tests -v
```

## Development environment

```bash
uv sync                                   # or: pip install -r requirements.txt
python samples/make_samples.py            # generate demo samples
python app.py                             # http://localhost:8000
```

## Rules (for a PR to pass)

- **CI is mandatory**: every PR must pass GitHub Actions CI (tests · CLI gate · JS syntax · API smoke)
  before merging. Direct pushes to main are blocked by branch protection.
- **Review is mandatory**: nothing merges without CODEOWNERS approval.
- **No-storage principle**: code that stores original text, secret values, or masking mappings on the server is not accepted.
- **No real payloads**: samples and tests carry **detection signals only** — never actual malicious code.
- **Keep the copyright notice**: do not remove `© DONGHUN LEE · MIT License` from file headers.
  (The MIT license itself requires notice preservation.)

## Commit & PR conventions

- Fill in every item of the PR template — the principle is that **the reason for every change stays on record**.
- Commit messages should show "what and why": `inject: add grandparent jailbreak scenario (#12)`
- A small PR discussed in an issue first merges faster than a big PR that arrives without one.

## Found a security vulnerability?

Please use the private channel described in [SECURITY.en.md](SECURITY.en.md) instead of a public issue.
