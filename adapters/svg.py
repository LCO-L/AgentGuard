"""SVG 어댑터 — '그림'인 척하는 실행 벡터.

SVG 는 XML 이라 <script>, onload=, javascript: 로 브라우저에서 코드가 돈다.
이미지로 위장한 XSS·피싱의 통로. <text> 안에 프롬프트 인젝션도 가능.
"""
from __future__ import annotations

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import find_urls, sha256_hex


class SvgAdapter(Adapter):
    kind = "svg"

    def detect(self, head: bytes, filename: str) -> bool:
        h = head.lstrip()[:512].lower()
        if h.startswith(b"<svg"):
            return True
        if h.startswith(b"<?xml") and b"<svg" in head[:1024].lower():
            return True
        return False

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        raw = open(path, "rb").read()
        text = raw.decode("utf-8", "replace")
        s = RiskSurface(kind="svg", name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(raw)

        low = text.lower()
        # 스크립트/이벤트 핸들러(detail 에 'svg' 포함 → svg_script 매처 발화)
        if "<script" in low or "javascript:" in low or "onload=" in low or \
                "onerror=" in low or "onclick=" in low:
            s.add("exec", "svg embedded script/event handler",
                  location="svg", excerpt=text[:400])
        if "<foreignobject" in low:
            s.add("exec", "svg foreignObject(HTML 삽입)",
                  location="foreignObject", excerpt=text[:200])

        # 외부 참조·유출 URL
        for url in find_urls(text):
            s.add("network", "svg 내 외부 URL", location="svg", excerpt=url)

        # <text> 안 프롬프트 인젝션 가능성(은닉/homoglyph 는 1층 textnorm 이 검사)
        if "<text" in low:
            s.add("hidden_instruction", "svg text content",
                  location="svg text", excerpt=text[:1500])
        return s
