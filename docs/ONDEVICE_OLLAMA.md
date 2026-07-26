> 🇰🇷 **한국어** | [🇺🇸 English](ONDEVICE_OLLAMA.en.md)

# 🖥️ 온디바이스 AI (Ollama) — 설정 & 트러블슈팅

> AgentGuard의 2층(의도 분석)·통역·대화를 **인터넷 없이 내 컴퓨터 안에서** 돌립니다.
> 원본·프롬프트가 기기 밖으로 나가지 않는 것이 온디바이스 모드의 핵심입니다.
> **Ollama가 없어도** 오프라인 규칙 엔진으로 모든 기능이 동일하게 작동합니다(품질만 상향).

## 1. 설치 (3단계)

```bash
# 1) Ollama 설치 — https://ollama.com  (또는)
curl -fsSL https://ollama.com/install.sh | sh

# 2) 서버 실행(보통 설치 시 자동 시작. 아니면)
ollama serve      # http://localhost:11434

# 3) 모델 내려받기(최초 1회, 4bit 소형 ~2.5GB)
ollama pull hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M
```

### 🟢 가장 쉬운 길 — 버튼 하나 (수동 설치 불필요)

`/settings`의 **[온디바이스 실행]** 버튼을 누르면 **클릭 즉시** 아래가 전부 자동 진행됩니다(진행률 표시):

1. **Ollama 설치** — `brew`가 있으면 brew로, 없으면 **공식 배포본을 직접 내려받아**(`~/.agentguard/`) 실행 파일 확보 → *Homebrew가 없어도 됩니다*
2. **`ollama serve` 자동 기동**
3. **Qwen3 4B(unsloth 4bit ~2.5GB) 자동 pull** — 이미 받은 채팅 모델이 있으면 그걸로 즉시 시작(추가 다운로드 없음)
4. **준비 완료** → 온디바이스로 검사

> 설치형(내 컴퓨터에서 실행)에서 100% 자동. 클라우드 배포는 GPU·권한 한계로 성공이 환경에 따라 다릅니다.
> 터미널에서 `./install.sh` 로 띄우면 이 버튼이 로컬 권한으로 완결됩니다.

## 2. AgentGuard에서 켜기

1. `/settings` (또는 대시보드 우상단 엔진 배지) 열기
2. **🖥️ 온디바이스(Ollama)** 카드 선택
3. **[연결 테스트]** → `✓ 연결됨 · NNms · qwen3:8b` 가 뜨면 준비 완료
4. 모델 드롭다운은 **설치된 모델을 자동으로** 불러옵니다(↻ 버튼)

> 설정은 브라우저(localStorage)에만 저장되고, 대시보드·에디터·위젯이 함께 사용합니다.
> 크롬 익스텐션은 팝업에서 별도로 `온디바이스` 선택 + 서버 주소를 지정합니다.

## 3. 코드가 이미 처리하는 것 (신경 안 써도 됨)

| 항목 | 처리 |
|---|---|
| **qwen3 thinking 토큰** | `think: false` 로 추론을 끄고 답만 받음(빈 응답 방지). 구형 Ollama는 `thinking` 필드로 폴백 |
| **긴 입력 잘림** | `num_ctx=8192`(환경변수 `AG_OLLAMA_NUM_CTX`로 조절) — findings·문서 텍스트가 잘리지 않음 |
| **모델 자동 선택** | 지정 모델(`qwen3:8b`)이 없으면 설치된 채팅 모델(8B급 우선) 자동 사용, 임베딩 모델 제외 |
| **모델 미설치(404)** | 다른 설치 모델로 1회 자동 재시도 |
| **JSON 파싱** | 코드펜스·잡설이 섞여도 `extract_json`이 첫 JSON 오브젝트를 관대하게 추출 |
| **연결 실패** | 자동으로 오프라인 규칙 엔진으로 폴백(데모 무중단) |

## 4. 환경변수

```bash
AG_AI_PROVIDER=ollama                 # 기본 판단 엔진(요청 헤더가 우선)
AG_OLLAMA_URL=http://localhost:11434  # Ollama 주소
AG_OLLAMA_MODEL=hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M  # 기본 모델(4bit 소형 ~2.5GB)
AG_OLLAMA_NUM_CTX=8192               # 컨텍스트 길이(긴 문서면 늘리기)
AG_AI_TIMEOUT=20                     # 초. 대형 모델 첫 응답이 느리면 늘리기
```

## 5. 트러블슈팅

| 증상 | 원인 · 해결 |
|---|---|
| 연결 테스트 `✗ 연결 실패` | `ollama serve` 실행 여부·포트(11434) 확인. 원격이면 `AG_OLLAMA_URL` 지정 |
| 판단이 `⚙️ 오프라인 규칙`으로만 뜸 | Ollama 미연결 → 규칙으로 폴백된 것. 위 연결 테스트부터 |
| 응답이 비거나 이상함 | 대개 thinking 문제 → 코드가 `think:false`로 처리. 그래도면 `ollama pull qwen3:8b`로 재설치 |
| 첫 응답이 아주 느림 | 모델 최초 로드(콜드스타트). `AG_AI_TIMEOUT` 늘리거나 작은 모델(`qwen3:4b`) 사용 |
| 긴 문서에서 판단이 엉뚱 | `AG_OLLAMA_NUM_CTX=16384` 로 상향 |
| 메모리 부족 | 더 작은 모델(`qwen3:4b`, `llama3.2:3b`) 선택 — 설정에서 자동 인식 |

## 6. 추천 모델

| 용도 | 모델 | 비고 |
|---|---|---|
| 기본(온디바이스) | `hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M` | Qwen3 4B Instruct·4bit ~2.5GB · 한국어·JSON 양호 · non-thinking이라 빠름 |
| 더 빠름/가벼움 | `llama3.2:3b`, `qwen2.5:1.5b` | 속도·메모리 우선 |
| 고품질 | `qwen2.5:7b`, `qwen3:8b` 이상 | 메모리 여유 시 |

> 어떤 모델이든 설치돼 있으면 AgentGuard가 자동 인식합니다. 클라우드(Claude·OpenRouter)와 언제든 전환 가능하고, 셋 다 없어도 오프라인 규칙으로 동작합니다.
