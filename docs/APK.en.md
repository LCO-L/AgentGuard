> [🇰🇷 한국어](APK.md) | 🇺🇸 **English**

# 📱 AgentGuard APK Build Guide (Capacitor)

> Status: **project created & synced** (`web/android/`). Building the APK binary is a local task that requires Android Studio/SDK.

## 1. Build the web assets (static export for the APK)

```bash
cd web
CAPACITOR_BUILD=1 NEXT_PUBLIC_API_ABSOLUTE=https://agentguard.maeum.ai npm run build
# → creates out/. Instead of rewrites, the client calls the backend's absolute address directly (CORS)
```

## 2. Capacitor sync

```bash
npx cap sync android   # copies out/ → android/app/src/main/assets/public
```

## 3. Build the APK in Android Studio

```bash
npx cap open android   # launches Android Studio (SDK 34+ required)
# Build → Build Bundle(s)/APK(s) → Build APK(s)
```

You can also build a debug APK with the CLI alone (Java 17 + Android SDK required):

```bash
cd android && ./gradlew assembleDebug
# artifact: android/app/build/outputs/apk/debug/app-debug.apk
```

## 4. Share sheet (Share Intent)

The following intent filters are already added to `AndroidManifest.xml`:

- `ACTION_SEND` (text/plain) — "Share → AgentGuard" sends text/links from other apps
- `ACTION_PROCESS_TEXT` — scan from the floating menu when text is selected

To pass the received text to JS, add a community plugin (`capacitor-share-target` etc.),
or add a five-line native bridge that reads `EXTRA_TEXT` in `MainActivity`'s
`onCreate/onNewIntent` and forwards it to the WebView.
Send the received text to `/v1/scan/text` or `/v1/scan/url`.

## 5. Backend caveats

- The APK must point at an **HTTPS backend** deployed on Railway etc. (`android:allowMixedContent=false`, so plain http won't work).
- Make sure the backend CORS (`AG_CORS_ORIGINS`) includes `capacitor://localhost` and `http://localhost`.
- If you use API keys in enterprise mode, extend the app's settings screen to accept `AG_API_KEY`
  and pass it as the `X-API-Key` header.

## 6. Alternative: PWA → TWA (bubblewrap)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://agentguard.maeum.ai/manifest.webmanifest
bubblewrap build   # → app-release-signed.apk
```

Since the backend already serves the PWA manifest/sw (`ui/manifest.webmanifest`),
an APK can be produced without a native project as long as the web deployment exists.
