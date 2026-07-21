"""PDF 어댑터 — 의존성 0, 원시 토큰 스캔(설치 리스크 0).

pikepdf 없이 바이트 토큰으로 위험 트리거를 잡는다.
"""
from __future__ import annotations

import re

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import entropy as calc_entropy, find_urls, sha256_hex, sniff_excerpt

_TOKENS = {
    rb"/OpenAction": ("exec", "autorun /OpenAction present"),
    rb"/AA": ("exec", "autorun /AA(추가 액션) present"),
    rb"/Launch": ("exec", "/Launch 외부 프로그램 실행 지시"),
    rb"/JavaScript": ("exec", "/JavaScript 액션 존재"),
    rb"/JS": ("exec", "/JS 스크립트 존재"),
    rb"/EmbeddedFile": ("embed", "embedded file present"),
    rb"/Encrypt": ("permission", "encrypt 검사회피용 암호화"),
}


class PdfAdapter(Adapter):
    kind = "pdf"

    def detect(self, head: bytes, filename: str) -> bool:
        return head.startswith(b"%PDF")

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        data = open(path, "rb").read()
        s = RiskSurface(kind="pdf", name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(data)

        for token, (cap_kind, detail) in _TOKENS.items():
            for m in re.finditer(re.escape(token), data):
                excerpt = sniff_excerpt(data[m.start():m.start() + 300])
                s.add(cap_kind, detail, location=f"offset {m.start()}", excerpt=excerpt)
                break  # 토큰당 1걸만(중복 억제)

        for url in find_urls(data):
            s.add("network", "외부 URL 발견", location="body", excerpt=url)

        # 임베드 스트림 엔트로피 근사
        streams = re.findall(rb"stream\r?\n(.{200,}?)\r?\nendstream", data, re.S)
        for i, blob in enumerate(streams[:10]):
            e = calc_entropy(blob)
            if e > 7.2:
                s.add("embed", "고엔트로피 스트림", location=f"stream#{i}",
                      entropy=e)

        # 폴리글랏: PDF 인데 내부에 ZIP/실행파일 컨테이너가 겹쳐 있음
        if b"PK\x03\x04" in data[8:]:
            s.add("embed", "PDF+ZIP 폴리글랏(한 파일이 두 포맷)",
                  location="polyglot", excerpt="PK header inside PDF")
        mz = data.find(b"MZ", 8)
        if mz != -1 and data[mz:mz + 64].find(b"This program") != -1:
            s.add("embed", "PDF 내부에 실행파일(PE) 흔적",
                  location=f"offset {mz}", magic="MZ")
        return s
