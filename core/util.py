# © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
"""공용 유틸 — 엔트로피·매직바이트·URL 추출·해시."""
from __future__ import annotations

import hashlib
import math
import re

URL_RE = re.compile(rb"(?:https?://|ftp://)[^\s\"'<>\)\\]]+", re.I)
# 텍스트(str)용
URL_RE_STR = re.compile(r"(?:https?://|ftp://)[^\s\"'<>\)\]]+", re.I)

MAGICS = {
    b"MZ": "PE(실행파일)",
    b"%PDF": "PDF",
    b"%!PS": "PostScript",
    b"PK\x03\x04": "ZIP",
    b"\x7fELF": "ELF(리눅스 실행파일)",
    b"\xd0\xcf\x11\xe0": "OLE2(복합문서)",
    b"\xca\xfe\xba\xbe": "Java class/Mach-O",
}


def entropy(data: bytes) -> float:
    """셰넌 엔트로피. >7.2면 압축/암호화/쉘코드 의심."""
    if not data:
        return 0.0
    freq = [0] * 256
    for b in data:
        freq[b] += 1
    n = len(data)
    return -sum((c / n) * math.log2(c / n) for c in freq if c)


def detect_magic(data: bytes) -> str:
    for sig, name in MAGICS.items():
        if data[:len(sig)] == sig:
            return f"{name}"
    return ""


def find_urls(data: bytes | str) -> list[str]:
    if isinstance(data, str):
        return URL_RE_STR.findall(data)
    return [m.decode("utf-8", "replace") for m in URL_RE.findall(data)]


def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def sniff_excerpt(data: bytes, limit: int = 200) -> str:
    """사람이 읽을 수 있는 근거 일부만 발췌(원문 전체 아님)."""
    text = data.decode("utf-8", "replace")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]
