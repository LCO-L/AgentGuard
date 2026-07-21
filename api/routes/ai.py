"""AI provider 상태 — 대시보드·익스텐션 설정 패널용.

어떤 백엔드가 준비됐는지(온디바이스 Ollama 접속성, 클라우드 키 유무)를 알려준다.
키 자체는 절대 반환하지 않는다(bool 만).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import ai_config
from core.ai import backend
from core.ai.backend import (AIConfig, DEFAULT_CLAUDE_MODEL,
                             DEFAULT_OLLAMA_MODEL, DEFAULT_OPENROUTER_MODEL)

router = APIRouter(prefix="/ai", tags=["meta"])


@router.get("/status")
def ai_status(cfg: AIConfig = Depends(ai_config)) -> dict:
    providers = backend.probe(cfg)
    return {
        "providers": providers,          # {ollama, claude, openrouter} bool
        "resolved_provider": cfg.provider,
        "ollama_url": cfg.ollama_url,
        "default_models": {
            "ollama": DEFAULT_OLLAMA_MODEL,
            "claude": DEFAULT_CLAUDE_MODEL,
            "openrouter": DEFAULT_OPENROUTER_MODEL,
        },
    }


@router.get("/models")
def ai_models(provider: str, cfg: AIConfig = Depends(ai_config)) -> dict:
    """provider 별 사용가능 모델 목록(지능적 설정 드롭다운)."""
    if provider not in ("ollama", "claude", "openrouter"):
        return {"provider": provider, "models": []}
    return {"provider": provider, "models": backend.list_models(provider, cfg)}


@router.post("/test")
def ai_test(cfg: AIConfig = Depends(ai_config)) -> dict:
    """헤더로 받은 provider/키/모델로 실제 1회 호출 → 연결 검증."""
    return backend.test_connection(cfg)


# ── 온디바이스 원클릭 실행 (Ollama 자동 기동 + 모델 자동 pull) ──

@router.post("/ondevice/start")
def ondevice_start(model: str | None = None) -> dict:
    """버튼 하나: ollama serve 기동 → 8B 모델 pull(백그라운드) 시작."""
    from services import ondevice_service
    return ondevice_service.start(model)


@router.get("/ondevice/status")
def ondevice_status() -> dict:
    """진행 상태 폴 백: {state, progress, message, model}."""
    from services import ondevice_service
    return ondevice_service.status()
