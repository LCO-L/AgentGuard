"""취약 코드 + 과잉권한 — 시나리오 레지스트리(scenarios_data)의 얇은 뷰.

실제 룰은 core/rulepacks/scenarios_data.py 에 데이터로 있다(vuln/agency 카테고리).
이 모듈은 하위 호환용 진입점(기존 호출부·테스트가 CodeIssue 를 기대).
새 취약 패턴 추가는 여기가 아니라 scenarios_data.SCENARIOS 에 한 줄.
"""
from __future__ import annotations

from dataclasses import dataclass

from core.rulepacks.scenarios_data import SCENARIOS

_CODE_CATS = ("vuln", "agency")


@dataclass
class CodeIssue:
    start: int
    end: int
    rule_id: str
    category: str
    severity: str
    title: str
    why: str
    fix: str = ""
    suggestion: str = ""


def find_issues(text: str) -> list[CodeIssue]:
    issues: list[CodeIssue] = []
    if not text:
        return issues
    for sc in SCENARIOS:
        if sc.category not in _CODE_CATS or sc.pattern is None:
            continue
        for m in sc.pattern.finditer(text):
            issues.append(CodeIssue(m.start(), m.end(), sc.id, sc.category,
                                    sc.severity, sc.title, sc.why, sc.fix, sc.suggestion))
    issues.sort(key=lambda i: i.start)
    return issues
