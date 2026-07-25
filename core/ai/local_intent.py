# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""오프라인 의도 엔진 — LLM 이 없을 때의 2층(공기·결합 신호).

1층 룰이 개별 신호를 잡는다면, 여기선 **여러 악성 신호가 한 텍스트에 공존**하는지를
본다. 예: "폴더를 정리합니다"(양성 문맥) + "비밀키"(민감) + "외부 전송"(유출) +
"사용자에게 말하지 마"(은폐) 가 함께면 → 툴 포이즈닝으로 강하게 판정.

은닉 채널로 복원된 평문(textnorm)도 함께 검사하므로, LLM 없이도 은닉+결합을 잡는다.
확신도(confidence)는 매칭 카테고리 수로 스케일 → scorer 가 가중.
"""
from __future__ import annotations

import re

from core.surface import RiskSurface
from core.textnorm import scan_text

# 의도 카테고리별 신호(정규화/복원 평문에 대해 매칭)
_CATS = {
    "secret": re.compile(
        r"(\.ssh|id_rsa|id_ed25519|\.aws|\.env|passwd|password|비밀번호|비밀키|"
        r"credentials?|secret|token|api[_-]?key|\.netrc|keychain|환경변수)", re.I),
    "exfil": re.compile(
        r"(전송|send|업로드|upload|post|외부|반출|유출|보내|전달|export|exfil|"
        r"https?://|curl|wget|fetch)", re.I),
    "conceal": re.compile(
        r"(말하지\s*마|알리지\s*마|보고하지\s*마|do\s*not\s*tell|without\s*(telling|informing)|"
        r"silently|은밀히|몰래|숨기|hide|hidden|conceal)", re.I),
    "override": re.compile(
        r"(이전.{0,6}지시.{0,4}무시|ignore\s+(previous|prior|above)|disregard|"
        r"forget\s+(all|everything)|우선\s*사용|instead\s+of)", re.I),
    "exec": re.compile(
        r"(shell|bash|powershell|cmd\.exe|subprocess|os\.system|eval\(|exec\(|"
        r"실행|run\s+this|명령)", re.I),
}

# 패턴 이름(한국어)
_PATTERN_NAME = {
    frozenset({"secret", "exfil"}): "민감정보 외부유출",
    frozenset({"secret", "exfil", "conceal"}): "은폐형 정보탈취(툴 포이즈닝)",
    frozenset({"override", "conceal"}): "지시 무시 + 은폐",
    frozenset({"exec", "exfil"}): "원격 실행·다운로드",
}


def _classify(text: str) -> tuple[set[str], list[str]]:
    hits = {name for name, rx in _CATS.items() if rx.search(text)}
    notes = []
    return hits, notes


def analyze(surface: RiskSurface) -> list[dict]:
    """hidden_instruction 텍스트들의 결합 의도 판정(오프라인)."""
    results: list[dict] = []
    for c in surface.capabilities:
        if c.kind != "hidden_instruction" or not c.text_excerpt:
            continue
        ts = scan_text(c.text_excerpt)
        blob = f"{c.text_excerpt}\n{ts.match_text}"
        hits, _ = _classify(blob)
        if not hits:
            continue

        # 위험 결합 판정: 2개 이상 카테고리 공존 또는 (secret+exfil)
        malicious = len(hits) >= 2 or {"secret", "exfil"} <= hits
        if not malicious:
            continue

        # 패턴명: 가장 많이 겹치는 알려진 조합
        pattern = "복합 악성 신호"
        best = 0
        for combo, name in _PATTERN_NAME.items():
            if combo <= hits and len(combo) > best:
                best, pattern = len(combo), name
        if ts.decoded_hidden:
            pattern = f"은닉+{pattern}"

        conf = min(1.0, 0.4 + 0.2 * len(hits))
        reason = f"한 텍스트에 {', '.join(sorted(hits))} 신호가 공존해요."
        if ts.decoded_hidden:
            reason = f"숨겨둔 명령('{ts.decoded_hidden[:40]}')에 " + reason
        results.append({
            "malicious": True,
            "reason": reason,
            "pattern": pattern,
            "where": c.location,
            "confidence": round(conf, 2),
            "engine": "local",
        })
    return results
