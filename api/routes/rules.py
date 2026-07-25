# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""룰 카탈로그 조회 — 관리자 화면·문서 자동생성용."""
from __future__ import annotations

from fastapi import APIRouter

from core.signatures import RULES

router = APIRouter(prefix="/rules", tags=["meta"])


@router.get("")
def list_rules() -> dict:
    return {"total": len(RULES), "rules": RULES}
