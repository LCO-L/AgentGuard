# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""③ 통역 카드 생성 — LLM(ollama/claude/openrouter) 우선, 폴백 보장(생존선).

원본은 절대 AI로 안 감. Finding(위험 메타)만 전달.
어떤 환경에서도 카드를 반환한다(키 없어도, 오프라인이어도).
"""
from __future__ import annotations

import json

from core.ai import backend
from core.ai.backend import AIConfig
from core.model import Finding, InterpretedCard

# ── 폴백 테이블: i18n_key → (설명, 행동) ────────────────
FALLBACK: dict[str, tuple[str, str]] = {
    "autorun":       ("열자마자 자동으로 실행되는 명령이 들어 있어요.", "열지 마세요. 삭제하세요."),
    "macro":         ("문서 안에 자동으로 실행되는 매크로가 숨어 있어요.", "열지 마세요. 삭제하세요."),
    "shell_cmd":     ("컴퓨터에 직접 명령을 내리는 코드가 있어요.", "실행하지 마세요."),
    "dropper":       ("다른 프로그램을 몰래 내려받아 설치하려 해요.", "열지 마세요. 삭제하세요."),
    "dde":           ("문서가 열릴 때 외부 명령을 자동 실행하도록 짜여 있어요.", "열지 마세요. 삭제하세요."),
    "svg_script":    ("그림 파일(SVG) 안에 실행되는 스크립트가 숨어 있어요.", "열지 마세요."),
    "ext_url":       ("낯선 인터넷 주소와 연결되어 있어요.", "주소를 열지 마세요."),
    "exfil":         ("중요한 파일을 외부로 빼낼 정황이 있어요.", "즉시 삭제하세요."),
    "ssrf":          ("내부 네트워크를 엿보는 주소가 있어요.", "실행하지 마세요."),
    "data_exfil":    ("대화 내용이나 기기 정보를 밖으로 보내려는 지시가 있어요.", "설치·실행하지 마세요."),
    "ignore_prev":   ("숨은 명령이 AI에게 '원래 규칙을 무시하라'고 시켜요.", "설치·열기를 하지 마세요."),
    "secret_read":   ("설명서 안에 '먼저 비밀 파일을 읽어라'는 숨은 명령이 있어요.", "설치하지 마세요."),
    "tool_hijack":   ("다른 도구를 가로채거나 사용자에게 숨기라는 지시가 있어요.", "설치하지 마세요."),
    "obfuscated":    ("내용을 알아보기 어렵게 일부러 꼬아 놓았어요.", "주의가 필요해요."),
    "fake_system":   ("관리자인 척하는 가짜 명령 태그가 숨겨져 있어요.", "설치·열기를 하지 마세요."),
    "persona":       ("AI에게 다른 역할을 강요하는 문구가 있어요.", "주의가 필요해요."),
    "zero_width":    ("눈에 보이지 않는 글자로 명령을 숨겨 놓았어요.", "설치·열기를 하지 마세요."),
    "tag_smuggle":   ("특수 유니코드 문자로 숨긴 명령이 들어 있어요.", "설치·열기를 하지 마세요."),
    "bidi":          ("글자 방향을 뒤집어 파일 이름·내용을 위장했어요.", "주의가 필요해요."),
    "homoglyph":     ("비슷하게 생긴 다른 문자로 명령어를 위장했어요.", "설치·열기를 하지 마세요."),
    "bad_ole":       ("문서 안에 실행 가능한 프로그램 조각이 숨겨져 있어요.", "삭제하세요."),
    "high_entropy":  ("암호화되거나 꽉 압축된 의심스러운 덩어리가 있어요.", "주의가 필요해요."),
    "embed_file":    ("문서 안에 다른 파일이 내장되어 있어요.", "주의가 필요해요."),
    "zip_slip":      ("압축을 풀면 엉뚱한 시스템 폴더에 파일을 심으려 해요.", "열지 마세요. 삭제하세요."),
    "excess_perm":   ("필요 이상으로 많은 권한을 요구해요.", "권한을 확인하세요."),
    "scope_mismatch":("설명과 실제 권한이 달라요.", "권한을 확인하세요."),
    "encrypted":     ("검사를 피하려고 암호로 잠겨 있어요.", "주의가 필요해요."),
    "double_ext":    ("파일 종류를 속이는 이중 확장자를 썼어요.", "출처를 확인하세요."),
    "unknown_author":("만든 사람이 누군지 확인할 수 없어요.", "출처를 확인하세요."),
    "rugpull":       ("승인한 뒤 내용이 몰래 바뀌었어요.", "승인을 취소하고 다시 확인하세요."),
}

SYSTEM_PROMPT = """너는 보안 통역사다. 아래는 어떤 파일/AI도구를 검사해 발견한 '위험 메타' 목록이다.
원본 내용은 주어지지 않는다. 메타만으로, 컴퓨터를 잘 모르는 사람에게
"무엇이 숨어있나 / 어떻게 작동하나 / 내 기기에 무슨 피해가 오나 / 지금 뭘 해야 하나"를
쉬운 한국어로 설명하라.

[규칙]
- 악성코드 이름·전문용어 금지. (Trojan.Generic 같은 말 쓰지 마라)
- 과장·공포조성 금지. 사실 기반, 담담하게.
- 각 항목 1~2문장. 행동 지시는 명령형 짧게("삭제하세요","열지 마세요").
- 확실치 않으면 단정하지 말고 "그럴 수 있어요"로.
- 주어진 메타에 없는 사실을 지어내지 마라.
- 반드시 JSON 하나만 출력."""

OUTPUT_SCHEMA = {
    "overall": "red|yellow|green",
    "headline": "한 줄 요약(예: 국세청 사칭 파일이에요)",
    "hidden": "🔴 무엇이 숨어있나",
    "how": "🟡 어떻게 작동하나",
    "impact": "🔴 내 기기에 무슨 피해",
    "action": "지금 할 일(짧게)",
}


def _fallback_card(findings: list[Finding], overall: str) -> InterpretedCard:
    """i18n_key 템플릿으로 카드 조립 — API 없어도 항상 동작."""
    if overall == "green":
        return InterpretedCard(
            overall="green",
            headline="특별한 위험을 찾지 못했어요.",
            hidden="숨은 위험이 보이지 않아요.",
            how="정상적인 구조예요.",
            impact="기기에 해를 끼칠 요소를 발견하지 못했어요.",
            action="그래도 출처가 의심스러우면 열지 마세요.",
            source="fallback",
        )
    seen: list[str] = []
    actions: list[str] = []
    for f in findings:
        desc, act = FALLBACK.get(f.i18n_key, ("주의가 필요한 요소가 있어요.", "확인이 필요해요."))
        if desc not in seen:
            seen.append(desc)
        if act not in actions:
            actions.append(act)
    reds = [f for f in findings if f.severity == "red"]
    headline = ("위험한 숨은 명령이 발견됐어요." if reds
                else "주의가 필요한 요소가 있어요.")
    return InterpretedCard(
        overall=overall,
        headline=headline,
        hidden=" ".join(seen[:3]),
        how=" ".join(seen[3:5]) or seen[0],
        impact="파일·화면 정보가 외부로 넘어가거나, 원치 않는 프로그램이 설치될 수 있어요.",
        action=actions[0] if actions else "확인이 필요해요.",
        source="fallback",
    )


def _llm_card(findings: list[Finding], overall: str,
              cfg: AIConfig) -> InterpretedCard | None:
    """LLM 통역. 실패/부재 시 None → 폴백."""
    if cfg.provider == "off":
        return None
    meta = [{"rule_id": f.rule_id, "severity": f.severity,
             "what": f.what, "where": f.where,
             "evidence": f.evidence[:120]} for f in findings]
    user = (f"[입력 findings]\n{json.dumps(meta, ensure_ascii=False)}\n\n"
            f"[출력 JSON 스키마]\n{json.dumps(OUTPUT_SCHEMA, ensure_ascii=False)}")
    out, engine = backend.complete(SYSTEM_PROMPT, user, cfg, max_tokens=700)
    if out is None:
        return None
    data = backend.extract_json(out)
    if not data:
        return None
    return InterpretedCard(
        overall=data.get("overall", overall),
        headline=data.get("headline", ""),
        hidden=data.get("hidden", ""),
        how=data.get("how", ""),
        impact=data.get("impact", ""),
        action=data.get("action", ""),
        source=engine,
    )


def interpret(findings: list[Finding], overall: str,
              cfg: AIConfig | None = None) -> InterpretedCard:
    """LLM 우선, 실패 시 폴백 — 어떤 환경에서든 항상 카드 반환."""
    cfg = cfg or backend.resolve_config()
    return _llm_card(findings, overall, cfg) or _fallback_card(findings, overall)
