"""Span 인스펙션 — Grammarly식 실시간 밑줄의 근거(레지스트리 기반).

시나리오 레지스트리(core.rulepacks)가 모든 탐지를 담당하므로, 이 모듈은
그 Hit 들을 모아 severity 집계 + 복원 가능 마스킹만 얹는다.
→ 새 시나리오를 추가해도 이 파일은 바뀌지 않는다(확장성).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from core import pii
from core.rulepacks import registry

_SEV_WEIGHT = {"critical": 40, "high": 18, "medium": 7, "low": 3}
_SEV_RANK = {"critical": 3, "high": 2, "medium": 1, "low": 0}


@dataclass
class Issue:
    start: int
    end: int
    category: str        # secret|pii|vuln|agency|inject|stego
    rule_id: str
    severity: str
    title: str
    why: str
    fix: str = ""
    suggestion: str = ""
    token: str = ""
    decoded: str = ""


def _color(c: dict) -> str:
    if c["critical"] or c["high"]:
        return "red"
    if c["medium"]:
        return "yellow"
    return "green"


def inspect(text: str, kind: str = "auto") -> dict:
    """텍스트 인스펙션. 반환 dict(issues·summary·overall·score·masked·mapping)."""
    text = text or ""

    # 탐지: 레지스트리(모든 팩) — 단일 소스
    hits = registry.scan(text)

    # 마스킹: 비밀/개인정보 토큰 배정(offset→token 매핑)
    pii_spans = pii.find_spans(text)
    red = pii.redact(text, pii_spans)
    tok = {(s.start, s.end): s.token for s in pii_spans}

    issues = [Issue(h.start, h.end, h.category, h.rule_id, h.severity,
                    h.title, h.why, h.fix, h.suggestion,
                    tok.get((h.start, h.end), ""), h.decoded) for h in hits]
    issues.sort(key=lambda i: (i.start, -_SEV_RANK.get(i.severity, 0)))

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    total = 0
    for i in issues:
        counts[i.severity] = counts.get(i.severity, 0) + 1
        total += _SEV_WEIGHT.get(i.severity, 0)

    return {
        "overall": _color(counts),
        "score": max(0, min(100, total)),
        "summary": counts,
        "issues": [asdict(i) for i in issues],
        "masked": red["masked"],
        "mapping": red["mapping"],
        "has_secrets": any(i.category in ("secret", "pii") for i in issues),
    }
