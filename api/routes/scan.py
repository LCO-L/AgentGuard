# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""파일 스캔 라우트 — 단건/배치."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from api.deps import ai_config, check_size, verify_api_key
from core.ai.backend import AIConfig
from services import scan_service

router = APIRouter(prefix="/scan", tags=["scan"],
                   dependencies=[Depends(verify_api_key)])


@router.post("")
async def scan(file: UploadFile = File(...),
               cfg: AIConfig = Depends(ai_config)) -> dict:
    """파일 1개 업로드 → Verdict JSON (웹/확장/앱 공용)."""
    data = await file.read()
    check_size(data, file.filename or "")
    try:
        # 스캔은 블로킹(LLM 호출 포함) → 스레드풀로 넘겨 이벤트 루프를 막지 않는다(동시 사용자 보호)
        verdict = await run_in_threadpool(
            scan_service.scan_bytes, data, file.filename or "upload.bin", cfg)
    except ValueError as e:
        raise HTTPException(status_code=415, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"분석 실패: {e}")
    return scan_service.verdict_to_dict(verdict)


@router.post("/batch")
async def scan_batch(files: list[UploadFile] = File(...),
                     cfg: AIConfig = Depends(ai_config)) -> dict:
    """여러 파일 일괄 스캔 — 기업 대시보드/CI용."""
    if len(files) > 20:
        raise HTTPException(status_code=413, detail="한 번에 최대 20개까지 가능합니다")
    payload = []
    for f in files:
        data = await f.read()
        check_size(data, f.filename or "")
        payload.append((data, f.filename or "upload.bin"))
    # 배치는 파일 수 × LLM 호출로 오래 걸림 → 반드시 스레드풀에서(전체 사용자 멈춤 방지)
    return {"results": await run_in_threadpool(scan_service.scan_batch, payload, cfg)}
