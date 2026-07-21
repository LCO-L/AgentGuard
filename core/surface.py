# © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
"""★ RiskSurface — 모든 어댑터의 공통 산출물(통합 계약).

포맷의 다양성은 여기서 흡수된다. 이 아래로는 세상에 포맷이 하나뿐인 것처럼 동작.
어댑터는 아는 필드만 채우고 모르는 건 빈 값.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# 위험을 6종 "능력"으로 환원 — 포맷 다양성은 여기서 죽는다.
CAP_KINDS = ("exec", "network", "hidden_instruction",
             "permission", "embed", "identity")


@dataclass
class Capability:
    kind: str                 # CAP_KINDS 중 하나
    detail: str               # 기계적 사실(예: "autostart script present")
    location: str = ""        # 어디서(스트림/키/페이지)
    text_excerpt: str = ""    # 사람이 읽을 근거 일부(원문 전체 아님)
    entropy: float = 0.0
    magic: str = ""           # 임베드 객체 매직(MZ/%PDF/%!PS…)


@dataclass
class RiskSurface:
    kind: str                 # "hwp"|"hwpx"|"docx"|"xlsx"|"pptx"|"pdf"|"mcp"|"extension"|"url"
    name: str                 # 파일명/도구명/URL
    raw_ref: str              # 로컬 경로(원본은 여기 머묾, 전송 X)
    author_hint: str = ""     # 제작자/서명/등록자 등 '신원' 단서
    capabilities: list[Capability] = field(default_factory=list)
    fingerprint: str = ""     # 3층 러그풀용 구조/설명서 해시

    def add(self, kind: str, detail: str, location: str = "",
            excerpt: str = "", entropy: float = 0.0, magic: str = "") -> None:
        assert kind in CAP_KINDS, f"unknown capability kind: {kind}"
        self.capabilities.append(
            Capability(kind, detail, location, excerpt, entropy, magic))
