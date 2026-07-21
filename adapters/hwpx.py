"""HWPX (ZIP+XML) 어댑터 — 표준 zipfile 사용."""
from __future__ import annotations

import zipfile

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import detect_magic, entropy as calc_entropy, find_urls, sha256_hex, sniff_excerpt


class HwpxAdapter(Adapter):
    kind = "hwpx"

    def detect(self, head: bytes, filename: str) -> bool:
        if not head.startswith(b"PK"):
            return False
        try:
            with zipfile.ZipFile(filename) as z:
                names = z.namelist()
                if "mimetype" in names:
                    mt = z.read("mimetype").decode("utf-8", "replace")
                    return "hwpml" in mt or "hwpx" in mt
                return any(n.endswith(".hpf") for n in names)
        except Exception:
            return False

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        s = RiskSurface(kind="hwpx", name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(open(path, "rb").read())
        with zipfile.ZipFile(path) as z:
            for entry in z.namelist():
                lower = entry.lower()
                data = z.read(entry)
                if "script" in lower or lower.endswith(".js"):
                    s.add("exec", f"autorun script entry: {entry}", location=entry,
                          excerpt=sniff_excerpt(data), entropy=calc_entropy(data))
                    s.add("hidden_instruction", "script text", location=entry,
                          excerpt=sniff_excerpt(data, 400))
                if lower.endswith((".xml", ".hpf")):
                    text = data.decode("utf-8", "replace")
                    for url in find_urls(text):
                        s.add("network", "문서 내 외부 URL", location=entry, excerpt=url)
                if lower.startswith("bindata/") or "/bindata/" in lower:
                    magic = detect_magic(data)
                    e = calc_entropy(data)
                    if magic or e > 7.2:
                        s.add("embed", f"embedded object ({magic or 'binary'})",
                              location=entry, entropy=e, magic=magic)
        return s
