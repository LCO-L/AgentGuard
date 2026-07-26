> 🇰🇷 **한국어** | [🇺🇸 English](AIRGAP.en.md)

# 🔌 폐쇄망(에어갭) 운영 가이드 — 온디바이스의 경계선

> **핵심 답:** 모델 추론은 100% 온디바이스다. **"설치형(로컬 백엔드) + 로컬 Ollama" 조합이면
> 케이블을 뽑아도 검사→판단→통역→기록 전부 돈다.** 인터넷은 최초 반입 때만 필요하다.

## 1. 구성별 데이터 경계 (어느 조합이 폐쇄망인가)

| 조합 | 원문이 기기 밖으로? | 폐쇄망 | 비고 |
|---|---|---|---|
| **설치형 + Ollama** (권장) | **안 나감** | ✅ 완전 지원 | 규칙·AI 판단·통역·이력 전부 기기 안 |
| 확장 + 클라우드 백엔드 + Ollama 직결 | 규칙 검사분은 클라우드로 감 | ❌ | 통역만 로컬인 **편의 모드** — 폐쇄망 아님 |
| 확장 단독 (백엔드 없음) | 안 나감 | ✅ | agscan.js 규칙만 (AI 판단 없음) |

## 2. 인터넷이 필요한 순간 — 최초 1회 준비물뿐

1. **Ollama 설치 파일** (macOS zip / Windows zip / Linux tar.zst — 관리자 권한 없이 되는 경로 있음)
2. **모델 파일** ~2.5GB (기본: Qwen3 4B · unsloth 4bit)
3. **백엔드 의존성** — 파이썬 패키지(FastAPI 등). `pip download -r requirements.txt -d wheels/` 로
   미리 받아 반입하거나, venv 통째 복사

이후 운영은 **네트워크 0**. 업데이트도 같은 방식으로 반입.

## 3. 폐쇄망 반입 절차 (USB 반입 기준)

```bash
# ── 외부(인터넷 되는 곳)에서 준비 ──
# ① 저장소 + 의존성
git clone https://github.com/LCO-L/AgentGuard && cd AgentGuard
pip download -r requirements.txt -d wheels/
# ② Ollama 설치본 (OS에 맞게) — https://ollama.com/download
# ③ 모델 GGUF 직접 다운로드 (HuggingFace: unsloth/Qwen3-4B-Instruct-2507-GGUF, Q4_K_M)

# ── 폐쇄망 안에서 설치 ──
pip install --no-index --find-links wheels/ -r requirements.txt
# Ollama 설치 후:
cat > Modelfile <<'EOF'
FROM ./Qwen3-4B-Instruct-2507-Q4_K_M.gguf
EOF
ollama create qwen3-4b-local -f Modelfile     # 로컬 파일에서 모델 생성 — 레지스트리 불필요
AG_OLLAMA_MODEL=qwen3-4b-local python app.py  # http://localhost:8000
```

## 4. 폐쇄망 검증 방법 (도입 심사 시연용)

1. 네트워크 차단 (기내 모드 / 케이블 분리 / 방화벽 아웃바운드 전면 차단)
2. `python app.py` → 대시보드 열기 → 데모 칩 전부 실행 → 🔴/🟢 정상 판정 확인
3. 설정에서 온디바이스 연결 테스트 → `✓ 연결됨` 확인 (판단이 로컬 Ollama로)
4. `/audit` 에서 이력이 로컬에 쌓이는 것 확인
5. (선택) `AG_AI_PROVIDER=off python scripts/bench_scenarios.py` — 오프라인 상태에서 벤치 재현

## 5. 같이 알아둘 것

- **비저장 원칙은 로컬에서도 동일** — 원문·마스킹 매핑은 이력에 남지 않음(메타데이터만)
- 클라우드 폴백 없음이 걱정되면 `AG_AI_PROVIDER=ollama` 고정 — Claude/OpenRouter 시도 자체를 안 함
- 확장(브라우저)도 백엔드 주소를 `http://localhost:8000` 으로 두면 같은 폐쇄망 경계 안에서 동작
- 기업 도입 관점: 이 구성이 곧 **온프레미스 배포**다 — 단일 백엔드 + Ollama, 설치 하루면 충분
