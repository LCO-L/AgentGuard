"""온디바이스 원클릭 실행 — Ollama 자동 기동 + 모델 자동 pull.

버튼 하나로: ① ollama 설치 확인 → ② serve 기동 → ③ 8B 모델 pull(진행률 추적) → ④ 사용 준비.
상태는 프로세스 내 싱글턴으로, 프론트가 1초 폴 백으로 진행률을 표시.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
import urllib.request

DEFAULT_MODEL = os.environ.get("AG_OLLAMA_MODEL", "qwen3:8b")
OLLAMA_URL = os.environ.get("AG_OLLAMA_URL", "http://localhost:11434")

_state: dict = {
    "state": "idle",      # idle|checking|starting|pulling|ready|error|no_ollama
    "progress": 0,        # 0~100 (pull 진행률)
    "message": "",
    "model": DEFAULT_MODEL,
}
_lock = threading.Lock()
_proc: subprocess.Popen | None = None


def status() -> dict:
    with _lock:
        return dict(_state)


def _set(**kw) -> None:
    with _lock:
        _state.update(kw)


def _ollama_alive() -> bool:
    try:
        with urllib.request.urlopen(OLLAMA_URL + "/api/tags", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _installed_models() -> list[str]:
    try:
        with urllib.request.urlopen(OLLAMA_URL + "/api/tags", timeout=3) as r:
            data = json.loads(r.read())
        return [m.get("name") or m.get("model", "")
                for m in data.get("models", []) if (m.get("name") or m.get("model"))]
    except Exception:
        return []


def _model_installed(model: str) -> bool:
    installed = _installed_models()
    return model in installed or f"{model}:latest" in installed


def _best_installed(model: str) -> str | None:
    """요청 모델이 없으면 설치된 채팅 모델 중 최적(8B급 우선, 임베딩 제외)."""
    installed = [n for n in _installed_models() if "embed" not in n.lower()]
    if not installed:
        return None
    big = [n for n in installed if "8b" in n.lower()]
    return big[0] if big else installed[0]


def start(model: str | None = None) -> dict:
    """비동기로 온디바이스 준비 시작. 현재 상태를 즉시 반환."""
    model = model or DEFAULT_MODEL
    with _lock:
        if _state["state"] in ("checking", "starting", "pulling"):
            return dict(_state)  # 이미 진행 중
        _state.update({"state": "checking", "progress": 0,
                       "message": "Ollama 확인 중…", "model": model})
    threading.Thread(target=_run, args=(model,), daemon=True).start()
    return status()


def _install_ollama() -> bool:
    """Ollama 자동 설치(로컬 전용). macOS=Homebrew, Linux=공식 설치 스크립트."""
    import platform
    try:
        if platform.system() == "Darwin":
            if not shutil.which("brew"):
                return False  # Homebrew 없음 → GUI 앱 수동 설치 안내
            subprocess.run(["brew", "install", "ollama"],
                           check=True, capture_output=True, timeout=900)
        else:  # Linux 등
            subprocess.run("curl -fsSL https://ollama.com/install.sh | sh",
                           shell=True, check=True, capture_output=True, timeout=900)
        return shutil.which("ollama") is not None
    except Exception:
        return False


def _run(model: str) -> None:
    global _proc
    try:
        # ① 설치 확인 → 없으면 자동 설치
        if not shutil.which("ollama"):
            _set(state="starting", progress=2,
                 message="Ollama 자동 설치 중… (최초 1회, 수 분 걸릴 수 있어요)")
            if not _install_ollama() or not shutil.which("ollama"):
                _set(state="no_ollama", progress=0,
                     message="자동 설치를 완료하지 못했어요. https://ollama.com 에서 "
                             "설치 후 다시 눌러주세요. (설치 없이도 오프라인 규칙으로 동작해요)")
                return
            _set(progress=4, message="Ollama 설치 완료 ✓ 실행 준비 중…")

        # ② serve 기동
        if not _ollama_alive():
            _set(state="starting", progress=5, message="Ollama 실행 중…")
            _proc = subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            import time
            for i in range(30):
                if _ollama_alive():
                    break
                time.sleep(0.5)
                _set(progress=5 + i, message="Ollama 실행 대기 중…")
            if not _ollama_alive():
                _set(state="error", message="Ollama 서버가 뜨지 않았어요. "
                                            "터미널에서 `ollama serve`를 확인하세요.")
                return

        # ③ 모델 준비 — 설치됨 → 즉시 / 비슷한 채팅 모델 있음 → 그걸로 즉시 / 없음 → pull
        if _model_installed(model):
            _set(state="ready", progress=100, model=model,
                 message=f"준비 완료! {model} 온디바이스로 동작해요 🖥️")
            return
        alt = _best_installed(model)
        if alt:
            _set(state="ready", progress=100, model=alt,
                 message=f"준비 완료! 설치된 {alt} 모델로 바로 시작해요 🖥️ "
                         f"(추가 다운로드 없음)")
            return

        _set(state="pulling", progress=10,
             message=f"{model} 다운로드 중… (최초 1회)")
        proc = subprocess.Popen(
            ["ollama", "pull", model],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        assert proc.stdout is not None
        buf = ""
        while True:
            ch = proc.stdout.read(1)
            if not ch:
                break
            buf += ch
            if ch in ("\r", "\n"):
                m = re.search(r"(\d{1,3})\s?%", buf)
                if m:
                    pct = min(99, int(m.group(1)))
                    _set(progress=max(10, pct),
                         message=f"{model} 다운로드 중… {pct}%")
                buf = ""
        rc = proc.wait()
        if rc == 0 and _model_installed(model):
            _set(state="ready", progress=100,
                 message=f"준비 완료! {model} 온디바이스로 동작해요 🖥️")
        else:
            _set(state="error", message="모델 다운로드에 실패했어요. 네트워크를 확인하세요.")
    except Exception as e:  # noqa: BLE001
        _set(state="error", message=f"온디바이스 준비 실패: {e}")
