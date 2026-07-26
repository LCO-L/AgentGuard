> [🇰🇷 한국어](IOS_SHORTCUT.md) | 🇺🇸 **English**

# 📱 Two ways to "long-press to scan" on iPhone

On desktop you scan with the Chrome extension's **right-click**; on iPhone you use the **share sheet**
(the "Share" menu that appears when you long-press a link or text in Safari).

## Option A — PWA Share Target (1-minute setup, zero code)

The AgentGuard dashboard is a PWA, so it **appears in the share sheet**.

1. Open the backend address (e.g. `http://<your Mac's IP>:8000`) in iPhone Safari.
2. Bottom **Share** button → **Add to Home Screen**.
3. Now, in any app, select a link or text → **Share** → pick **AgentGuard** —
   the dashboard opens and **scans automatically**.

> How it works: the `share_target` in `manifest.webmanifest` passes the shared `url`/`text` to the
> dashboard, which immediately scans it via `/v1/scan/url` or `/v1/scan/text`.

## Option B — iOS Shortcuts

If you also want to scan files, a Shortcut is more flexible. Build it once as below and
**"Scan with AgentGuard"** appears in the share sheet.

1. **Shortcuts** app → new shortcut → (i) at the top right → enable **Show in Share Sheet**,
   accepted types: URLs · text · files.
2. Add actions:
   - **"Get Contents of URL"**
     - URL: `http://<your Mac's IP>:8000/v1/scan/url` (for text/files use `/v1/scan/text`)
     - Method: `POST`, body: `JSON`
     - JSON: `{ "url": <Shortcut Input> }`  (for text: `{ "text": <Shortcut Input> }`)
     - (Optional) header `X-AI-Provider: ollama` etc. to pick the reasoning engine
   - **"Get Dictionary Value"** → key `card` → `headline`, `action`
   - **"Show Notification"** or **"Show Result"** to display the interpretation card text
3. Save it as "Scan with AgentGuard".

Now **long-press a link or phrase → Share → Scan with AgentGuard** and the risk verdict appears right away.

> On-device principle: in both options the scan is handled by your local backend (your Mac/server)
> and originals are not stored. For fully offline operation, set the reasoning engine to Ollama.
