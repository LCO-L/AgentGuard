"""대화형 보안 도우미 라우트 — Fin/채널톡 위젯 백엔드."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.deps import ai_config, verify_api_key
from core.ai.backend import AIConfig
from services import chat_service

router = APIRouter(prefix="/chat", tags=["chat"],
                   dependencies=[Depends(verify_api_key)])


class ChatMessage(BaseModel):
    role: str
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    context: dict | None = None


@router.post("")
def chat(req: ChatRequest, cfg: AIConfig = Depends(ai_config)) -> dict:
    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    return chat_service.chat(msgs, req.context, cfg)
