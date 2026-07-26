> 🇰🇷 **한국어** | [🇺🇸 English](MASTER_STATUS.en.md)

# 📋 AgentGuard ULTRA — 마스터 상태 문서 (구현 완료 + 앞으로 할 것, 빠짐없이)

> 최종 갱신: 2026-07-21 · 이 문서 하나로 프로젝트 전체를 파악할 수 있게 정리했습니다.
> **핵심 명제:** *엔진은 하나(`core/` + FastAPI), 산출물은 3–4개(설치형·크롬확장·APK·VS Code).*

---

## 0. 한눈 요약

| 구분 | 상태 |
|---|---|
| 코어 엔진(탐지·판단·통역·마스킹) | ✅ 완료 · 실행 검증 |
| 시나리오 레지스트리(데이터 한 줄로 확장) | ✅ 완료 |
| 어댑터 11종(HWP·OOXML·PDF·MCP·확장·RTF·SVG·ZIP·텍스트/에이전트파일) | ✅ 완료 |
| AI 3-provider(Ollama·Claude·OpenRouter) + 오프라인 폴백 | ✅ 완료 |
| API 15 엔드포인트 | ✅ 완료 |
| 순수 HTML UI(대시보드·에디터·설정·위젯·PWA) | ✅ 완료 |
| 크롬 익스텐션(우클릭·인라인·입력가드) | ✅ 완료 |
| Next.js 웹(설치형/APK 공통 프론트) | ✅ **로컬 빌드·구동 검증 완료** (next 14.2.35 보안 패치, 4페이지 200, /api 프록시·위젯·PWA 확인) |
| CLI(CI 게이트) | ✅ 완료 |
| 테스트 35개 | ✅ 전부 통과 |
| 배포(Railway Nixpacks) | ✅ 빌드 오류 수정 |
| VS Code 확장 | ✅ 완료 (`vscode-extension/` — Diagnostics+마스킹, tsc 컴파일 통과) |
| 랜딩+온볼딩 투어 | ✅ 완료 (신호등 히어로·3단계 가이드·라이브 데모·확장 설치 CTA) |
| 확장 즉시 설치 | ✅ `/extension.zip`(즉석) + `/extension.crx`(CRX3 RSA 서명, `scripts/pack_extension.py`) |
| 확장 실시간 코치 완성 | ✅ 인라인 물결(타깃 사이트)·교정 카드[마스킹/제거/무시]·LLM 심층 계층+캐시·팝업 on/off/사이트별/차단 로그 |
| 온디바이스 원클릭 | ✅ `POST /v1/ai/ondevice/start` + 폴 백 상태 — **실측 qwen3-8b 통역 성공**(고객 기기에 직접 다운로드 구조) |
| OpenRouter 파이프라인 | ✅ 강화 (에러 표면화·폴 백 체인·reasoning 처리·**운영 500(content=null) 수정**·예외 격리) |
| 백신 비교뷰 | ✅ `/compare` — "같은 위험, 다른 이해" |
| 외부 CDN 제거 | ✅ Pretendard CDN·글꼴 차단 이슈 해소(시스템 폰트 스택, 오프라인·프라이버시 강화) |
| 테스트 | ✅ **46개 전부 통과** (기존 35 + OpenRouter 9 + 운영 재현 2) |
| APK (Capacitor) | 🟡 **프로젝트 생성·sync 완료** (`web/android/`, Share Intent 추가, 가이드 `docs/APK.md`) — APK 바이너리 빌드는 Android Studio 필요 |
| 설치형 패키징 | ✅ 원클릭 `install.sh` (Ollama 확인→모델 pull→실행→브라우저 오픈) / Tauri는 컷라인 보류 |

**검증 수치:** unittest 35 통과 · v1 엔드포인트 15 · 순수 JS 문법 9/9 · Ollama 없이도 오프라인 규칙으로 전 기능 동작.

---

## 1. 산출물 지도 (엔진 1개 · 프론트 여러 개)

```
        core/ + api/(FastAPI /v1) + rulepacks 시나리오 레지스트리   ← 공통 두뇌
   ┌──────────────┬───────────────┬──────────────┬─────────────────┐
   ① 설치형 온디바이스   ② 크롬 확장     ③ APK(안드로이드)   ④ VS Code 확장
   Ollama+web(Next)   extension/    web+Capacitor    vscode-extension(예정)
```
자세한 내용: `docs/PRODUCTS.md`

---

## 2. 저장소 전체 구조 (파일별)

### 코어 엔진 `core/`
| 파일 | 역할 |
|---|---|
| `surface.py` | ★ RiskSurface 통합 계약(Capability 6종) |
| `model.py` | Finding / InterpretedCard / Verdict (+score/weight/engine) |
| `analyzer.py` | 1층 결정적 룰 엔진(textnorm 정규화로 은닉/우회 매칭) |
| `signatures.py` | 1층 룰 카탈로그(데이터) |
| `scorer.py` | 0–100 점수 + 조합 부스트 |
| `util.py` | 엔트로피·매직바이트·URL·해시 |
| `textnorm.py` | 제로위드 스테가노 실디코딩·태그문자·BiDi·homoglyph 정규화 |
| `pii.py` | PII·시크릿 탐지 + 복원 가능 마스킹([SECRET_1]/[PII_n]+매핑) |
| `codescan.py` | 취약코드·과잉권한(→ scenarios_data 의 호환 뷰) |
| `inspect.py` | offset span 통합(레지스트리 기반) — 에디터/익스텐션 근거 |

### 시나리오 레지스트리 `core/rulepacks/`
| 파일 | 역할 |
|---|---|
| `base.py` | Scenario / Hit dataclass + 확장 방법 명시 |
| `scenarios_data.py` | ★ 정규식 시나리오 24개(inject7·vuln11·agency6) — **여기 한 줄 추가** |
| `regex_pack.py` | 선언형 시나리오 → offset span |
| `secret_pack.py` | pii 를 Hit 으로 |
| `stego_pack.py` | textnorm 은닉/닮은꼴 → Hit |
| `registry.py` | 팩 수집·scan·catalog·stats (새 팩 = PACKS 한 줄) |

### AI 계층 `core/ai/`
| 파일 | 역할 |
|---|---|
| `backend.py` | urllib 통합 LLM(Ollama/Claude/OpenRouter) + resolve_config·probe·list_models·test_connection |
| `intent.py` | 2층 의도 분석(LLM 우선 → 오프라인 폴백) |
| `local_intent.py` | 오프라인 결합(공기) 의도 엔진 |
| `interpret.py` | 통역 카드(LLM 우선, i18n 폴백) |
| `rugpull.py` | 3층 러그풀 지문 비교 |

### 어댑터 `adapters/` (11종)
`base.py`·`registry.py` + `hwp_ole.py`·`hwpx.py`·`ooxml.py`·`pdf.py`(폴리글랏)·`mcp.py`·`extension.py`·`rtf.py`·`svg.py`·`archive.py`(zip-slip/이중확장자)·`textfile.py`(SKILL.md·AGENTS.md·스크립트)

### 서비스 `services/`
`scan_service.py`·`url_service.py`·`text_service.py`·`inspect_service.py`·`chat_service.py`·`history_service.py`

### API `api/`
`main.py`·`deps.py`(AIConfig 헤더 파서) + `routes/`: `scan`·`url`·`text`·`inspect`·`chat`·`ai`·`history`·`rules`·`health`

### 순수 HTML UI `ui/`
`dashboard.html`·`editor.html`·`settings.html`·`widget.js`(임베드 위젯)·`agscan.js`(온디바이스 스캐너)·`agconfig.js`(설정 공유)·`embed-demo.html`·`manifest.webmanifest`·`sw.js`·`icon.svg`

### 크롬 익스텐션 `extension/`
`manifest.json`·`background.js`·`content.js`·`inputguard.js`·`agscan.js`·`popup.html`·`popup.js`·`README.md`

### Next.js 웹 `web/`
설정: `package.json`·`tsconfig.json`·`next.config.mjs`·`tailwind.config.ts`·`postcss.config.mjs`·`.env.local.example`
`app/`: `layout.tsx`·`globals.css`·`page.tsx`·`editor/`·`settings/`·`scenarios/`
`components/`: `ui.tsx`·`TopNav`·`EngineIndicator`·`RiskCard`·`SecurityEditor`·`CoachPanel`
`lib/`: `types.ts`·`config.ts`·`api.ts`·`cn.ts`

### 기타
`cli.py`(CI 게이트) · `samples/make_samples.py` · `tests/test_ultra.py`(35) · `app.py` · `railway.json`·`Procfile`·`.python-version`·`pyproject.toml`·`requirements.txt`

---

## 3. 구현 완료 상세

### 3.1 탐지·통역(엔진)
- **포맷 무관 정규화**: 어떤 입력도 RiskSurface(6 Capability)로 환원 → 룰·통역 100% 재사용.
- **은닉/우회 실탐지**: 제로위드 스테가노를 **실제 디코딩**(`send id_rsa` 복원), 태그문자 밀수 복원, BiDi 위장, homoglyph(키릴·그리스) 라틴 정규화 후 재매칭. 모든 1층 룰이 우회에 강해짐.
- **점수제**: severity 가중치 + 조합 부스트(다운로드+실행, 은닉명령+유출 등) → 0–100.
- **3층 방어**: 1층 룰 · 2층 AI 의도 · 3층 러그풀(지문 diff).

### 3.2 SecureType(전송 전 실시간 검사)
- **PII·시크릿 복원 가능 마스킹**: OpenAI/AWS/GitHub/JWT 키·주민번호·카드(Luhn)·전화·이메일 → `[SECRET_1]`/`[PII_n]` + 매핑(복원 == 원본 검증).
- **취약 코드·과잉권한**: eval·문자열결합 SQL·CORS *·pickle·shell=True·verify=False·rm -rf·DROP TABLE·chmod 777·curl|bash + 수정안(fix/suggestion).
- **offset span 통합**(`/v1/inspect`) + 마스킹(`/v1/redact`).

### 3.3 시나리오 레지스트리(확장성)
- 새 공격 유형 = `scenarios_data.SCENARIOS` 에 Scenario(...) **한 줄**, 또는 새 팩 파일 + `registry.PACKS` 한 줄.
- 테스트로 증명: "조부모 탈옥" 시나리오를 한 줄 추가 → 코드 수정 0으로 즉시 탐지.
- 카탈로그 가시화: `GET /v1/scenarios`.

### 3.4 AI 3-provider
- Ollama(온디바이스)·Claude·OpenRouter 를 urllib 한 입구로. provider/키를 **요청 헤더로 런타임 주입**(서버 비저장).
- 상태 감지(`/v1/ai/status`)·모델 목록(`/v1/ai/models`)·연결 테스트(`/v1/ai/test`).
- 셋 다 없으면 오프라인 규칙/결합엔진으로 항상 동작.

### 3.5 API(15 엔드포인트)
`POST /v1/scan` · `/v1/scan/batch` · `/v1/scan/url` · `/v1/scan/text` · `/v1/inspect` · `/v1/redact` · `/v1/chat`
`GET /v1/scenarios` · `/v1/ai/status` · `/v1/ai/models` · `POST /v1/ai/test`
`GET /v1/scans` · `/v1/scans/{id}` · `/v1/rules` · `/v1/health`
페이지/에셋: `/` `/editor` `/settings` `/embed-demo` `/widget.js` `/agscan.js` `/agconfig.js` `/manifest.webmanifest` `/sw.js` `/icon.svg`

### 3.6 UX 산출물
- **대시보드**(순수 HTML + Next.js): 파일·텍스트·링크 통합 검사 + 통역 카드.
- **보안 에디터**(순수 HTML + Next.js): 500ms 디바운스 실시간 밑줄 + 코치 카드 + 마스킹 + 안전하게 전송.
- **대화형 위젯**(`widget.js`): 채널톡/Fin 스타일 + 실시간 페이지 인라인 하이라이트 + 후속 대화.
- **크롬 익스텐션**: 우클릭 즉시검사 · 인라인 하이라이트 · **AI 입력창 전송 인터셉트**(마스킹 후 전송) · 다운로드 가로채기.
- **PWA**: 아이폰 공유시트(Web Share Target) + iOS 단축어 가이드.
- **설정 페이지**: 3-엔진 지능적 설정(상태·모델·테스트).

### 3.7 검증
- **테스트 35개** 전부 통과(엔진·어댑터·서비스·대화·인젝션방어·PII·코드·인스펙션·레지스트리 확장성).
- **CLI 게이트**: 악성 9종 red, 정상 green, exit code 2 확인.
- **AGScan node 검증**: 스테가노 디코딩·PII·마스킹 복원.
- **전 엔드포인트 ASGI 검증**(소켓 바인딩 막힌 환경 → in-process).

---

## 4. 앞으로 할 것 (TODO — 우선순위)

### 🔴 P1 — Next.js 로컬 검증·마무리
- [ ] `cd web && npm install && npm run dev` 로 **실제 빌드·구동 확인**(이 샌드박스에선 npm/소켓 차단으로 미검증).
- [ ] 타입 오류·import 경로 최종 점검(`npm run build`).
- [ ] 위젯(`widget.js`)을 Next.js 페이지에도 마운트(전 페이지 상시 보안 도우미).
- [ ] Next.js 에 PWA(manifest/sw) 연결 확인, 반응형 미세 조정.
- [ ] (선택) 대화형 위젯을 React 컴포넌트로 이식.

### 🟠 P2 — APK (안드로이드)
- [ ] `web` 에 `next.config` output 조정 or Capacitor 웹뷰 방식 결정.
- [ ] `npx cap init/add android/sync` → Android Studio 빌드.
- [ ] 네이티브 공유 시트(Share Intent) → `/v1/scan/*` 연결.
- [ ] (대안) PWA → TWA(bubblewrap)로 APK.

### 🟡 P3 — VS Code 익스텐션 (시간 남으면)
- [ ] `vscode-extension/`: `package.json`(contributes) + `extension.ts`.
- [ ] 편집 중 문서를 `/v1/inspect` → Diagnostics(밑줄) + CodeAction(수정 제안).
- [ ] 시크릿/취약코드/과잉권한/인젝션을 IDE 안에서 경고.

### 🟢 P4 — 설치형 온디바이스 패키징
- [ ] 원클릭 스크립트(`install.sh`): Ollama 확인 → 모델 pull → 백엔드 실행 → 웹 오픈.
- [ ] (선택) Tauri 로 `web` 을 감싼 데스크톱 앱(설치형 창).
- [ ] Ollama 미설치 안내 UX.

### ⚪ P5 — 품질·확장
- [ ] 사이트별(ChatGPT/Claude) 전송 인터셉트 정밀화(전송 버튼 셀렉터).
- [ ] 이미지/스크린샷 OCR 후 인젝션 검사(멀티모달 공격 대응).
- [ ] 다국어(영어) 통역·카피.
- [ ] 시나리오 카탈로그 관리 UI(추가/토글).
- [ ] 성능: 대용량 텍스트 스트리밍 인스펙션.
- [ ] 기업용: 정책 서버(허용/차단 룰 중앙 관리), 감사 로그.

---

## 5. 실행 방법 총정리

```bash
# 백엔드(엔진)
uv sync && uv run python samples/make_samples.py && uv run python app.py   # :8000
# (온디바이스) ollama serve && ollama pull qwen3:8b

# 웹(Next.js)
cd web && npm install && npm run dev                                        # :3000

# 크롬 익스텐션
chrome://extensions → 개발자 모드 → extension/ 로드

# 원클릭 설치형
./install.sh                    # Ollama 확인 → 모델 pull → 백엔드 → 브라우저 오픈

# VS Code 익스텐션
cd vscode-extension && npm install && npm run compile   # → F5로 Extension Host 디버그

# APK (Capacitor) — 자세히 docs/APK.md
cd web && CAPACITOR_BUILD=1 NEXT_PUBLIC_API_ABSOLUTE=https://<백엔드> npm run build
npx cap sync android && npx cap open android            # Android Studio에서 빌드

# CLI
python cli.py samples/*.pdf --fail-on yellow

# 테스트
AG_AI_PROVIDER=off python -m unittest tests.test_ultra                      # 35개
```

---

## 6. 태스크 보드

| # | 태스크 | 상태 |
|---|---|---|
| 1 | 프로젝트 복사(→ 원본 sandbox_4 작업으로 전환) | ✅ |
| 2 | core 엔진 ULTRA(textnorm·룰·스코어러) | ✅ |
| 3 | AI 계층(Ollama/Claude/OpenRouter + 로컬 의도) | ✅ |
| 4 | 어댑터 4종 추가(zip·svg·rtf·script/skill) | ✅ |
| 5 | URL 강화 + 텍스트 스캔 + 대시보드 + CLI | ✅ |
| 6 | 샘플 확장 + 테스트 + 검증 + README | ✅ |
| 7 | 크롬 익스텐션(우클릭·인라인·다운로드) | ✅ |
| 8 | 대화형 보안 위젯(Fin/채널톡) | ✅ |
| 9 | PII·시크릿 마스킹 엔진 | ✅ |
| 10 | 취약코드·과잉권한 룰팩 | ✅ |
| 11 | Span 인스펙션 + /v1/inspect·/v1/redact | ✅ |
| 12 | 실시간 웹 보안 에디터 | ✅ |
| 13 | 익스텐션 AI 입력창 인터셉트 | ✅ |
| 14 | 시나리오 레지스트리(데이터 한 줄 확장) | ✅ |
| 15 | Next.js 프론트엔드(노먼 원칙) | ✅ 로컬 검증 완료(보안 패치·위젯·PWA 마운트) |
| 16 | APK(Capacitor) | 🟡 프로젝트·sync·Share Intent 완료, 바이너리 빌드는 로컬(가이드 `docs/APK.md`) |
| 17 | VS Code 익스텐션 | ✅ 완료(컴파일 통과) |
| 18 | 설치형 패키징(스크립트) | ✅ `install.sh` 완료(Tauri는 보류) |

---

## 7. 알려진 제약 / 주의
- 이 개발 샌드박스는 **npm install(네트워크)·소켓 바인딩 차단** → Next.js 빌드/구동, 실서버 기동은 로컬에서 확인해야 함. 백엔드 로직은 in-process ASGI + unittest 로 검증 완료.
- Ollama 는 **로컬 실행용**. 클라우드 배포 환경엔 Ollama 가 없으므로 Claude/OpenRouter 또는 오프라인 규칙으로 동작.
- 배포: **백엔드 = Railway(Nixpacks pip)**, **웹 = Vercel 등 별도** 권장(또는 web 정적 export 를 백엔드가 서빙).
- 데모 샘플은 **실제 페이로드 없음**(탐지 신호만). PII/시크릿 데모 값도 가짜.
- 마스킹 매핑·원문은 서버에 저장하지 않음(비저장 원칙).

---

## 8. UI 통합·라우팅 점검 (2026-07-21 추가)

여러 트랙(비교 시연·확장 배포·설치형·VS Code)이 각각 완성됐지만 **순수 HTML UI에서 서로 링크로
연결되지 않아** 사용자가 발견·이동할 수 없던 문제를 통합했다. (기능은 모두 이미 작동)

### 한 것
- **`ui/nav.js` 통합 상단 네비게이션** 신설 — 모든 순수 HTML 페이지에 `<script src="/nav.js">` 한 줄로
  주입(fixed 바 + body 여백 자동). 검사·에디터·비교·시나리오·설정 + **확장 설치 다운로드** 버튼.
- **`ui/scenarios.html`** 신설(순수 HTML 시나리오 카탈로그) + `GET /scenarios` 라우트.
- `main.py`: `/nav.js`·`/scenarios` 라우트 추가, `/api` 인덱스에 신규 엔드포인트·페이지·다운로드 반영.
- `dashboard/settings/compare/scenarios` 에 nav.js 연결, `editor` 는 자체 상단바에 링크(풀스크린 레이아웃 보존).
- Next.js `TopNav` 버그 수정(검사 링크 `/scan`→`/`) + 비교(`/api/compare`)·확장 다운로드(`/api/extension.zip`) 링크.

### 검증 (in-process ASGI)
- 페이지·에셋 **12개 전부 200**: `/ /editor /compare /scenarios /settings /embed-demo /nav.js
  /agconfig.js /widget.js /extension.zip /extension.crx /manifest.webmanifest`
- 모든 순수 HTML 페이지에 nav.js 주입 확인 · 에디터 자체 네비 확인.
- **v1 엔드포인트 17개** · **unittest 35 통과** · `scripts/pack_extension.py` 문법 OK · `vscode-extension/out/extension.js` 빌드 확인.

### Railway (배포) 주의
- `railway.json`: builder=NIXPACKS, buildCommand 가 `python scripts/pack_extension.py`(실패 시 `|| echo` 로 배포 계속),
  startCommand `python -m uvicorn api.main:app`, healthcheck `/v1/health`.
- `dist/` 는 `.gitignore` 대상 → **빌드 시 buildCommand 가 재생성**. openssl 없으면 CRX 생략, `/extension.zip` 은
  `main.py` 가 항상 즉석 생성하므로 확장 배포는 무중단.
- Railway **Variables** 권장: `AG_AI_PROVIDER`(기본 auto), 선택 `ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY`, `AG_API_KEY`.
- 순수 HTML UI 전부를 FastAPI 가 서빙하므로 백엔드 1개 배포로 대시보드·에디터·비교·시나리오·설정·확장다운로드가 모두 동작.
  (Next.js `web/` 는 로컬/Vercel 별도)

---

## 9. 2026-07-25 세션 — UI/UX 총정비 + MIT 오픈소스 전환

### UI/UX (순수 HTML 전 페이지 디자인 시스템 통일 — 대시보드 토큰 기준)
- `nav.js`: 이모지 → SVG 스트로크 아이콘, 글래스 바, 활성 상태·모바일 대응 강화
- `dashboard`: 전역 드래그&드롭 오버레이 · URL Enter/텍스트 ⌘⏎ 단축키 · 스피너/에러 상태 · 점수 카운트업
- `editor`: 전면 리스킨(로직 보존) + 위험 게이지 · 글자수 · ⌘⏎ 전송 · 코치 카드 스태거 애니메이션
- `settings`·`scenarios`·`compare`: 리스킨. 시나리오엔 **검색+심각도/분류 필터**, 비교엔 **파일 없이 데모 칩**(scan/text)
- `audit`: 등급 필터(카드/칩) + **CSV 내보내기**
- `onboarding`: 매번 강제 시작 버그 → 첫 방문만(?tour=1·? 버튼은 언제든), sw 캐시 v2

### MIT 오픈소스 전환 (서비스와 동시 공개 준비)
- LICENSE=MIT · NOTICE/AUTHORS 갱신(만든 사람 이동훈/DONGHUN LEE 표기 유지 — MIT가 고지 보존 요구)
- 소스 헤더 67파일 일괄 전환(`scripts/relicense_mit.py`) · `_authorship.py`/응답 헤더 MIT 표기
- pyproject·web/package.json license 필드 · README 라이선스/기여 섹션
- "Grammarly" 브랜드 표현 전량 제거(공개 파일 기준 0건)
- GitHub 거버넌스: CI 4잡(테스트/CLI 게이트/JS 문법/API 스모크) · CODEOWNERS · PR/이슈 템플릿
  (빈 이슈 금지) · CONTRIBUTING · SECURITY(BYOK 명시) · `docs/OPEN_SOURCE.md` 공개 체크리스트
- 문서 스크리닝: 내부 문서 7종 `.gitignore` 공개 제외(이 문서 포함)

### 검증
- unittest 46/46 · 전 페이지/엔드포인트 21개 200(ASGI) · 외부+인라인 JS 문법 전부 통과 · CI yaml 파싱 OK

