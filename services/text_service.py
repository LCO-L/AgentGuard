"""텍스트 스캔 — 붙여넣기/페이지 본문/메시지의 프롬프트 인젝션·은닉 검사.

파일이 아닌 '순수 텍스트'를 같은 엔진에 태운다. 크롬 익스텐션이 현재 페이지의
보이지 않는 명령을 검사할 때, VS Code 확장이 프롬프트를 검사할 때의 백엔드.
"""
from __future__ import annotations

from core.ai import backend
from core.ai.backend import AIConfig
from core.ai.interpret import interpret
from core.ai.intent import analyze_intent
from core.analyzer import run_layer1
from core.model import Finding, Verdict
from core.scorer import overall, score
from core.surface import RiskSurface
from core.util import sha256_hex
from services import history_service

_MAX = 100_000


def scan_text_content(text: str, source: str = "text",
                      cfg: AIConfig | None = None) -> Verdict:
    cfg = cfg or backend.resolve_config()
    text = (text or "")[:_MAX]

    s = RiskSurface(kind="text", name=source or "pasted-text", raw_ref="(memory)")
    s.fingerprint = sha256_hex(text)
    # 은닉/인젝션 룰 + 쉘/드롭 룰 모두 태우기
    s.add("hidden_instruction", "pasted text", location=source, excerpt=text)
    s.add("exec", "text body (command scan)", location=source, excerpt=text)

    findings = run_layer1(s)
    for res in analyze_intent(s, cfg):
        if res.get("malicious"):
            findings.append(Finding(
                layer=2, rule_id="AI-INTENT-01", cap_kind="hidden_instruction",
                severity="red", where=res.get("where", source),
                what=f"AI 의도 판정: {res.get('pattern', 'hidden intent')}",
                evidence=res.get("reason", ""), i18n_key="secret_read",
                confidence=float(res.get("confidence", 0.85))))

    sev = overall(findings)
    sc = score(findings)
    card = interpret(findings, sev, cfg)
    v = Verdict(surface_kind="text", overall=sev, score=sc, findings=findings,
                card=card, engine=card.source if card else "fallback")
    v.scan_id = history_service.save("text", s.name, v, fingerprint="")
    return v
