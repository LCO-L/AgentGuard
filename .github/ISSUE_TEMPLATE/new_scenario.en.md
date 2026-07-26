---
name: "🧩 New Detection Scenario (English)"
about: "This attack/leak pattern should be caught too — added with one line of data"
title: "[Scenario] "
labels: ["scenario", "good first issue"]
---

> [🇰🇷 한국어](new_scenario.md) | 🇺🇸 **English**

## What is the risk?

<!-- e.g.: a phrase that tricks the AI into "audit mode" to extract the system prompt -->

## Example input that should be detected

```text
(not a real payload — an example phrase that carries the detection *signal*)
```

## Suggested severity

- [ ] critical (must be blocked immediately)
- [ ] high
- [ ] medium
- [ ] low

## Notes

Adding one `Scenario(...)` line to `core/rulepacks/scenarios_data.py` makes
inspection, the editor, the extension, and the interpreter all catch it automatically.
A direct PR is even better!
