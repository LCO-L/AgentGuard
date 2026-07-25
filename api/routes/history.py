# © 2026 DONGHUN LEE · AgentGuard · MIT License.
"""스캔 이력 라우트 — 대시보드용.

격리 정책: 기본은 요청 브라우저(X-AG-Client) 자신의 기록만 돌려준다.
전체 감사 뷰(scope=all)는 기업 모드(AG_API_KEY 설정)에서만 —
공개 데모에서 남의 검사 이력이 보이지 않게 한다.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import ag_client, verify_api_key
from services import history_service

router = APIRouter(prefix="/scans", tags=["history"],
                   dependencies=[Depends(verify_api_key)])


@router.get("")
def list_scans(limit: int = Query(50, ge=1, le=200),
               offset: int = Query(0, ge=0),
               scope: str = Query("", description="all=전체 감사 뷰(기업 모드 전용)"),
               client: str = Depends(ag_client)) -> dict:
    if scope == "all":
        # verify_api_key가 이미 키를 검증했으므로, 키가 '설정돼 있는지'만 확인하면 된다
        if not os.environ.get("AG_API_KEY"):
            raise HTTPException(status_code=403,
                                detail="전체 이력은 기업 모드(AG_API_KEY 설정)에서만 볼 수 있습니다")
        return history_service.list_scans(limit=limit, offset=offset)
    return history_service.list_scans(limit=limit, offset=offset, client=client)


@router.get("/{scan_id}")
def get_scan(scan_id: str, client: str = Depends(ag_client)) -> dict:
    rec = history_service.get_scan(scan_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="스캔 기록을 찾을 수 없습니다")
    owner = rec.get("client", "")
    # 데모(무인증)에선 남의 기록 열람 불가. 기업 모드는 키 검증을 통과했으므로 전체 허용
    if owner and owner != client and not os.environ.get("AG_API_KEY"):
        raise HTTPException(status_code=404, detail="스캔 기록을 찾을 수 없습니다")
    return rec
