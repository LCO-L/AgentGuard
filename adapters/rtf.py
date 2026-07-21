"""RTF 어댑터 — DDE 자동실행·OLE 임베드의 고전 벡터.

RTF 는 실행파일이 아니지만, 열리자마자 외부 명령을 부르는 DDEAUTO 나
OLE 객체(\\objdata)로 악성 페이로드를 나른다. 원시 토큰만으로 탐지(의존성 0).
"""
from __future__ import annotations

import re

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import find_urls, sha256_hex

_TOKENS = {
    "dde": re.compile(rb"(ddeauto|\\dde\b)", re.I),
    "object": re.compile(rb"\\object\b", re.I),
    "objdata": re.compile(rb"\\objdata\b", re.I),
    "objupdate": re.compile(rb"\\objupdate\b", re.I),
    "objemb": re.compile(rb"\\objemb\b", re.I),
    "objautlink": re.compile(rb"\\objautlink\b", re.I),
}


class RtfAdapter(Adapter):
    kind = "rtf"

    def detect(self, head: bytes, filename: str) -> bool:
        return head.lstrip()[:6].lower().startswith(b"{\\rtf")

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        data = open(path, "rb").read()
        s = RiskSurface(kind="rtf", name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(data)

        # DDE 자동실행
        if _TOKENS["dde"].search(data):
            m = _TOKENS["dde"].search(data)
            ctx = data[m.start():m.start() + 200].decode("latin-1", "replace")
            s.add("exec", "dde auto-exec (DDEAUTO)", location="rtf body",
                  excerpt=ctx)

        # OLE 임베드 계열
        for key in ("object", "objdata", "objupdate", "objemb", "objautlink"):
            if _TOKENS[key].search(data):
                s.add("embed", f"embedded OLE object (\\{key})",
                      location="rtf body", excerpt=f"\\{key}")

        # \objdata hex blob 은 종종 실행파일 헤더(4d5a=MZ, d0cf=OLE)로 시작
        for m in re.finditer(rb"\\objdata[^{}]*?([0-9a-fA-F]{16,})", data):
            hexblob = m.group(1)[:8].lower()
            if hexblob.startswith(b"d0cf") or hexblob.startswith(b"4d5a"):
                magic = "PE(실행파일)" if hexblob.startswith(b"4d5a") else "OLE2(복합문서)"
                s.add("embed", f"objdata blob magic: {magic}",
                      location="objdata", excerpt=hexblob.decode("ascii", "replace"),
                      magic="MZ" if hexblob.startswith(b"4d5a") else "OLE")

        for url in find_urls(data):
            s.add("network", "본문 내 외부 URL", location="rtf body", excerpt=url)
        return s
