# © 2026 DONGHUN LEE · All Rights Reserved · AgentGuard (Proprietary).
"""스캔 이력 라우트 — 대시보드용."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import verify_api_key
from services import history_service

router = APIRouter(prefix="/scans", tags=["history"],
                   dependencies=[Depends(verify_api_key)])


@router.get("")
def list_scans(limit: int = Query(50, ge=1, le=200),
               offset: int = Query(0, ge=0)) -> dict:
    return history_service.list_scans(limit=limit, offset=offset)


@router.get("/{scan_id}")
def get_scan(scan_id: str) -> dict:
    rec = history_service.get_scan(scan_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="스캔 기록을 찾을 수 없습니다")
    return rec
