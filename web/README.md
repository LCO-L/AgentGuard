# AgentGuard Web (Next.js)

설치형 온디바이스 UI이자 **APK(Capacitor)의 공통 웹 프론트**. 같은 `core/` 엔진(FastAPI)을 호출합니다.

## 실행

```bash
# 1) 백엔드(FastAPI)를 먼저 띄운다
cd .. && uv run python app.py            # http://localhost:8000

# 2) 웹
cd web
npm install
cp .env.local.example .env.local         # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev                              # http://localhost:3000
```

`next.config.mjs`의 rewrites 가 `/api/*` → 백엔드로 프록시하므로 CORS 설정 없이 동작합니다.

## 구조

```
app/
  layout.tsx         셸(TopNav) + 전역 스타일
  page.tsx           대시보드(파일·텍스트·링크 통합 검사)
  editor/page.tsx    보안 에디터(Grammarly식 실시간 밑줄)
  settings/page.tsx  3-엔진 설정(온디바이스/Claude/OpenRouter)
  scenarios/page.tsx 시나리오 카탈로그(확장성 가시화)
components/          디자인 시스템(ui) + RiskCard·SecurityEditor·CoachPanel·TopNav·EngineIndicator
lib/                 types·config(AGConfig)·api(백엔드 클라이언트)·cn(토큰)
tailwind.config.ts   디자인 토큰(도널드 노먼: 매핑·피드백·가시성)
```

## APK 만들기 (Capacitor)

```bash
npm run build          # (정적 export 를 원하면 output:'export' 추가)
npx cap init AgentGuard com.agentguard.app
npx cap add android
npx cap sync
npx cap open android   # Android Studio 에서 빌드 → APK
```

> 이미 PWA(`/manifest.webmanifest` + `sw.js`)라 TWA(bubblewrap)로도 APK 생성이 가능합니다.
