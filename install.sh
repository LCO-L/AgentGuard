#!/usr/bin/env bash
# 🛡️ AgentGuard 원클릭 설치·실행 스크립트 (macOS/Linux)
# 순서: Ollama 확인 → 모델 pull → uv sync → 백엔드 실행 → 브라우저 오픈
set -euo pipefail

cd "$(dirname "$0")"

say()  { printf "\033[1;36m[AgentGuard]\033[0m %s\n" "$1"; }
warn() { printf "\033[1;33m[AgentGuard]\033[0m %s\n" "$1"; }

# ── 1. uv 확인 ──────────────────────────────────────────
if ! command -v uv >/dev/null 2>&1; then
  say "uv 설치 중…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
say "uv $(uv --version | awk '{print $2}') 확인"

# ── 2. 온디바이스 AI (Ollama) 원클릭: 설치 → 서버 실행 → 소형 모델 ──
# 소형·빠른 모델을 기본값으로(원클릭 데모용). 더 큰 모델은 AG_INSTALL_MODEL 로 지정.
MODEL="${AG_INSTALL_MODEL:-qwen2.5:3b}"
AI_NOTE=""

# 2-1. Ollama 미설치면 자동 설치 (OS 감지)
if ! command -v ollama >/dev/null 2>&1; then
  say "Ollama 미설치 → 자동 설치 시도…"
  if [ "$(uname)" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      brew install ollama || warn "brew 설치 실패 — 수동 설치 필요"
    else
      warn "Homebrew가 없어요. https://ollama.com/download 에서 앱 설치 후 다시 실행하면 온디바이스로 동작합니다."
    fi
  else
    curl -fsSL https://ollama.com/install.sh | sh || warn "Ollama 설치 실패"
  fi
fi

# 2-2. 서버 실행 + 소형 모델 준비
if command -v ollama >/dev/null 2>&1; then
  if ! curl -s --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1; then
    say "Ollama 서버 시작(백그라운드)…"
    (ollama serve >/dev/null 2>&1 &) || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      curl -s --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1 && break
      sleep 1
    done
  fi
  if ! ollama list 2>/dev/null | grep -q "${MODEL%%:*}"; then
    say "온디바이스 소형 모델 다운로드: $MODEL (최초 1회)"
    ollama pull "$MODEL" || warn "모델 다운로드 실패 — 오프라인 규칙으로 계속 진행"
  fi
  # 백엔드가 이 소형 모델을 온디바이스로 사용하도록
  export AG_OLLAMA_MODEL="$MODEL"
  export AG_AI_PROVIDER="${AG_AI_PROVIDER:-ollama}"
  AI_NOTE="🖥️ 온디바이스 AI ($MODEL)"
else
  warn "Ollama 미설치/미가동 — ⚙️ 오프라인 규칙 엔진으로 동작합니다(전 기능 사용 가능)."
  AI_NOTE="⚙️ 오프라인 규칙 엔진"
fi

# ── 3. 의존성 설치 ──────────────────────────────────────
say "의존성 동기화(uv sync)…"
uv sync --quiet

# ── 4. 데모 샘플 준비 ───────────────────────────────────
if [ ! -f samples/evil.pdf ]; then
  say "데모 샘플 생성…"
  uv run python samples/make_samples.py >/dev/null
fi

# ── 5. 실행 ─────────────────────────────────────────────
PORT="${PORT:-8000}"
say "엔진: $AI_NOTE"
say "백엔드 시작: http://localhost:$PORT  (대시보드: / · 에디터: /editor · 설정: /settings)"
sleep 1
( sleep 2; open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || true ) &
exec uv run uvicorn api.main:app --host 0.0.0.0 --port "$PORT"
