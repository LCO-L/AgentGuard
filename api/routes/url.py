"""URL 스캔 라우트 — 크롬 익스텐션·링크 검사용."""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.deps import ai_config, verify_api_key
from core.ai.backend import AIConfig
from services import url_service

router = APIRouter(prefix="/scan/url", tags=["url"],
                   dependencies=[Depends(verify_api_key)])


class UrlRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2048)


@router.post("")
def scan_url(req: UrlRequest, cfg: AIConfig = Depends(ai_config)) -> dict:
    return asdict(url_service.scan_url(req.url, cfg))
