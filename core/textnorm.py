# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""텍스트 은닉·난독 실탐지 — ULTRA 1층의 눈.

"규칙은 표현 바꾸면 뚫린다"의 대표 우회가 **보이지 않는 문자**다.
사람 눈엔 평범한 문서인데, 모델·에이전트가 읽는 바이트엔 숨은 명령이 박혀 있다.
이 모듈은 그 은닉 채널을 실제로 *디코딩*해서 드러낸다:

1. 제로위드 스테가노  — U+200B/200C… 를 0/1로 본 이진 밀수(실제 ASCII 복원)
2. 태그 문자 밀수     — U+E0000~E007F 로 감춘 ASCII(복원)
3. 양방향 제어(BiDi)  — RLO/LRO 로 화면 표기와 실제 바이트를 뒤집는 수법
4. 닮은꼴(homoglyph)  — 키릴·그리스·전각을 라틴으로 정규화해 재매칭 가능케

핵심 원칙: 숨은 채널에서 *복원한 평문*을 analyzer가 다시 룰에 태우게 한다.
그래서 homoglyph 로 위장한 "ignore previous" 도, 제로위드로 밀수한
"send id_rsa" 도 1층에서 결정적으로 잡힌다. AI 없이도.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache

# ── 보이지 않는/제어 문자 집합 ────────────────────────────
ZERO_WIDTH = {
    "​",  # ZERO WIDTH SPACE
    "‌",  # ZERO WIDTH NON-JOINER
    "‍",  # ZERO WIDTH JOINER
    "⁠",  # WORD JOINER
    "﻿",  # ZERO WIDTH NO-BREAK SPACE / BOM
    "᠎",  # MONGOLIAN VOWEL SEPARATOR
    "‎",  # LEFT-TO-RIGHT MARK
    "‏",  # RIGHT-TO-LEFT MARK
}
BIDI_CONTROLS = {
    "‪", "‫", "‬", "‭", "‮",  # LRE RLE PDF LRO RLO
    "⁦", "⁧", "⁨", "⁩",            # LRI RLI FSI PDI
}
# 태그 문자(ASCII smuggling): U+E0000 base … U+E007F
TAG_BLOCK_LO, TAG_BLOCK_HI = 0xE0000, 0xE007F

# ── 닮은꼴(confusables) → 라틴 정규화 맵(대표 부분집합) ─────
# NFKC 가 전각/합자 상당수를 처리하므로 여기선 키릴·그리스 위주로 보강.
_HOMOGLYPHS = {
    # Cyrillic → Latin
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c",
    "х": "x", "у": "y", "і": "i", "ѕ": "s", "ԁ": "d",
    "һ": "h", "ӏ": "l", "ј": "j", "ԛ": "q", "ԝ": "w",
    "н": "h", "м": "m", "т": "t", "в": "b", "к": "k",
    "п": "n",
    "А": "A", "Е": "E", "О": "O", "Р": "P", "С": "C",
    "Х": "X", "У": "Y", "І": "I", "Ѕ": "S", "В": "B",
    "К": "K", "М": "M", "Н": "H", "Т": "T",
    # Greek → Latin
    "ο": "o", "α": "a", "ν": "v", "ρ": "p", "ε": "e",
    "ι": "i", "κ": "k", "μ": "u", "τ": "t", "υ": "u",
    "χ": "x",
    "Ο": "O", "Α": "A", "Ρ": "P", "Ε": "E", "Ι": "I",
    "Κ": "K", "Τ": "T", "Χ": "X", "Β": "B", "Ν": "N",
    "Μ": "M", "Η": "H", "Ζ": "Z",
}
_HOMO_TABLE = {ord(k): v for k, v in _HOMOGLYPHS.items()}
# 외부(inspect)에서 offset 탐지에 쓰는 닮은꼴 문자 집합(정규식 char class 용)
HOMO_TABLE_KEYS = "".join(_HOMOGLYPHS.keys())

_ZW01 = ("​", "‌")  # 관례 A: ZWSP=0, ZWNJ=1


@dataclass
class TextScan:
    """텍스트 1건 은닉/난독 분석 결과."""
    original_len: int = 0
    visible: str = ""              # 숨은 문자를 걷어낸 '사람이 보는' 텍스트
    normalized: str = ""           # homoglyph→라틴 + NFKC + 숨은문자 제거(룰 재매칭용)
    decoded_hidden: str = ""       # 은닉 채널에서 복원한 평문(핵심 증거)
    zero_width_count: int = 0
    has_bidi_override: bool = False
    has_tag_chars: bool = False
    homoglyph_hits: int = 0
    notes: list[str] = field(default_factory=list)

    @property
    def has_hidden_channel(self) -> bool:
        return bool(self.decoded_hidden) or self.zero_width_count >= 6 or \
            self.has_tag_chars or self.has_bidi_override

    @property
    def match_text(self) -> str:
        """룰 매칭에 태울 통합 텍스트(정규화 가시본 + 복원 평문)."""
        return f"{self.normalized}\n{self.decoded_hidden}"


def _decode_zero_width(seq: str) -> str:
    """제로위드 비트열을 ASCII 로 복원. 두 관례를 모두 시도.

    관례 A: ZWSP(200b)=0, ZWNJ(200c)=1
    관례 B: ZWNJ(200c)=0, ZWJ(200d)=1
    8비트 묶음이 인쇄가능 ASCII 로 떨어지면 유효 디코딩으로 인정.
    """
    for zero, one in (("​", "‌"), ("‌", "‍")):
        bits = "".join(
            "0" if ch == zero else "1" if ch == one else ""
            for ch in seq
        )
        if len(bits) < 8:
            continue
        chars: list[str] = []
        ok = True
        for i in range(0, len(bits) - (len(bits) % 8), 8):
            code = int(bits[i:i + 8], 2)
            if 32 <= code <= 126 or code in (9, 10, 13):
                chars.append(chr(code))
            else:
                ok = False
                break
        text = "".join(chars).strip()
        if ok and len(text) >= 3:  # 우연 방지: 최소 3자
            return text
    return ""


def _decode_tag_chars(s: str) -> str:
    out = []
    for ch in s:
        cp = ord(ch)
        if TAG_BLOCK_LO <= cp <= TAG_BLOCK_HI:
            ascii_cp = cp - 0xE0000
            if 0x20 <= ascii_cp <= 0x7E:
                out.append(chr(ascii_cp))
    return "".join(out).strip()


@lru_cache(maxsize=1024)
def scan_text(s: str) -> TextScan:
    """텍스트 1건을 은닉/난독 관점에서 분석(결과 캐시 — 읽기전용 취급)."""
    ts = TextScan(original_len=len(s or ""))
    if not s:
        return ts

    # 1) 제로위드 스테가노
    zw_seq = "".join(ch for ch in s if ch in ("​", "‌", "‍"))
    ts.zero_width_count = sum(1 for ch in s if ch in ZERO_WIDTH)
    if len(zw_seq) >= 8:
        decoded = _decode_zero_width(zw_seq)
        if decoded:
            ts.decoded_hidden = decoded
            ts.notes.append(f"제로위드 스테가노 복원: {decoded[:60]!r}")

    # 2) 태그 문자 밀수
    if any(TAG_BLOCK_LO <= ord(ch) <= TAG_BLOCK_HI for ch in s):
        ts.has_tag_chars = True
        tag_decoded = _decode_tag_chars(s)
        if tag_decoded:
            ts.decoded_hidden = (ts.decoded_hidden + " " + tag_decoded).strip()
            ts.notes.append(f"태그문자 ASCII 밀수 복원: {tag_decoded[:60]!r}")

    # 3) BiDi 오버라이드
    if any(ch in BIDI_CONTROLS for ch in s):
        ts.has_bidi_override = True
        ts.notes.append("양방향 제어문자(RLO/LRO)로 표기 위장")

    # 4) 가시 텍스트 = 숨은/제어 문자 제거
    hidden_all = ZERO_WIDTH | BIDI_CONTROLS
    ts.visible = "".join(
        ch for ch in s
        if ch not in hidden_all and not (TAG_BLOCK_LO <= ord(ch) <= TAG_BLOCK_HI)
    )

    # 5) homoglyph 정규화 → 라틴, 이어서 NFKC(전각/합자)
    folded = ts.visible.translate(_HOMO_TABLE)
    ts.homoglyph_hits = sum(1 for ch in ts.visible if ord(ch) in _HOMO_TABLE)
    ts.normalized = unicodedata.normalize("NFKC", folded)
    if ts.homoglyph_hits >= 2:
        ts.notes.append(f"닮은꼴 문자 {ts.homoglyph_hits}개를 라틴으로 정규화")

    return ts


def normalize_for_match(s: str) -> str:
    """여러 텍스트를 룰 매칭용 통합 문자열로."""
    return scan_text(s).match_text
