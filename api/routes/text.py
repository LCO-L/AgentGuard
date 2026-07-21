# © 2026 DONGHUN LEE · All Rights Reserved · AgentGuard (Proprietary).
"""텍스트 스캔 라우트 — 붙여넣기/페이지 본문 프롬프트 인젝션 검사.

크롬 익스텐션이 현재 페이지의 보이지 않는 명령을 검사할 때 호출.
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.deps import ai_config, verify_api_key
from core.ai.backend import AIConfig
from services import text_service

router = APIRouter(prefix="/scan/text", tags=["text"],
                   dependencies=[Depends(verify_api_key)])


class TextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    source: str = Field(default="pasted-text", max_length=200)


@router.post("")
def scan_text(req: TextRequest, cfg: AIConfig = Depends(ai_config)) -> dict:
    return asdict(text_service.scan_text_content(req.text, req.source, cfg))
