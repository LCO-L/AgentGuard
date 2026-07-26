> 🇰🇷 **한국어** | [🇺🇸 English](PRODUCTS.en.md)

# 📦 하나의 엔진, 여러 산출물 — AgentGuard 제품 지도

> **"입력만 바뀌지 엔진은 하나"**(명세) 를 패키징 축으로 확장한다.
> 탐지·판단·통역·마스킹 로직은 전부 `core/` + FastAPI(`api/`) 한 곳.
> 아래 산출물들은 **같은 엔진을 호출하는 프론트/패키징**일 뿐이다.

```
                    ┌──────────────────────────────┐
                    │   AgentGuard 엔진 (공통 두뇌)   │
                    │  core/  ·  api/(FastAPI /v1)   │
                    │  rulepacks 시나리오 레지스트리   │
                    └──────────────┬───────────────┘
        ┌───────────────┬──────────┼───────────┬─────────────────┐
        ▼               ▼          ▼           ▼                 ▼
  ① 설치형 온디바이스   ② 크롬 확장   ③ APK(안드로이드)  ④ VS Code 확장   (웹 대시보드/위젯)
   Ollama + web(UI)   extension/   web + Capacitor   vscode-extension  ui/*.html
```

## 산출물별 정의

### ① 설치형 온디바이스 (Ollama 기반) — 메인
- **완전 오프라인**: 로컬 FastAPI + 로컬 Ollama(qwen) + `web/`(Next.js UI).
- 원본·프롬프트가 **기기 밖으로 안 나감**. 판단 엔진도 로컬.
- 실행: `ollama serve` → `uvicorn api.main:app` → `web`(`npm run dev` 또는 정적 서빙).
- (선택) 데스크톱 창은 Tauri 로 `web` 을 래핑하면 "설치형 앱" 경험 완성.

### ② 크롬 익스텐션 — 완료
- `extension/` (MV3). 우클릭 즉시검사 · 인라인 하이라이트 · **AI 입력창 전송 인터셉트**.
- 온디바이스 경량 스캐너(`agscan.js`)로 백엔드 없이도 1차 방어, 상세는 로컬 API.

### ③ APK (안드로이드)
- `web/`(Next.js) 를 **Capacitor** 로 감싸 네이티브 앱으로 빌드(웹 UI 100% 재사용).
- 공유 시트(Web Share Target/네이티브 Share)로 "링크·문구를 꾹 눌러 검사".
- 빌드: `npm run build && next export` → `npx cap add android` → `cap sync` → Android Studio.
- (대안) 이미 PWA 라 TWA(bubblewrap) 로도 APK 생성 가능.

### ④ VS Code 익스텐션 (시간 남으면)
- 편집 중 코드/프롬프트를 `/v1/inspect` 로 검사 → 문제 구간에 diagnostics(밑줄).
- 시크릿·취약코드·과잉권한·인젝션을 IDE 안에서 바로 경고.

## 왜 이렇게 하나
- **엔진 재사용률 100%**: 새 산출물은 프론트만. 룰/시나리오는 `rulepacks` 한 곳에서 추가(데이터 한 줄).
- **온디바이스 일관성**: 어느 산출물이든 Ollama 로컬 판단 + 원문 비유출.
- **확장 로드맵**: 개인은 무료(확장·앱)로 쓰고, 팀·회사는 설치형과 중앙 정책 서버로 키워갑니다.
