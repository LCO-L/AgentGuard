"""통합 LLM 백엔드 — 의존성 0(urllib)로 3개 provider 를 한 입구로.

지원:
  • ollama     — 온디바이스(로컬). 키 불필요. 기본. (qwen 등)
  • claude     — Anthropic API. 키 필요.
  • openrouter — OpenRouter API(OpenAI 호환). 키 필요.

키/모델/주소는 **런타임 주입**(요청 헤더 → services → 여기)이 환경변수보다 우선.
그래서 UI 대시보드에서 키를 넣으면 서버 재기동 없이 즉시 해당 provider 로 동작한다.
셋 다 불가하면 complete() 는 (None, "off") 를 돌려주고, 호출측은 오프라인 폴백을 쓴다.

보안: 원본 파일은 절대 오지 않는다. '위험 메타/발췌 텍스트'만 프롬프트로 간다.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "qwen3:8b"
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5"
DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-8b"

_PROVIDERS = ("ollama", "claude", "openrouter")


@dataclass
class AIConfig:
    provider: str = "auto"        # auto|ollama|claude|openrouter|off
    api_key: str = ""
    model: str = ""
    ollama_url: str = DEFAULT_OLLAMA_URL
    timeout: float = 20.0

    def model_for(self, provider: str) -> str:
        if self.model:
            return self.model
        return {
            "ollama": os.environ.get("AG_OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
            "claude": os.environ.get("AG_MODEL", DEFAULT_CLAUDE_MODEL),
            "openrouter": os.environ.get("AG_OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL),
        }.get(provider, "")


def resolve_config(overrides: dict | None = None) -> AIConfig:
    """요청 오버라이드(dict) > 환경변수 > 기본값 순으로 AIConfig 조립."""
    o = overrides or {}
    provider = (o.get("provider") or os.environ.get("AG_AI_PROVIDER") or "auto").strip().lower()
    api_key = (o.get("api_key") or "").strip()
    if not api_key:
        # provider 별 환경변수 키 폴백
        if provider == "claude":
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        elif provider == "openrouter":
            api_key = os.environ.get("OPENROUTER_API_KEY", "")
        else:  # auto: 아무 키나 있으면 채워둠
            api_key = (os.environ.get("ANTHROPIC_API_KEY")
                       or os.environ.get("OPENROUTER_API_KEY") or "")
    return AIConfig(
        provider=provider if provider in ("auto", "off", *_PROVIDERS) else "auto",
        api_key=api_key,
        model=(o.get("model") or "").strip(),
        ollama_url=(o.get("ollama_url") or os.environ.get("AG_OLLAMA_URL")
                    or DEFAULT_OLLAMA_URL).rstrip("/"),
        timeout=float(o.get("timeout") or os.environ.get("AG_AI_TIMEOUT") or 20.0),
    )


def _post_json(url: str, payload: dict, headers: dict, timeout: float) -> dict | None:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None


def _get_json(url: str, headers: dict, timeout: float) -> dict | None:
    req = urllib.request.Request(url, method="GET")
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None


def extract_json(text: str) -> dict | None:
    """모델 출력에서 첫 JSON 오브젝트를 관대하게 추출(코드펜스·잡설 허용)."""
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    # ```json ... ``` 또는 본문 중 {...}
    m = re.search(r"\{.*\}", text, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


# ── provider 별 호출 ──────────────────────────────────────

def _call_ollama(system: str, user: str, cfg: AIConfig, max_tokens: int) -> str | None:
    payload = {
        "model": cfg.model_for("ollama"),
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user}],
        "stream": False,
        "options": {"temperature": 0, "num_predict": max_tokens},
    }
    data = _post_json(f"{cfg.ollama_url}/api/chat", payload, {}, cfg.timeout)
    if not data:
        return None
    msg = (data.get("message") or {}).get("content")
    return msg.strip() if isinstance(msg, str) else None


def _call_claude(system: str, user: str, cfg: AIConfig, max_tokens: int) -> str | None:
    if not cfg.api_key:
        return None
    payload = {
        "model": cfg.model_for("claude"),
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    headers = {"x-api-key": cfg.api_key, "anthropic-version": "2023-06-01"}
    data = _post_json("https://api.anthropic.com/v1/messages", payload, headers, cfg.timeout)
    if not data:
        return None
    try:
        return data["content"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        return None


def _call_openrouter(system: str, user: str, cfg: AIConfig, max_tokens: int) -> str | None:
    if not cfg.api_key:
        return None
    payload = {
        "model": cfg.model_for("openrouter"),
        "max_tokens": max_tokens,
        "temperature": 0,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user}],
    }
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "HTTP-Referer": "https://github.com/agentguard",
        "X-Title": "AgentGuard",
    }
    data = _post_json("https://openrouter.ai/api/v1/chat/completions",
                      payload, headers, cfg.timeout)
    if not data:
        return None
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError):
        return None


_DISPATCH = {
    "ollama": _call_ollama,
    "claude": _call_claude,
    "openrouter": _call_openrouter,
}


def _order(cfg: AIConfig) -> list[str]:
    if cfg.provider in _PROVIDERS:
        return [cfg.provider]
    if cfg.provider == "off":
        return []
    # auto: 로컬 우선 → 키 있는 클라우드
    order = ["ollama"]
    if cfg.api_key:
        order += ["claude", "openrouter"]
    return order


def complete(system: str, user: str, cfg: AIConfig,
             max_tokens: int = 500) -> tuple[str | None, str]:
    """LLM 호출. 반환 (텍스트|None, 사용된_엔진). 실패 시 (None, "off")."""
    for provider in _order(cfg):
        fn = _DISPATCH[provider]
        out = fn(system, user, cfg, max_tokens)
        if out:
            return out, provider
    return None, "off"


def probe(cfg: AIConfig | None = None) -> dict:
    """대시보드용 provider 가용성 점검(빠른 timeout)."""
    cfg = cfg or resolve_config()
    status = {"ollama": False,
              "claude": bool(cfg.api_key or os.environ.get("ANTHROPIC_API_KEY")),
              "openrouter": bool(cfg.api_key or os.environ.get("OPENROUTER_API_KEY"))}
    # ollama 로컬 접속 확인
    try:
        req = urllib.request.Request(f"{cfg.ollama_url}/api/tags")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            status["ollama"] = resp.status == 200
    except Exception:
        status["ollama"] = False
    return status


# ── 지능적 설정 지원: 모델 목록 · 연결 테스트 ──────────────

# Claude 는 목록 API 가 키 없이는 제한적 → 알려진 최신 모델을 제시
_KNOWN_CLAUDE = ["claude-sonnet-4-5", "claude-opus-4-1",
                 "claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"]


def list_models(provider: str, cfg: AIConfig | None = None) -> list[str]:
    """provider 에 설치/사용가능한 모델 목록(지능적 설정 드롭다운용)."""
    cfg = cfg or resolve_config()
    if provider == "ollama":
        data = _get_json(f"{cfg.ollama_url}/api/tags", {}, min(cfg.timeout, 4.0))
        models = [m.get("name", "") for m in (data or {}).get("models", [])]
        return [m for m in models if m]
    if provider == "openrouter" and cfg.api_key:
        data = _get_json("https://openrouter.ai/api/v1/models",
                         {"Authorization": f"Bearer {cfg.api_key}"}, min(cfg.timeout, 6.0))
        ids = [m.get("id", "") for m in (data or {}).get("data", [])]
        # 인기/저가 위주 상위 노출을 위해 이름순 + 상한
        return sorted([i for i in ids if i])[:300]
    if provider == "claude":
        return list(_KNOWN_CLAUDE)
    return []


def test_connection(cfg: AIConfig) -> dict:
    """실제 1회 호출로 연결 검증(지연시간 포함). 설정 페이지의 '연결 테스트'."""
    import time
    provider = cfg.provider if cfg.provider in _PROVIDERS else (_order(cfg)[0] if _order(cfg) else "off")
    t0 = time.time()
    out, engine = complete("You are a connectivity test. Answer very briefly.",
                           "Reply with exactly: ok", cfg, max_tokens=8)
    ms = int((time.time() - t0) * 1000)
    return {"ok": bool(out), "engine": engine if out else "off",
            "provider": provider, "latency_ms": ms,
            "sample": (out or "")[:80],
            "model": cfg.model_for(engine) if out and engine in _PROVIDERS else ""}
