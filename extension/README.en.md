> [🇰🇷 한국어](README.md) | 🇺🇸 **English**

# 🛡️ AgentGuard Chrome Extension

Scan links, files, and pages for hidden commands and prompt injection with **a single right-click**.
AgentGuard draws a red underline under **invisible commands and lookalike characters**,
and on hover reveals them, e.g. "Hidden command here: send id_rsa".

## Features

| Feature | Description |
|---|---|
| **Right-click scan** | Right-click a link, image, selected text, or page → instant interpretation card |
| **Inline highlight** | Automatically highlights hidden risks on the page (on-device, no backend required) |
| **AI input-box guard** | Before sending to ChatGPT, Claude, etc., detects secrets/PII/injection in the input box and **intercepts the Enter key** with a confirmation modal (mask & send) |
| **Download interception** | Pre-scans the URL when a file download starts and alerts if dangerous |
| **3-engine choice** | On-device (Ollama) · Claude · OpenRouter — switch from the popup |

### AI input-box guard

On `chatgpt.com`, `claude.ai`, `gemini.google.com` and similar sites, as you type into the input box (500ms debounce):
- **Sensitive data** such as `sk-...` API keys, national ID numbers, card numbers, and emails, plus
  **prompt injection** like "ignore previous instructions", are detected locally (no backend) and shown as a badge next to the input box.
- **The Enter key is intercepted** and a confirmation modal appears; pressing `[Mask & Send]` replaces
  `sk-...` with `[SECRET_1]` before sending. The original never leaves your machine.

## Install (Developer mode)

1. Start the backend first:
   ```bash
   cd agentguard && uv run python app.py   # http://localhost:8000
   ```
2. Chrome → `chrome://extensions` → enable **Developer mode** (top right)
3. **Load unpacked** → select this `extension/` folder
4. Click the 🛡️ icon in the toolbar → set the reasoning engine (on-device / Claude / OpenRouter) and the server address

## On-device principles

- Inline page highlighting runs instantly inside the browser **without a backend** (`agscan.js`).
- Detailed file/link scans go to the local backend, and the backend does not store originals.
- API keys are stored only in `chrome.storage.local` (this browser).

## Layout

```
manifest.json   MV3 declaration (contextMenus · downloads · storage)
background.js   right-click menu · download interception · backend calls
content.js      inline highlighting + result overlay card (Shadow DOM)
inputguard.js   AI input-box watcher + send interception + masking (real-time pre-send scan)
agscan.js       on-device lightweight scanner (a JS port of textnorm + pii)
popup.html/js   3-engine settings + status & connection test
```
