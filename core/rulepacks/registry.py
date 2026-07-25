# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""팩 레지스트리 — 등록된 모든 팩을 순회해 Hit 을 모은다.

★ 새 팩 추가 = 파일 1개 + PACKS 에 한 줄. 엔진(inspect)은 이 레지스트리만 부른다.
"""
from __future__ import annotations

from core.rulepacks import regex_pack, secret_pack, stego_pack
from core.rulepacks.base import Hit
from core.rulepacks.scenarios_data import SCENARIOS

# 등록된 팩(각 모듈은 name + scan(text)->list[Hit] 를 제공)
PACKS = [regex_pack, secret_pack, stego_pack]


def scan(text: str) -> list[Hit]:
    hits: list[Hit] = []
    for pack in PACKS:
        try:
            hits.extend(pack.scan(text))
        except Exception:
            continue
    return hits


def catalog() -> list[dict]:
    """등록된 시나리오 카탈로그(관리 화면·문서·가시성용)."""
    out = [{"id": s.id, "category": s.category, "severity": s.severity,
            "title": s.title, "why": s.why, "has_fix": bool(s.fix),
            "pack": "regex"} for s in SCENARIOS]
    # 코드 기반 팩(대표 항목)
    out += [
        {"id": "SEC-*", "category": "secret", "severity": "critical",
         "title": "API 키·토큰·PEM 등 시크릿", "why": "AI로 보내면 노출·악용될 수 있어요.",
         "has_fix": True, "pack": "secret"},
        {"id": "PII-*", "category": "pii", "severity": "high",
         "title": "주민번호·카드·전화·이메일 등 개인정보", "why": "유출 위험이 있어요.",
         "has_fix": True, "pack": "secret"},
        {"id": "STEG-*", "category": "stego", "severity": "critical",
         "title": "제로위드·태그문자·닮은꼴 은닉", "why": "보이지 않는 명령 은닉을 복원합니다.",
         "has_fix": False, "pack": "stego"},
    ]
    return out


def stats() -> dict:
    cats: dict[str, int] = {}
    for s in SCENARIOS:
        cats[s.category] = cats.get(s.category, 0) + 1
    return {"regex_scenarios": len(SCENARIOS), "by_category": cats,
            "packs": [p.name for p in PACKS]}
