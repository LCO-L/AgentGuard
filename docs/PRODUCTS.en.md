> [🇰🇷 한국어](PRODUCTS.md) | 🇺🇸 **English**

# 📦 One Engine, Many Artifacts — the AgentGuard Product Map

> We extend **"only the input changes; the engine is one"** (the spec) along the packaging axis.
> Detection · judgment · interpretation · masking logic all live in one place: `core/` + FastAPI (`api/`).
> The artifacts below are merely **frontends/packagings that call the same engine**.

```
                    ┌──────────────────────────────┐
                    │  AgentGuard engine (shared brain) │
                    │  core/  ·  api/ (FastAPI /v1)     │
                    │  rulepacks scenario registry      │
                    └──────────────┬───────────────┘
        ┌───────────────┬──────────┼───────────┬─────────────────┐
        ▼               ▼          ▼           ▼                 ▼
  ① installable on-device  ② Chrome ext.  ③ APK (Android)  ④ VS Code ext.   (web dashboard/widget)
   Ollama + web (UI)      extension/     web + Capacitor   vscode-extension  ui/*.html
```

## Artifact definitions

### ① Installable on-device (Ollama-based) — the main one
- **Fully offline**: local FastAPI + local Ollama (qwen) + `web/` (Next.js UI).
- Originals and prompts **never leave the device**. The reasoning engine is local too.
- Run: `ollama serve` → `uvicorn api.main:app` → `web` (`npm run dev` or static serving).
- (Optional) Wrap `web` with Tauri for a desktop window and the "installable app" experience is complete.

### ② Chrome extension — done
- `extension/` (MV3). Right-click instant scan · inline highlighting · **AI input-box send interception**.
- The on-device lightweight scanner (`agscan.js`) provides first-line defense even without a backend; details go to the local API.

### ③ APK (Android)
- Wrap `web/` (Next.js) with **Capacitor** into a native app (100% web UI reuse).
- "Long-press to scan links and phrases" via the share sheet (Web Share Target / native Share).
- Build: `npm run build && next export` → `npx cap add android` → `cap sync` → Android Studio.
- (Alternative) It's already a PWA, so a TWA (bubblewrap) APK also works.

### ④ VS Code extension (if time allows)
- Scan code/prompts being edited via `/v1/inspect` → diagnostics (underlines) on problem spans.
- Warns about secrets, vulnerable code, over-permission, and injection right inside the IDE.

## Why this shape
- **100% engine reuse**: a new artifact is frontend-only. Rules/scenarios are added in one place, `rulepacks` (one line of data).
- **On-device consistency**: every artifact gets local Ollama judgment + no original exfiltration.
- **Growth roadmap**: individuals use it free (extension · apps); teams and companies grow into the installable version and a central policy server.
