# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""은닉/닮은꼴 팩 — textnorm 기반 offset span(제로위드·태그·homoglyph·BiDi)."""
from __future__ import annotations

import re

from core.rulepacks.base import Hit
from core.textnorm import HOMO_TABLE_KEYS, scan_text

name = "stego"

_HOMO_RE = re.compile("[" + HOMO_TABLE_KEYS + "]+")
_ZW_RE = re.compile(r"[​‌‍⁠﻿᠎‎‏]+")


def scan(text: str) -> list[Hit]:
    hits: list[Hit] = []
    if not text:
        return hits
    ts = scan_text(text)
    if ts.decoded_hidden or ts.zero_width_count >= 6 or ts.has_tag_chars:
        zm = _ZW_RE.search(text)
        start = zm.start() if zm else 0
        end = zm.end() if zm else min(len(text), 1)
        hits.append(Hit(start, end, "stego", "STEG-ZWSP-01", "critical",
                        "보이지 않는 글자", "글자 사이에 숨긴 명령이 있어요.",
                        decoded=ts.decoded_hidden))
    for m in _HOMO_RE.finditer(text):
        hits.append(Hit(m.start(), m.end(), "stego", "HID-HOMO-08", "high",
                        "닮은꼴 문자 위장", "비슷하게 생긴 다른 문자로 위장했어요."))
    if ts.has_bidi_override:
        hits.append(Hit(0, min(len(text), 1), "stego", "STEG-BIDI-03", "medium",
                        "방향 뒤집기", "글자 방향을 뒤집어 표기를 위장했어요."))
    return hits
