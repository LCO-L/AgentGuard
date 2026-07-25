# © 2026 DONGHUN LEE · AgentGuard · MIT License.
"""공통 의존성 — API 키 인증(선택적, .env로 on/off).

해커톤: AG_API_KEY 비워두면 인증 없음.
기업 판매: Railway Variables에 AG_API_KEY 설정 → 모든 /v1/* 보호.
"""
from __future__ import annotations

import os
import re
from urllib.parse import unquote

from fastapi import Header, HTTPException

from core.ai import backend
from core.ai.backend import AIConfig

MAX_UPLOAD_MB = int(os.environ.get("AG_MAX_UPLOAD_MB", "30"))


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    required = os.environ.get("AG_API_KEY", "")
    if not required:
        return  # 인증 비활성(개발/해커톤 모드)
    if x_api_key != required:
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다")


def ai_config(
    x_ai_provider: str | None = Header(default=None),
    x_ai_key: str | None = Header(default=None),
    x_ai_model: str | None = Header(default=None),
    x_ollama_url: str | None = Header(default=None),
) -> AIConfig:
    """요청 헤더(X-AI-Provider / X-AI-Key / X-AI-Model / X-Ollama-Url)로 AIConfig 조립.

    키는 브라우저→헤더로만 전달, 서버는 저장하지 않는다(비저장 원칙).
    헤더가 없으면 환경변수/기본값으로 폴백.
    """
    return backend.resolve_config({
        "provider": x_ai_provider,
        "api_key": x_ai_key,
        "model": x_ai_model,
        "ollama_url": x_ollama_url,
    })


def org_terms(x_ag_org_terms: str | None = Header(default=None)) -> list[str]:
    """회사 전용 민감어(기업 규칙) — 줄바꿈/쉼표 구분·URL 인코딩 헤더 → 리스트."""
    if not x_ag_org_terms:
        return []
    raw = unquote(x_ag_org_terms)
    return [p.strip() for p in re.split(r"[\n,]+", raw) if p.strip()][:100]


def check_size(data: bytes, filename: str = "") -> None:
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"파일이 너무 큽니다({MAX_UPLOAD_MB}MB 제한): {filename}")
