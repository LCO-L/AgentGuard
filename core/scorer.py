"""위험도 종합 — 🔴🟡🟢 + 0~100 점수(가중치·조합 부스트).

단순 "가장 나쁜 색"만으로는 '다운로드 + 자동실행'처럼 위험이 결합됐을 때를
표현하지 못한다. ULTRA 는 각 Finding 에 가중치를 주고, 서로 다른 위험 능력이
함께 나타나면 부스트를 더해 진짜 위험한 조합을 상단에 올린다.

부수효과: 각 Finding.weight 를 계산값으로 채운다(설명 카드/디버깅용).
"""
from __future__ import annotations

from core.model import SEV_ORDER, Finding

# severity 기본 가중치
_SEV_WEIGHT = {"red": 34, "yellow": 11, "green": 0}

# 룰 종류별 미세 조정(특히 치명적인 것 가산)
_RULE_BONUS = {
    "HID-SECRET-02": 12,   # 비밀 파일 선행 열기
    "HID-OVERRIDE-03": 10, # 도구 가로채기·은폐
    "NET-EXFIL-02": 14,    # 유출 정황
    "EXEC-MACRO-02": 8,
    "EXEC-DROP-04": 8,
    "EMB-BADOLE-01": 8,
    "STEG-ZWSP-01": 12,    # 은닉 채널 복원
    "STEG-TAG-02": 12,
    "RUG-CHANGE-01": 16,   # 승인 후 변조
}

# 위험 능력 조합 부스트 — {frozenset(cap_kinds): bonus}
_COMBO_BOOST = [
    (frozenset({"exec", "network"}), 12),          # 받아서 실행(드로퍼)
    (frozenset({"hidden_instruction", "network"}), 14),  # 숨은 명령 + 유출 경로
    (frozenset({"exec", "hidden_instruction"}), 10),
    (frozenset({"embed", "exec"}), 8),
    (frozenset({"permission", "network"}), 6),
]


def _weight_of(f: Finding) -> int:
    base = _SEV_WEIGHT.get(f.severity, 0)
    base += _RULE_BONUS.get(f.rule_id, 0)
    return int(round(base * max(0.0, min(1.0, f.confidence))))


def score(findings: list[Finding]) -> int:
    """0~100 위험 점수. Finding.weight 를 채우는 부수효과 있음."""
    if not findings:
        return 0
    total = 0
    for f in findings:
        w = _weight_of(f)
        f.weight = w
        total += w

    kinds = {f.cap_kind for f in findings if f.severity in ("red", "yellow")}
    for combo, bonus in _COMBO_BOOST:
        if combo <= kinds:
            total += bonus

    return max(0, min(100, total))


def overall(findings: list[Finding]) -> str:
    """색 등급 — 점수와 최악 severity 를 함께 고려."""
    if not findings:
        return "green"
    worst = max(SEV_ORDER[f.severity] for f in findings)
    sc = score(findings)
    if worst == 2 or sc >= 55:
        return "red"
    if worst == 1 or sc >= 20:
        return "yellow"
    return "green"
