# 🛡️ AgentGuard ULTRA

> **파일·AI도구·링크·페이지에 숨은 악의를, 인터넷 없이 내 기기 안에서 검사하고,
> 누구나 알아들을 한국어로 통역해 주는 온디바이스 통합 보안 엔진.**
>
> 포맷이 뭐든 하나의 위험표면(RiskSurface)으로 정규화 → 엔진 1개가 처리.
> 판단 엔진은 **온디바이스(Ollama) · Claude · OpenRouter** 중 UI에서 고릅니다.

## 무엇이 ULTRA인가

| 축 | 내용 |
|---|---|
| **온디바이스 AI** | 2층 의도분석·통역을 **Ollama(qwen)** 로컬 실행. Claude/OpenRouter도 UI에서 키만 넣어 전환. 셋 다 없어도 오프라인 규칙으로 항상 동작 |
| **보이지 않는 위협 실탐지** | 제로위드 스테가노를 **실제 디코딩**, 태그문자 밀수 복원, BiDi 위장, homoglyph(키릴·그리스) 라틴 정규화 후 재매칭 → "표현을 바꾼 우회"가 1층에서 무너짐 |
| **포맷 확장** | HWP·HWPX·DOCX·XLSX·PPTX·PDF·MCP·확장 manifest + **RTF·SVG·ZIP·SKILL.md/AGENTS.md/스크립트** |
| **대화형 보안 도우미** | 채널톡/Fin 스타일 플로팅 위젯 — 통역 카드 + "왜 위험해요?" 후속 대화(findings 근거, 인젝션 방어) |
| **Grammarly for Security** | AI에 보내기 **직전** 실시간 검사: PII·시크릿 **복원 가능 마스킹**, 취약 코드·과잉권한 룰팩, 밑줄+수정안 |
| **우클릭/공유/입력가드 UX** | 크롬 익스텐션 우클릭 즉시검사 + 인라인 하이라이트 + **AI 입력창 감시·전송 인터셉트**, 아이폰 공유시트(PWA) |
| **점수제** | 0–100 위험 점수 + 조합 부스트(다운로드+실행 등), Critical/High/Medium 등급 |

## 실행

```bash
uv sync                                   # 의존성 설치(표준 lib 위주, urllib로 LLM 호출 — 추가 SDK 불필요)
uv run python samples/make_samples.py     # 데모 샘플 생성(안전, 페이로드 없음)
uv run python app.py                      # 서버 기동 (http://localhost:8000)

# 온디바이스 판단(선택): Ollama 설치 후
#   ollama pull qwen3:8b && ollama serve
```

- 페이지(상단 네비로 이동): 대시보드 `/` · 보안 에디터 `/editor` · 비교 `/compare` · 시나리오 `/scenarios` · 설정 `/settings` · 위젯 데모 `/embed-demo`
- 크롬 익스텐션: **`/extension.zip` 다운로드** → 압축해제 후 `chrome://extensions`에서 로드 (또는 `extension/` 폴더, `extension/README.md`)
- 원클릭 설치형(온디바이스): `./install.sh` · 아이폰 공유시트: `docs/IOS_SHORTCUT.md`

## API (v1)

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/v1/scan` | 파일 스캔 (HWP·HWPX·DOCX·XLSX·PPTX·PDF·MCP·확장·RTF·SVG·ZIP·MD/스크립트) |
| POST | `/v1/scan/batch` | 배치 스캔 (최대 20개) |
| POST | `/v1/scan/url` | URL/링크 정적 분석 |
| POST | `/v1/scan/text` | 텍스트/페이지 본문 인젝션·은닉 검사 |
| POST | `/v1/inspect` | 실시간 span 인스펙션(PII·시크릿·취약코드·과잉권한·인젝션) — 에디터/익스텐션 |
| POST | `/v1/redact` | 복원 가능 마스킹(`[SECRET_1]`/`[PII_n]` + 매핑) |
| POST | `/v1/chat` | 대화형 보안 도우미(findings 근거) |
| GET | `/v1/ai/status` · `/v1/ai/models` · POST `/v1/ai/test` | 엔진 상태·모델목록·연결테스트 |
| GET | `/v1/scans` · `/v1/scans/{id}` · `/v1/rules` · `/v1/health` | 이력·룰·헬스 |

판단 엔진은 요청 헤더로 주입: `X-AI-Provider`, `X-AI-Key`, `X-AI-Model`, `X-Ollama-Url`
(키는 브라우저에만 저장, 서버 비저장).

### curl 예시

```bash
curl -F "file=@samples/evil.SKILL.md" localhost:8000/v1/scan
curl -X POST localhost:8000/v1/scan/url -H 'Content-Type: application/json' \
  -d '{"url":"http://naver.com@evil-login.top/verify"}'
curl -X POST localhost:8000/v1/scan/text -H 'Content-Type: application/json' \
  -H 'X-AI-Provider: ollama' -d '{"text":"..."}'
```

## CLI (CI 게이트)

```bash
python cli.py samples/*.pdf samples/*.mcp.json     # 종료코드 0/1/2 = green/yellow/red
find . -name '*.md' | python cli.py --stdin --fail-on yellow
```

## 아키텍처

```
api/        얇은 HTTP 껍데기 (입력검증→service 호출, 로직 없음)
services/   유스케이스 계층 (scan / url / text / chat / history)
core/       순수 엔진
  surface   ★ RiskSurface 통합 계약
  analyzer  1층 결정적 룰 (textnorm 정규화로 은닉/우회에도 매칭)
  textnorm  제로위드·태그문자·BiDi·homoglyph 실탐지
  pii       PII·시크릿 탐지 + 복원 가능 마스킹
  codescan  취약 코드·과잉권한 룰팩(+수정안)
  inspect   offset span 통합(실시간 밑줄 근거)
  scorer    0–100 점수 + 조합 부스트
  ai/       backend(3-provider) · intent · local_intent · interpret · rugpull
adapters/   포맷별 얇은 어댑터 (registry가 매직바이트로 자동 선택)
ui/         대시보드 · 보안에디터 · 설정 · 위젯(widget.js) · agscan · PWA
extension/  크롬 익스텐션(MV3) — 우클릭·인라인·AI 입력창 인터셉트
tests/      실작동 검증 스위트(unittest, 32 테스트)
```

**핵심 원칙:** 탐지=코드(1층), 판단·통역=AI(2·3층). 원본은 로컬만, AI엔 위험 메타만.
우리 앱도 남의 문서를 읽으므로 findings·발췌는 `[분석 데이터]`로 격리(프롬프트 인젝션 자기방어).

## 테스트

```bash
AG_AI_PROVIDER=off python -m unittest -v tests.test_ultra   # 32 테스트
```

## 배포 (GitHub → Railway)

`railway.json` 자동 인식: uv 빌드 → `uvicorn api.main:app` → `/v1/health` 헬스체크.
Variables에 `AG_AI_PROVIDER`, (선택) `ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY`, `AG_API_KEY` 설정.
