> [🇰🇷 한국어](README.md) | 🇺🇸 **English**

# AgentGuard Web (Next.js)

The installable on-device UI, and the **shared web frontend for the APK (Capacitor)**. It calls the same `core/` engine (FastAPI).

## Run

```bash
# 1) Start the backend (FastAPI) first
cd .. && uv run python app.py            # http://localhost:8000

# 2) Web
cd web
npm install
cp .env.local.example .env.local         # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev                              # http://localhost:3000
```

The rewrites in `next.config.mjs` proxy `/api/*` → the backend, so it works without any CORS setup.

## Structure

```
app/
  layout.tsx         shell (TopNav) + global styles
  page.tsx           dashboard (unified file · text · link scan)
  editor/page.tsx    secure editor (real-time security underlines)
  settings/page.tsx  3-engine settings (on-device / Claude / OpenRouter)
  scenarios/page.tsx scenario catalog (visualizing extensibility)
components/          design system (ui) + RiskCard · SecurityEditor · CoachPanel · TopNav · EngineIndicator
lib/                 types · config (AGConfig) · api (backend client) · cn (tokens)
tailwind.config.ts   design tokens (Donald Norman: mapping · feedback · visibility)
```

## Building the APK (Capacitor)

```bash
npm run build          # (add output:'export' if you want a static export)
npx cap init AgentGuard com.agentguard.app
npx cap add android
npx cap sync
npx cap open android   # build in Android Studio → APK
```

> It's already a PWA (`/manifest.webmanifest` + `sw.js`), so an APK can also be produced via TWA (bubblewrap).
