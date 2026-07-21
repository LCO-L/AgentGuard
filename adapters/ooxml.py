"""OOXML (DOCX·XLSX·PPTX) 어댑터 — 표준 zipfile 사용.

위험이 사는 곳: vbaProject.bin, *.rels 외부 Target, docProps, embeddings.
"""
from __future__ import annotations

import re
import zipfile

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import detect_magic, entropy as calc_entropy, find_urls, sha256_hex, sniff_excerpt

_EXT_KIND = {".docx": "docx", ".docm": "docx", ".xlsx": "xlsx",
             ".xlsm": "xlsx", ".pptx": "pptx", ".pptm": "pptx"}


class OoxmlAdapter(Adapter):
    kind = "docx"

    def detect(self, head: bytes, filename: str) -> bool:
        if not head.startswith(b"PK"):
            return False
        try:
            with zipfile.ZipFile(filename) as z:
                return "[Content_Types].xml" in z.namelist()
        except Exception:
            return False

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        import os
        ext = os.path.splitext(name or path)[1].lower()
        kind = _EXT_KIND.get(ext, "docx")
        s = RiskSurface(kind=kind, name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(open(path, "rb").read())

        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            for entry in names:
                lower = entry.lower()
                data = z.read(entry)

                # 매크로 컨테이너
                if "vbaproject" in lower:
                    s.add("exec", "macro vbaProject present", location=entry,
                          excerpt=sniff_excerpt(data, 300),
                          entropy=calc_entropy(data), magic="vbaProject")

                # 외부 관계(외부 템플릿/링크)
                if lower.endswith(".rels"):
                    text = data.decode("utf-8", "replace")
                    for m in re.finditer(r'TargetMode="External"[^>]*Target="([^"]+)"', text):
                        s.add("network", "외부 관계(External Target)",
                              location=entry, excerpt=m.group(1))
                    for url in find_urls(text):
                        s.add("network", "rels 내 외부 URL", location=entry, excerpt=url)

                # 신원 단서
                if lower.endswith("core.xml"):
                    s.add("identity", "문서 메타(작성자)",
                          location=entry, excerpt=sniff_excerpt(data, 150))

                # 임베드 오브젝트
                if "embeddings" in lower:
                    magic = detect_magic(data)
                    e = calc_entropy(data)
                    s.add("embed", f"embedded object ({magic or 'binary'})",
                          location=entry, entropy=e, magic=magic)

                # 본문 문서의 URL
                if lower in ("word/document.xml", "xl/sharedstrings.xml"):
                    for url in find_urls(data.decode("utf-8", "replace")):
                        s.add("network", "본문 내 외부 URL", location=entry, excerpt=url)
        return s
