"""정규식 팩 — scenarios_data 의 선언형 시나리오를 offset span 으로.

새 정규식 시나리오는 scenarios_data.SCENARIOS 에 한 줄만 추가하면 여기서 자동 처리.
"""
from __future__ import annotations

from core.rulepacks.base import Hit
from core.rulepacks.scenarios_data import SCENARIOS

name = "regex"


def scan(text: str) -> list[Hit]:
    hits: list[Hit] = []
    for sc in SCENARIOS:
        if sc.pattern is None:
            continue
        for m in sc.pattern.finditer(text):
            hits.append(Hit(m.start(), m.end(), sc.category, sc.id, sc.severity,
                            sc.title, sc.why, sc.fix, sc.suggestion))
    return hits
