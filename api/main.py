"""FastAPI 앱 조립 — CORS·라우팅·버저닝.

모든 비즈니스 로직은 services/core에 있고, 여기는 껍데기뿐.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response

from api.routes import ai, chat, health, history, inspect, rules, scan, text, url

_UI_DIR = Path(__file__).resolve().parent.parent / "ui"


def _serve(name: str, media: str) -> Response:
    p = _UI_DIR / name
    if p.exists():
        return Response(p.read_text(encoding="utf-8"), media_type=media)
    return Response("not found", status_code=404)


def create_app() -> FastAPI:
    app = FastAPI(
        title="AgentGuard",
        version="0.1.0",
        description=("포맷 무관 통합 보안 엔진 — 파일·AI도구·링크의 위험을 "
                     "온디바이스에서 검사하고 쉬운 말로 통역하는 API"),
    )

    # CORS — 환경변수로 제한 가능. 기본 * (해커톤/확장 개발 편의)
    origins = [o.strip() for o in
               os.environ.get("AG_CORS_ORIGINS", "*").split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # v1 네임스페이스 — 향후 v2 추가 시 클라이언트 무중단
    for r in (scan.router, url.router, text.router, inspect.router, chat.router,
              ai.router, history.router, rules.router, health.router):
        app.include_router(r, prefix="/v1")

    @app.get("/", response_class=HTMLResponse, tags=["meta"])
    def dashboard() -> str:
        """드래그앤드롭 대시보드(온디바이스 데모). 파일이 없으면 API 안내로 폴백."""
        html = _UI_DIR / "dashboard.html"
        if html.exists():
            return html.read_text(encoding="utf-8")
        return ("<h1>AgentGuard</h1><p>대시보드 파일이 없습니다. "
                "API 문서는 <a href='/docs'>/docs</a>.</p>")

    @app.get("/widget.js", tags=["meta"])
    def widget_js() -> Response:
        """임베드형 보안 도우미 위젯(채널톡/Fin 스타일). <script src>로 로드."""
        return _serve("widget.js", "application/javascript; charset=utf-8")

    @app.get("/agconfig.js", tags=["meta"])
    def agconfig_js() -> Response:
        """AI provider 설정 공유 모듈(대시보드·설정·위젯 공용)."""
        return _serve("agconfig.js", "application/javascript; charset=utf-8")

    @app.get("/agscan.js", tags=["meta"])
    def agscan_js() -> Response:
        """온디바이스 경량 스캐너(익스텐션·위젯 공용)."""
        return _serve("agscan.js", "application/javascript; charset=utf-8")

    # ── PWA (아이폰 공유 시트 = Web Share Target) ──
    @app.get("/manifest.webmanifest", tags=["meta"])
    def manifest() -> Response:
        return _serve("manifest.webmanifest", "application/manifest+json; charset=utf-8")

    @app.get("/sw.js", tags=["meta"])
    def service_worker() -> Response:
        return _serve("sw.js", "application/javascript; charset=utf-8")

    @app.get("/icon.svg", tags=["meta"])
    def icon() -> Response:
        return _serve("icon.svg", "image/svg+xml; charset=utf-8")

    @app.get("/settings", response_class=HTMLResponse, tags=["meta"])
    def settings_page() -> str:
        """지능적 AI 엔진 설정 페이지(온디바이스/Claude/OpenRouter)."""
        html = _UI_DIR / "settings.html"
        return html.read_text(encoding="utf-8") if html.exists() else "<h1>no settings</h1>"

    @app.get("/editor", response_class=HTMLResponse, tags=["meta"])
    def editor_page() -> str:
        """Grammarly식 보안 에디터 — AI 전송 전 실시간 검사."""
        html = _UI_DIR / "editor.html"
        return html.read_text(encoding="utf-8") if html.exists() else "<h1>no editor</h1>"

    @app.get("/embed-demo", response_class=HTMLResponse, tags=["meta"])
    def embed_demo() -> str:
        """위젯이 붙은 '가상 회사 사이트' 데모."""
        html = _UI_DIR / "embed-demo.html"
        return html.read_text(encoding="utf-8") if html.exists() else "<h1>no demo</h1>"

    @app.get("/api", tags=["meta"])
    def api_index() -> dict:
        return {
            "service": "AgentGuard ULTRA",
            "docs": "/docs",
            "endpoints": [
                "POST /v1/scan", "POST /v1/scan/batch", "POST /v1/scan/url",
                "POST /v1/scan/text", "GET /v1/ai/status",
                "GET /v1/scans", "GET /v1/scans/{id}",
                "GET /v1/rules", "GET /v1/health",
            ],
        }
    return app


app = create_app()
