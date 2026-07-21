# 📱 AgentGuard APK 빌드 가이드 (Capacitor)

> 상태: **프로젝트 생성·sync 완료** (`web/android/`). APK 바이너리 빌드는 Android Studio/SDK가 필요한 로컬 작업.

## 1. 웹 에셋 빌드 (APK용 정적 export)

```bash
cd web
CAPACITOR_BUILD=1 NEXT_PUBLIC_API_ABSOLUTE=https://agentguard.maeum.ai npm run build
# → out/ 생성. rewrites 대신 클라이언트가 백엔드 절대 주소로 직접 호출(CORS)
```

## 2. Capacitor sync

```bash
npx cap sync android   # out/ → android/app/src/main/assets/public 복사
```

## 3. Android Studio에서 APK 빌드

```bash
npx cap open android   # Android Studio 실행 (SDK 34+ 필요)
# Build → Build Bundle(s)/APK(s) → Build APK(s)
```

CLI만으로 디버그 APK를 만들 수도 있습니다(Java 17 + Android SDK 필요):

```bash
cd android && ./gradlew assembleDebug
# 산출물: android/app/build/outputs/apk/debug/app-debug.apk
```

## 4. 공유 시트(Share Intent)

`AndroidManifest.xml`에 아래 인텐트 필터가 이미 추가되어 있습니다:

- `ACTION_SEND` (text/plain) — 다른 앱에서 "공유 → AgentGuard"로 텍스트·링크 전송
- `ACTION_PROCESS_TEXT` — 텍스트 선택 시 플로팅 메뉴에서 검사

수신한 텍스트를 JS로 넘기려면 커뮤니티 플러그인(`capacitor-share-target` 등)을
추가하거나, `MainActivity`의 `onCreate/onNewIntent`에서
`EXTRA_TEXT`를 읽어 WebView로 전달하는 5줄짜리 네이티브 브릿지를 추가하세요.
수신 텍스트는 `/v1/scan/text` 또는 `/v1/scan/url`로 본낼 것.

## 5. 백엔드 주의사항

- APK는 Railway 등에 배포된 **HTTPS 백엔드**를 바라봐야 합니다 (`android:allowMixedContent=false` 이므로 http 불가).
- 백엔드 CORS(`AG_CORS_ORIGINS`)에 `capacitor://localhost`, `http://localhost` 포함 확인.
- API 키를 쓰는 엔터프라이즈 모드라면 `AG_API_KEY`를 앱 설정 화면에서 입력받아
  `X-API-Key` 헤더로 전달하도록 확장하세요.

## 6. 대안: PWA → TWA (bubblewrap)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://agentguard.maeum.ai/manifest.webmanifest
bubblewrap build   # → app-release-signed.apk
```

백엔드가 PWA manifest/sw를 이미 서빙하므로(`ui/manifest.webmanifest`),
웹 배포만 되어 있으면 네이티브 프로젝트 없이도 APK를 만들 수 있습니다.
