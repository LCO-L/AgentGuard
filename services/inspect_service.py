"""인스펙션 서비스 — 웹 보안 에디터·익스텐션의 실시간 백엔드.

span 인스펙션(core.inspect) + 복원 가능 마스킹(core.pii)을 얇게 감싼다.
선택적으로 LLM 이 최상위 이슈에 대해 '왜/어떻게'를 한 문장 보강(규칙이 근거, AI 보조).
원문·마스킹 매핑은 저장하지 않는다(비저장 원칙).
"""
from __future__ import annotations

from core import inspect as core_inspect
from core import pii
from core.ai import backend
from core.ai.backend import AIConfig
from core.rulepacks import registry


def inspect_text(text: str, kind: str = "auto",
                 cfg: AIConfig | None = None, explain: bool = False) -> dict:
    result = core_inspect.inspect(text, kind)
    if explain and result["issues"]:
        cfg = cfg or backend.resolve_config()
        note = _llm_summary(result, cfg)
        if note:
            result["coach_note"] = note
    return result


def redact_text(text: str) -> dict:
    """복원 가능 마스킹만 필요할 때(Outbound 전송 직전)."""
    spans = pii.find_spans(text)
    r = pii.redact(text, spans)
    return {
        "masked": r["masked"],
        "mapping": r["mapping"],
        "count": r["count"],
        "spans": [{"start": s.start, "end": s.end, "label": s.label,
                   "severity": s.severity, "token": s.token} for s in spans],
    }


# 제거 대상 카테고리 — '민감정보'가 아니라 '공격/은닉'이라 마스킹이 아니라 제외한다
_REMOVE_CATEGORIES = ("inject", "stego")


def sanitize_text(text: str) -> dict:
    """AI 전송 전 정화. 두 가지를 '다르게' 처리한다.

    - 민감정보(secret·pii): 복원 가능 **마스킹**([SECRET_1] 등) — 뜻은 살리고 값만 가림
    - 프롬프트 인젝션·은닉(inject·stego): 민감정보가 아니라 공격이므로 **제거(제외)**

    반환: {sanitized, mapping(마스킹 복원용), masked, removed}
    """
    pii_spans = pii.find_spans(text)
    red = pii.redact(text, pii_spans)  # 각 span에 token 배정 + mapping 생성
    hits = registry.scan(text)

    # (start, end, replacement, kind) 편집 목록 — 마스킹은 토큰으로, 공격은 빈 문자열로
    edits = [(s.start, s.end, s.token, "mask") for s in pii_spans]
    for h in hits:
        if h.category in _REMOVE_CATEGORIES:
            edits.append((h.start, h.end, "", "remove"))

    # 겹치면 먼저(그리고 더 넓은) 것을 우선 — 이중 편집 방지
    edits.sort(key=lambda e: (e[0], -(e[1] - e[0])))
    picked, last_end = [], -1
    for e in edits:
        if e[0] >= last_end:
            picked.append(e)
            last_end = e[1]

    out = text
    for start, end, repl, _kind in sorted(picked, key=lambda e: e[0], reverse=True):
        out = out[:start] + repl + out[end:]

    return {
        "sanitized": out,
        "mapping": red["mapping"],
        "masked": sum(1 for e in picked if e[3] == "mask"),
        "removed": sum(1 for e in picked if e[3] == "remove"),
    }


_SYS = """너는 보안 코치다. 아래는 어떤 텍스트를 검사해 찾은 위험 목록(카테고리·제목만)이다.
원문은 주지 않는다. 이 목록을 근거로, 초보 개발자에게 '지금 무엇을 가장 먼저 고쳐야 하는지'
한국어 한두 문장으로만 조언하라. 과장 금지, 목록에 없는 사실 지어내지 마라. 문장만 출력."""


def _llm_summary(result: dict, cfg: AIConfig) -> str:
    if cfg.provider == "off":
        return ""
    top = [f"{i['severity']}:{i['category']}:{i['title']}" for i in result["issues"][:8]]
    user = "위험 목록: " + "; ".join(top)
    out, _ = backend.complete(_SYS, user, cfg, max_tokens=160)
    return (out or "").strip()
