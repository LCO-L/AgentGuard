# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""헬스체크 — Railway 헬스체크·모니터링용."""
from __future__ import annotations

import os

from fastapi import APIRouter

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "AgentGuard",
        "version": "0.1.0",
        "ai_enabled": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "auth_enabled": bool(os.environ.get("AG_API_KEY")),
    }
