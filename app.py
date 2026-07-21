# © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
"""실행 엔트리 —`uv run python app.py` 또는 `uv run uvicorn api.main:app`.

Railway는 Procfile/startCommand로 이 모듈을 사용.
PORT 환경변수는 Railway가 자동 주입.
"""
from __future__ import annotations

import os

import uvicorn

from api.main import app  # noqa: F401 — uvicorn 경로용 re-export

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        reload=bool(os.environ.get("AG_DEV")),
    )
