> [🇰🇷 한국어](SECURITY.md) | 🇺🇸 **English**

# Security Policy

AgentGuard is a security tool. We take vulnerability reports about the tool itself seriously.

## Supported versions

| Version | Supported |
|---|---|
| main (latest) | ✅ |
| other tags | ❌ (please update to the latest) |

## Reporting a vulnerability

**Do not open a public issue.** Instead:

1. Use GitHub's **Private vulnerability reporting** (Security tab → Report a vulnerability) — recommended
2. Or contact the repository owner privately

Please include: reproduction steps, the impact, and (if possible) a suggested fix.

## Our promises

- First response **within 72 hours** of receipt
- Details stay private until a fix ships; reporter credit after the fix (if you want it)
- Detection **bypass** reports are treated as vulnerabilities too — we respond with new scenarios/normalization

## Out of scope

- The "malicious" files in the demo samples (`samples/`) — they are fakes carrying detection signals only, with no real payloads
- API keys stored in browser localStorage — this is the **BYOK (Bring Your Own Key)** design.
  Users enter their own keys; keys stay only in the user's browser, travel only as request headers,
  and the server **stores no keys, no original text, and no masking mappings** (no-storage principle)
