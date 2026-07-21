"""AI provider 상태 — 대시보드·익스텐션 설정 패널용.

어떤 백엔드가 준비됐는지(온디바이스 Ollama 접속성, 클라우드 키 유무)를 알려준다.
키 자체는 절대 반환하지 않는다(bool 만).
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Request

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

def _local_only(request: Request) -> bool:
    """온디바이스 자동 설치·실행은 로컬(설치형)에서만 허용 — 배포/원격 차단."""
    host = request.client.host if request.client else ""
    return bool(os.environ.get("AG_ONDEVICE")) or host in (
        "127.0.0.1", "::1", "localhost", "testclient")


@router.post("/ondevice/start")
def ondevice_start(request: Request, model: str | None = None) -> dict:
    """온디바이스 원클릭(설치→실행→모델). subprocess 안전을 위해 로컬 전용."""
    if not _local_only(request):
        return {"state": "blocked", "progress": 0,
                "message": "온디바이스 자동 설치는 이 컴퓨터에서 직접 실행할 때만 돼요. "
                           "지금은 설정에서 Claude·OpenRouter 키를 넣거나 오프라인 규칙을 쓰세요."}
    from services import ondevice_service
    return ondevice_service.start(model)


@router.get("/ondevice/status")
def ondevice_status() -> dict:
    """진행 상태 폴 백: {state, progress, message, model}."""
    from services import ondevice_service
    return ondevice_service.status()
