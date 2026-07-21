"""1층 — 포맷 무관 결정적 룰 엔진(공용).

RiskSurface의 Capability들을 받아 signatures.RULES와 매칭해 Finding 산출.
탐지 정확성은 여기(코드)가 책임. AI는 통역·의도만.

★ ULTRA 핵심: 모든 룰이 **정규화·복원 평문**에도 매칭된다.
   - homoglyph(키릴 а)로 위장한 "ignore previous" → 라틴 정규화 후 잡힘
   - 제로위드/태그문자로 숨긴 "send id_rsa" → 은닉 채널 복원 후 잡힘
   덕분에 "표현을 바꾼 우회"가 1층에서 결정적으로 무너진다.
"""
from __future__ import annotations

import re

from core.model import Finding
from core.signatures import RULES
from core.surface import Capability, RiskSurface
from core.textnorm import scan_text
from core.util import find_urls

# ── matcher 함수들 (이름 → 판정 함수) ─────────────────────

_PRIVATE_NET = re.compile(
    r"(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)")
_SENSITIVE_PATH = re.compile(
    r"(\.ssh|id_rsa|id_ed25519|\.aws|\.env|passwd|password|비밀번호|환경변수|"
    r"credentials?|secret|token|api[_-]?key|\.netrc|keychain)", re.I)
_SHELL_CALL = re.compile(
    r"(cmd\.exe|powershell|/bin/sh|/bin/bash|subprocess|os\.system|WScript\.Shell|"
    r"curl\s+[^|]*\|\s*(sh|bash)|wget\s+[^|]*\|\s*(sh|bash)|eval\(|exec\()", re.I)
_OBFUSC = re.compile(
    r"(fromCharCode|atob\(|\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}|base64[,\.]|"
    r"[A-Za-z0-9+/]{60,}={0,2})")
_IGNORE_PREV = re.compile(
    r"(이전.{0,6}지시.{0,4}무시|앞선.{0,6}지시.{0,4}무시|위의?\s*지시.{0,4}무시|"
    r"ignore\s+(all\s+)?(previous|prior|above)|disregard\s+(all\s+)?(previous\s+)?instructions?|"
    r"forget\s+(everything|all\s+previous))", re.I)
_HIJACK = re.compile(
    r"(사용자에게.{0,8}(말하지|알리지|보고하지)|do\s+not\s+(tell|inform|notify|mention)\s+the\s+user|"
    r"다른\s+도구.{0,4}대신|instead\s+of\s+.{0,20}tool|without\s+(telling|informing)\s+the\s+user|"
    r"silently|은밀히|몰래)", re.I)
_FAKE_TAG = re.compile(
    r"(\[SYSTEM\]|<IMPORTANT>|<\s*system\s*>|<<SYS>>|\[\[system\]\]|"
    r"###\s*system|<admin>|assistant\s*:\s*sure)", re.I)
_PERSONA = re.compile(
    r"(지금부터\s+너는|이제부터\s+너는|from\s+now\s+on\s+you\s+are|"
    r"개발자\s*모드|developer\s+mode|DAN\s*mode|jailbreak)", re.I)
_MACRO_API = re.compile(
    r"(AutoOpen|Auto_Open|Document_Open|Workbook_Open|Shell\(|CreateObject|"
    r"URLDownloadToFile|DefaultJScript|JScript|WScript)", re.I)
_EXCESS_PERM = re.compile(
    r"(<all_urls>|\*://\*/\*|file:///\*|전\s*파일\s*접근|모든\s*파일|debugger|"
    r"nativeMessaging|management)", re.I)
_DROP = re.compile(
    r"(\.exe[\"'\s\)]|\.dll[\"'\s\)]|\.bat[\"'\s\)]|\.scr[\"'\s\)]|\.ps1[\"'\s\)]|"
    r"/Launch|dropper|payload)", re.I)
_DDE = re.compile(r"(DDEAUTO|\bDDE\b|ddeauto)", re.I)
_SVG_SCRIPT = re.compile(
    r"(<script|onload\s*=|onerror\s*=|onclick\s*=|javascript:|<foreignObject)", re.I)
_DATA_EXFIL = re.compile(
    r"((대화|chat|conversation|메시지|message|clipboard|클립보드|환경변수|"
    r"environment|env\b|history|기록).{0,40}"
    r"(전송|send|외부|upload|업로드|post|export|유출|반출|보내|전달))", re.I)
_ACT_ON_SECRET = re.compile(
    r"(읽어|read|열어|open|첨부|attach|전송|send|collect|exfil|보내|업로드|upload|leak)", re.I)
# 닮은꼴 위장이 '진짜 위험'인지 판정할 정규화 후 키워드
_HOMO_RISK = re.compile(
    r"(ignore|previous|password|id_rsa|ssh|secret|token|exec|eval|"
    r"system|admin|curl|bash|powershell|무시|비밀번호)", re.I)


def _scan(c: Capability):
    return scan_text(c.text_excerpt or "")


def _text(c: Capability) -> str:
    """룰 매칭용 통합 텍스트 = 원본 + 정규화 가시본 + 복원 평문."""
    ts = _scan(c)
    return f"{c.detail} {c.text_excerpt} {ts.match_text}"


def _has_url(c: Capability) -> bool:
    return bool(find_urls(c.detail) or find_urls(c.text_excerpt))


MATCHERS = {
    # exec
    "autorun": lambda c: "autorun" in c.detail or bool(re.search(
        r"auto(run|start|open)|/OpenAction|/AA\b|OpenAction", c.detail, re.I)),
    "macro": lambda c: bool(_MACRO_API.search(_text(c))),
    "shell": lambda c: bool(_SHELL_CALL.search(_text(c))),
    "drop": lambda c: bool(_DROP.search(_text(c))),
    "dde": lambda c: bool(_DDE.search(_text(c))),
    "svg_script": lambda c: "svg" in c.detail.lower() and bool(_SVG_SCRIPT.search(_text(c))),
    # network
    "ext_url": _has_url,
    "exfil": lambda c: _has_url(c) and bool(_SENSITIVE_PATH.search(_text(c))),
    "ssrf": lambda c: bool(_PRIVATE_NET.search(_text(c))),
    # hidden_instruction
    "ignore_prev": lambda c: bool(_IGNORE_PREV.search(_text(c))),
    "secret_read": lambda c: bool(
        _SENSITIVE_PATH.search(_text(c)) and _ACT_ON_SECRET.search(_text(c))),
    "tool_hijack": lambda c: bool(_HIJACK.search(_text(c))),
    "obfuscated": lambda c: bool(_OBFUSC.search(c.text_excerpt)),
    "fake_system": lambda c: bool(_FAKE_TAG.search(_text(c))),
    "persona": lambda c: bool(_PERSONA.search(_text(c))),
    "data_exfil": lambda c: bool(_DATA_EXFIL.search(_text(c))),
    # 은닉 채널(스테가노) — 텍스트 스캐너 결과 사용
    "zero_width_stego": lambda c: bool(_scan(c).decoded_hidden) or _scan(c).zero_width_count >= 6,
    "tag_smuggle": lambda c: _scan(c).has_tag_chars,
    "bidi_trick": lambda c: _scan(c).has_bidi_override,
    "homoglyph_kw": lambda c: (
        _scan(c).homoglyph_hits >= 2 and bool(_HOMO_RISK.search(_scan(c).normalized))),
    # embed
    "bad_magic": lambda c: c.magic.startswith("PE") or "MZ" == c.magic[:2],
    "high_entropy": lambda c: c.entropy > 7.2,
    "embed_file": lambda c: "embed" in c.detail.lower() or "EmbeddedFile" in c.detail,
    "zip_slip": lambda c: "zip_slip" in c.detail or "path_traversal" in c.detail,
    # permission
    "excess_perm": lambda c: bool(_EXCESS_PERM.search(_text(c))),
    "scope_mismatch": lambda c: "scope_mismatch" in c.detail,
    "encrypted": lambda c: "encrypt" in c.detail.lower() or "암호" in c.detail,
    "double_ext": lambda c: "double_ext" in c.detail,
    # identity
    "unknown_author": lambda c: "unknown" in c.detail.lower() or "불명" in c.detail,
}


def _evidence_for(rule_id: str, cap: Capability) -> str:
    """근거 스니펫 — 은닉이 있으면 '복원 평문'을 보여준다(안 보이는 쓰레기 대신)."""
    ts = _scan(cap)
    if ts.decoded_hidden:
        return f"(숨은 명령 복원) {ts.decoded_hidden}"[:160]
    if rule_id.startswith("STEG-") or rule_id == "HID-HOMO-08":
        hint = "; ".join(ts.notes) or ts.normalized
        return (hint or cap.text_excerpt or cap.detail)[:160]
    base = cap.text_excerpt or cap.detail
    # 제로위드/태그/BiDi 흔적이 발췌에 섞였으면 정규화 가시본을 근거로
    if ts.zero_width_count or ts.has_tag_chars or ts.has_bidi_override:
        base = ts.normalized or base
    return base[:120]


def run_layer1(surface: RiskSurface) -> list[Finding]:
    """포맷 무관 1층 룰 매칭."""
    findings: list[Finding] = []
    fired: set[tuple[str, str]] = set()  # (rule_id, location) 중복 억제
    for cap in surface.capabilities:
        for rule in RULES:
            if rule["cap_kind"] != cap.kind:
                continue
            matcher = MATCHERS.get(rule["matcher"])
            if matcher is None:
                continue
            try:
                hit = matcher(cap)
            except Exception:
                hit = False
            if not hit:
                continue
            key = (rule["rule_id"], cap.location)
            if key in fired:
                continue
            fired.add(key)
            findings.append(Finding(
                layer=1,
                rule_id=rule["rule_id"],
                cap_kind=cap.kind,
                severity=rule["severity"],
                where=cap.location,
                what=rule["what"],
                evidence=_evidence_for(rule["rule_id"], cap),
                i18n_key=rule["i18n_key"],
            ))
    return findings
