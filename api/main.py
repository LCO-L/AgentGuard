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
_ROOT = Path(__file__).resolve().parent.parent


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

    @app.get("/nav.js", tags=["meta"])
    def nav_js() -> Response:
        """통합 상단 네비게이션(모든 순수 HTML 페이지 공용)."""
        return _serve("nav.js", "application/javascript; charset=utf-8")

    @app.get("/onboarding.js", tags=["meta"])
    def onboarding_js() -> Response:
        """첫 방문 온보딩 투어(말풍선 코치마크 + 확장 설치 안내)."""
        return _serve("onboarding.js", "application/javascript; charset=utf-8")

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

    @app.get("/scenarios", response_class=HTMLResponse, tags=["meta"])
    def scenarios_page() -> str:
        """탐지 시나리오 카탈로그 — 데이터 한 줄로 확장되는 룰팩 가시화."""
        html = _UI_DIR / "scenarios.html"
        return html.read_text(encoding="utf-8") if html.exists() else "<h1>no scenarios</h1>"

    @app.get("/compare", response_class=HTMLResponse, tags=["meta"])
    def compare_page() -> str:
        """백신 vs AgentGuard 비교 시연 — '같은 위험, 다른 이해'."""
        html = _UI_DIR / "compare.html"
        return html.read_text(encoding="utf-8") if html.exists() else "<h1>no compare</h1>"

    @app.get("/embed-demo", response_class=HTMLResponse, tags=["meta"])
    def embed_demo() -> str:
        """위젯이 붙은 '가상 회사 사이트' 데모."""
        html = _UI_DIR / "embed-demo.html"
        return html.read_text(encoding="utf-8") if html.exists() else "<h1>no demo</h1>"

    @app.get("/extension.zip", tags=["meta"])
    def extension_zip() -> Response:
        """크롬 익스텐션 즉시 설치 패키지 — extension/ 디렉터리를 즉석 ZIP으로.

        랜딩의 '확장 프로그램 설치' 버튼이 다운로드. 사용자는 압축 해제 후
        chrome://extensions → '압축해제된 확장 프로그램 로드'로 10초 설치.
        """
        import io
        import zipfile

        ext_dir = _ROOT / "extension"
        if not ext_dir.exists():
            return Response("extension 디렉터리가 없습니다", status_code=404)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(ext_dir.rglob("*")):
                if f.is_file() and "__pycache__" not in str(f):
                    z.write(f, arcname=f"agentguard-extension/{f.relative_to(ext_dir)}")
        return Response(
            content=buf.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition":
                     "attachment; filename=agentguard-extension.zip"},
        )

    @app.get("/extension.crx", tags=["meta"])
    def extension_crx() -> Response:
        """서명된 CRX3 패키지 — scripts/pack_extension.py 로 미리 빌드한 산출물 서빙.

        ⚠️ 최신 Chrome은 웹스토어 외 CRX 직접 설치를 제한(엔터프라이즈 정책용).
        일반 사용자는 /extension.zip + '압축해제된 확장 프로그램 로드' 권장.
        """
        crx = _ROOT / "dist" / "agentguard-extension.crx"
        if not crx.exists():
            return Response(
                "CRX가 아직 빌드되지 않았습니다. "
                "uv run python scripts/pack_extension.py 를 먼저 실행하세요.",
                status_code=404)
        return Response(
            content=crx.read_bytes(),
            media_type="application/x-chrome-extension",
            headers={"Content-Disposition":
                     "attachment; filename=agentguard-extension.crx"},
        )

    @app.get("/api", tags=["meta"])
    def api_index() -> dict:
        return {
            "service": "AgentGuard ULTRA",
            "docs": "/docs",
            "pages": ["/", "/editor", "/compare", "/scenarios", "/settings", "/embed-demo"],
            "downloads": ["/extension.zip", "/extension.crx"],
            "endpoints": [
                "POST /v1/scan", "POST /v1/scan/batch", "POST /v1/scan/url",
                "POST /v1/scan/text", "POST /v1/inspect", "POST /v1/redact",
                "POST /v1/chat", "GET /v1/scenarios",
                "GET /v1/ai/status", "GET /v1/ai/models", "POST /v1/ai/test",
                "GET /v1/scans", "GET /v1/scans/{id}",
                "GET /v1/rules", "GET /v1/health",
            ],
        }
    return app


app = create_app()
