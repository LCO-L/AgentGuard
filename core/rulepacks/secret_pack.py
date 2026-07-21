# © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
"""시크릿·PII 팩 — core.pii 를 Hit 으로 감싼다(마스킹은 inspect 가 토큰 채움)."""
from __future__ import annotations

from core import pii
from core.rulepacks.base import Hit

name = "secret"


def scan(text: str) -> list[Hit]:
    hits: list[Hit] = []
    for s in pii.find_spans(text):
        hits.append(Hit(s.start, s.end, s.kind, s.rule_id, s.severity,
                        s.label, s.why))
    return hits
