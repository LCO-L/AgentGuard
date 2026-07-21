"""온디바이스 원클릭 실행 — Ollama 자동 기동 + 모델 자동 pull.

버튼 하나로: ① ollama 설치·설치확인 → ② serve 기동 → ③ 소형 4bit 모델 pull(진행률 추적) → ④ 사용 준비.
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

DEFAULT_MODEL = os.environ.get("AG_OLLAMA_MODEL", "qwen2.5:3b")  # 4bit(Q4_K_M)·소형
OLLAMA_URL = os.environ.get("AG_OLLAMA_URL", "http://localhost:11434")
_HOME = os.path.expanduser(os.environ.get("AG_HOME", "~/.agentguard"))
_OLLAMA_BIN: str | None = None  # 패키지매니저 대신 직접 설치한 경우의 실행 파일 경로
_last_err: str = ""             # 마지막 설치 오류(사용자에게 원인 안내용)

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


def _bin() -> str:
    """실행할 ollama 경로 — PATH 우선, 없으면 직접 설치한 위치."""
    if _OLLAMA_BIN and os.path.exists(_OLLAMA_BIN):
        return _OLLAMA_BIN
    return shutil.which("ollama") or "ollama"


def _ollama_present() -> bool:
    """PATH에 있거나, 직접 설치한 실행 파일이 존재하면 True."""
    return bool(shutil.which("ollama")) or bool(_OLLAMA_BIN and os.path.exists(_OLLAMA_BIN))


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


def _download(url: str, dest: str) -> None:
    """다운로드 — 시스템 curl 우선, 실패 시 SSL 관대 urllib 폴백.

    macOS 파이썬은 CA 인증서 미설정으로 urllib HTTPS가 자주 실패한다(가장 흔한 설치 실패 원인).
    curl은 시스템 인증서와 307/302 리다이렉트를 그대로 처리하므로 훨씬 매끄럽다.
    """
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    _set(message="Ollama 내려받는 중…")
    if shutil.which("curl"):
        r = subprocess.run(
            ["curl", "-fSL", "--retry", "3", "--connect-timeout", "20", "-o", dest, url],
            capture_output=True, timeout=1800)
        if r.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 1000:
            return
    # urllib 폴백 — 기본 컨텍스트 → (인증서 실패 시) 관대 컨텍스트 순
    import ssl
    req = urllib.request.Request(url, headers={"User-Agent": "AgentGuard-Installer"})
    try:
        _stream(req, dest, ssl.create_default_context())
    except Exception:  # noqa: BLE001
        _stream(req, dest, ssl._create_unverified_context())  # noqa: S323


def _stream(req: "urllib.request.Request", dest: str, ctx) -> None:
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:  # noqa: S310
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        with open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 16)
                if not chunk:
                    break
                f.write(chunk)
                done += len(chunk)
                if total:
                    pct = int(done * 100 / total)
                    _set(progress=min(4, 1 + pct // 34),
                         message=f"Ollama 내려받는 중… {pct}%")


def _mark_exec(path: str) -> None:
    import stat as _stat
    os.chmod(path, os.stat(path).st_mode | _stat.S_IXUSR | _stat.S_IXGRP | _stat.S_IXOTH)


def _find_ollama_binary(root: str) -> str | None:
    """추출 폴더에서 CLI 실행 파일(ollama / ollama.exe)을 찾는다(대문자 GUI 앱 제외)."""
    for base, _dirs, files in os.walk(root):
        for fn in files:
            if fn in ("ollama", "ollama.exe"):
                return os.path.join(base, fn)
    return None


def _install_macos_direct() -> bool:
    """Homebrew 없이 공식 macOS zip을 직접 받아 CLI 바이너리 확보."""
    global _OLLAMA_BIN
    import zipfile
    os.makedirs(_HOME, exist_ok=True)
    zpath = os.path.join(_HOME, "Ollama-darwin.zip")
    _download("https://ollama.com/download/Ollama-darwin.zip", zpath)
    appdir = os.path.join(_HOME, "app")
    shutil.rmtree(appdir, ignore_errors=True)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(appdir)
    binp = _find_ollama_binary(appdir)
    if binp:
        _mark_exec(binp)
        _OLLAMA_BIN = binp
        return True
    return False


def _extract_tar_zst(path: str, outdir: str) -> bool:
    """.tar.zst 추출 — 시스템 tar(zstd) 우선, 실패 시 python zstandard 폴백."""
    os.makedirs(outdir, exist_ok=True)
    for cmd in (["tar", "--zstd", "-xf", path, "-C", outdir],
                ["tar", "-I", "zstd", "-xf", path, "-C", outdir],
                ["tar", "-xf", path, "-C", outdir]):  # 일부 tar은 자동 감지
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=600)
            if r.returncode == 0 and _find_ollama_binary(outdir):
                return True
        except Exception:  # noqa: BLE001
            pass
    try:  # 순수 파이썬 폴백(zstandard 있으면)
        import io
        import tarfile
        import zstandard
        with open(path, "rb") as f:
            reader = zstandard.ZstdDecompressor().stream_reader(f)
            with tarfile.open(fileobj=io.BufferedReader(reader), mode="r|") as t:
                t.extractall(outdir)
        return bool(_find_ollama_binary(outdir))
    except Exception:  # noqa: BLE001
        return False


def _install_linux_direct() -> bool:
    """공식 Linux tar.zst를 직접 받아 ollama 실행 파일 확보(설치 스크립트 폴백).

    최신 릴리스 자산은 .tgz가 아니라 .tar.zst 다(과거 .tgz URL은 404).
    """
    global _OLLAMA_BIN, _last_err
    import platform
    arch = platform.machine().lower()
    a = "arm64" if arch in ("arm64", "aarch64") else "amd64"
    os.makedirs(_HOME, exist_ok=True)
    tpath = os.path.join(_HOME, f"ollama-linux-{a}.tar.zst")
    _download(f"https://ollama.com/download/ollama-linux-{a}.tar.zst", tpath)
    outdir = os.path.join(_HOME, "linux")
    shutil.rmtree(outdir, ignore_errors=True)
    if not _extract_tar_zst(tpath, outdir):
        _last_err = "tar.zst 추출 실패 — 서버에 zstd/tar이 없을 수 있어요"
        return False
    binp = _find_ollama_binary(outdir)
    if binp:
        _mark_exec(binp)
        _OLLAMA_BIN = binp
        return True
    return False


def _install_windows_direct() -> bool:
    """관리자 권한 없이 공식 Windows 스탠드얼론 zip을 받아 ollama.exe 확보."""
    global _OLLAMA_BIN
    import zipfile
    os.makedirs(_HOME, exist_ok=True)
    zpath = os.path.join(_HOME, "ollama-windows-amd64.zip")
    _download("https://ollama.com/download/ollama-windows-amd64.zip", zpath)
    outdir = os.path.join(_HOME, "win")
    shutil.rmtree(outdir, ignore_errors=True)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(outdir)
    binp = _find_ollama_binary(outdir)
    if binp:
        _OLLAMA_BIN = binp
        return True
    return False


def _manual_hint() -> str:
    """자동 설치 실패 시 OS별 '가장 확실한 한 줄' 안내."""
    import platform
    if platform.system() == "Windows":
        return "https://ollama.com/download/windows 에서 OllamaSetup.exe 실행이 가장 확실해요(관리자 불필요)."
    return "터미널에서 `curl -fsSL https://ollama.com/install.sh | sh` 한 줄이면 확실해요."


def _install_ollama() -> bool:
    """Ollama 자동 설치 — OS별 라우팅. 관리자 권한 없이 되는 경로를 우선한다.

    - macOS(Darwin): brew → 공식 zip 직접 다운로드(~/.agentguard, sudo 불필요·바로 실행)
    - Windows: 공식 스탠드얼론 zip 직접 다운로드(관리자 불필요) → winget 무인 설치 폴백
    - Linux: 공식 install.sh(root면 성공) → 공식 tgz 직접 다운로드
    """
    global _last_err
    import platform
    system = platform.system()
    try:
        if system == "Darwin":
            if shutil.which("brew"):
                try:
                    subprocess.run(["brew", "install", "ollama"],
                                   check=True, capture_output=True, timeout=1800)
                    if shutil.which("ollama"):
                        return True
                except Exception as e:  # noqa: BLE001
                    _last_err = f"brew 실패: {e}"  # → 직접 다운로드로 폴백
            return _install_macos_direct()

        if system == "Windows":
            try:
                if _install_windows_direct():
                    return True
            except Exception as e:  # noqa: BLE001
                _last_err = f"zip 설치 실패: {e}"
            if shutil.which("winget"):  # 폴백: winget 무인 설치
                try:
                    subprocess.run(
                        ["winget", "install", "-e", "--id", "Ollama.Ollama",
                         "--silent", "--accept-package-agreements",
                         "--accept-source-agreements"],
                        check=True, capture_output=True, timeout=1800)
                    if shutil.which("ollama"):
                        return True
                except Exception as e:  # noqa: BLE001
                    _last_err = f"winget 실패: {e}"
            return _ollama_present()

        # Linux 등
        try:
            subprocess.run("curl -fsSL https://ollama.com/install.sh | sh",
                           shell=True, check=True, capture_output=True, timeout=1800)
            if shutil.which("ollama"):
                return True
        except Exception as e:  # noqa: BLE001
            _last_err = f"install.sh 실패: {e}"  # 권한/네트워크 → 직접 다운로드
        return _install_linux_direct()
    except Exception as e:  # noqa: BLE001
        _last_err = str(e)
        return False


def _run(model: str) -> None:
    global _proc
    try:
        # ① 설치 확인 → 없으면 자동 설치
        if not _ollama_present():
            _set(state="starting", progress=2,
                 message="Ollama 자동 설치 중… (최초 1회, 수 분 걸릴 수 있어요)")
            if not _install_ollama() or not _ollama_present():
                cause = (" (원인: " + _last_err[:140] + ")") if _last_err else ""
                _set(state="no_ollama", progress=0,
                     message="자동 설치를 완료하지 못했어요. " + _manual_hint() + cause +
                             " 설치 없이도 오프라인 규칙으로 동작해요.")
                return
            _set(progress=4, message="Ollama 설치 완료 ✓ 실행 준비 중…")

        # ② serve 기동
        if not _ollama_alive():
            _set(state="starting", progress=5, message="Ollama 실행 중…")
            _proc = subprocess.Popen(
                [_bin(), "serve"],
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
            [_bin(), "pull", model],
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
