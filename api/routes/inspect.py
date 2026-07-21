"""인스펙션 라우트 — 실시간 보안 에디터·익스텐션(Grammarly for Security).

POST /v1/inspect  텍스트 → span 이슈 + 요약 + 마스킹 프리뷰
POST /v1/redact   텍스트 → 복원 가능 마스킹(+매핑)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.deps import ai_config, org_terms, verify_api_key
from core.ai.backend import AIConfig
from core.rulepacks import registry
from services import inspect_service

router = APIRouter(prefix="", tags=["inspect"],
                   dependencies=[Depends(verify_api_key)])


class InspectRequest(BaseModel):
    text: str = Field(min_length=0, max_length=100_000)
    kind: str = Field(default="auto", max_length=16)
    explain: bool = False


class RedactRequest(BaseModel):
    text: str = Field(min_length=0, max_length=100_000)


@router.post("/inspect")
def inspect(req: InspectRequest, cfg: AIConfig = Depends(ai_config),
            org: list[str] = Depends(org_terms)) -> dict:
    return inspect_service.inspect_text(req.text, req.kind, cfg, req.explain, org)


@router.post("/redact")
def redact(req: RedactRequest, org: list[str] = Depends(org_terms)) -> dict:
    return inspect_service.redact_text(req.text, org)


@router.post("/sanitize")
def sanitize(req: RedactRequest, org: list[str] = Depends(org_terms)) -> dict:
    """AI 전송 전 정화 — 민감정보(+회사기밀)는 마스킹, 프롬프트 인젝션·은닉은 제거."""
    return inspect_service.sanitize_text(req.text, org)


@router.get("/scenarios")
def scenarios() -> dict:
    """시나리오 카탈로그 — 어떤 보안 시나리오를 잡는지(가시성·관리 화면)."""
    return {"stats": registry.stats(), "scenarios": registry.catalog()}
