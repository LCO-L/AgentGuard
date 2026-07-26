<!-- English reference version of PULL_REQUEST_TEMPLATE.md. GitHub auto-loads the Korean one; copy this if you prefer English. -->
<!-- Every change goes on record through this template. Please fill in the items instead of deleting them. -->

> [🇰🇷 한국어](PULL_REQUEST_TEMPLATE.md) | 🇺🇸 **English**

## What does this change?

<!-- One or two sentences. e.g.: add the 'grandparent jailbreak' scenario to the inject category -->

## Why is it needed?

<!-- Background / problem. Link related issues with #number -->

## How did you verify it?

- [ ] `AG_AI_PROVIDER=off python -m unittest discover -s tests` all pass
- [ ] (UI changes) checked the page directly in a browser
- [ ] (new scenarios) attached a detected input example below

```text
(detection example input / reproduction steps)
```

## Checklist

- [ ] I did not remove the copyright notice (© DONGHUN LEE · MIT) from file headers
- [ ] I followed the **no-storage principle** — no original text or secret values are stored
- [ ] I included **detection signals only**, not real malicious payloads (samples/tests included)
