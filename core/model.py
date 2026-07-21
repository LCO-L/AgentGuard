# © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
"""판정 산출물 — Finding / InterpretedCard / Verdict.

rule_id는 포맷이 아니라 위험 종류(EXEC-*/NET-*/HID-*…) 기준.
"""
from __future__ import annotations

from dataclasses import dataclass, field

SEV_ORDER = {"green": 0, "yellow": 1, "red": 2}


@dataclass
class Finding:
    layer: int                # 1|2|3 — 방어 3층 중 어디
    rule_id: str              # "EXEC-AUTORUN-01" 등 (포맷 무관)
    cap_kind: str             # 어느 Capability에서 나왔나
    severity: str             # "red"|"yellow"|"green"
    where: str                # 어디서 발견(스트림/키/페이지)
    what: str                 # 기계적 사실("자동실행 스크립트 존재")
    evidence: str = ""        # 근거 스니펫(원문 아닌 요약/패털명)
    i18n_key: str = ""        # 통역 매핑 키(폴 백용)
    weight: int = 0           # 위험 점수 기여도(scorer가 채움)
    confidence: float = 1.0   # 판정 확신도(AI층은 <1.0 가능)


@dataclass
class InterpretedCard:
    overall: str
    headline: str
    hidden: str = ""          # 🔴 무엇이 숨어있나
    how: str = ""             # 🟡 어떻게 작동하나
    impact: str = ""          # 🔴 내 기기에 무슨 피해
    action: str = ""          # 지금 할 일(짧게)
    source: str = "fallback"  # "ollama" | "claude" | "openrouter" | "fallback"


@dataclass
class Verdict:
    surface_kind: str         # 무슨 포맷이었나(카드 배지용)
    overall: str              # "red"|"yellow"|"green"
    score: int = 0            # 0–100 위험 점수(높을수록 위험)
    findings: list[Finding] = field(default_factory=list)
    card: InterpretedCard | None = None
    scan_id: str = ""         # 이력 조회용 ID (services가 부여)
    engine: str = ""          # 통역 엔진("ollama"/"claude"/"openrouter"/"fallback")
