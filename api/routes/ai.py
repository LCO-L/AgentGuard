# © 2026 DONGHUN LEE · AgentGuard · MIT License.
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

@router.post("/ondevice/start")
def ondevice_start(model: str | None = None) -> dict:
    """온디바이스 원클릭 — 누르면 '바로' 설치→실행→모델 준비를 시작한다.

    실행 명령은 고정(ollama 설치·serve·pull)이라 임의 코드 실행이 아니다.
    설치형(로컬)에선 완결되고, 클라우드는 리소스·권한 한계로 실패할 수 있으나 시도는 즉시 한다.
    """
    from services import ondevice_service
    return ondevice_service.start(model)


@router.get("/ondevice/status")
def ondevice_status() -> dict:
    """진행 상태 폴 백: {state, progress, message, model}."""
    from services import ondevice_service
    return ondevice_service.status()
