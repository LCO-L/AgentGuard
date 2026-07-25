# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""URL/링크 스캔 — 외부 fetch 없이 메타 정적 분석(온디바이스 원칙).

ULTRA: 퓨니코드(homoglyph 도메인)·@위장·단축URL·과다 서브도메인·실행 다운로드·
브랜드 사칭까지 구조적으로 판정. 크롬 익스텐션의 링크 검사 백엔드.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse

from core.ai import backend
from core.ai.backend import AIConfig
from core.ai.interpret import interpret
from core.model import Finding, Verdict
from core.scorer import overall, score
from core.textnorm import scan_text
from services import history_service

_IP_HOST = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_SUSPICIOUS_TLD = (".zip", ".mov", ".top", ".xyz", ".click", ".country",
                   ".kim", ".gq", ".work", ".rest", ".fit", ".loan")
_SHORTENERS = {"bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd",
               "buff.ly", "rebrand.ly", "cutt.ly", "han.gl", "vo.la"}
_BRANDS = ("google", "facebook", "microsoft", "apple", "naver", "kakao",
           "toss", "kbstar", "shinhan", "nonghyup", "coupang", "paypal",
           "amazon", "netflix", "instagram", "gov", "nts")
_LOOKALIKE = re.compile(
    r"(g[0o]{2}gle|faceb[0o]{2}k|micr[0o]s[0o]ft|naver-[a-z]|kakao-[a-z]|"
    r"gov-[a-z]|nts-[a-z]|국세청|update-gov|-verify|-login|-secure|account-)", re.I)


def scan_url(url: str, cfg: AIConfig | None = None) -> Verdict:
    cfg = cfg or backend.resolve_config()
    findings: list[Finding] = []

    def add(rule_id, cap, sev, what, evidence, key):
        findings.append(Finding(1, rule_id, cap, sev, url, what, evidence, key))

    try:
        parsed = urlparse(url if "://" in url else "https://" + url)
    except Exception:
        parsed = None

    if parsed is None or not parsed.netloc:
        add("ID-UNKNOWN-01", "identity", "yellow",
            "URL 형식을 해석할 수 없음", url, "unknown_author")
    else:
        host = (parsed.hostname or "").lower()
        userinfo = parsed.username or ""

        # @ 위장: http://naver.com@evil.com → 실제 목적지는 evil.com
        if userinfo:
            add("HID-PERSONA-06", "hidden_instruction", "red",
                "주소에 '@'를 넣어 진짜 목적지를 숨김", parsed.netloc, "homoglyph")

        # 퓨니코드(homoglyph 도메인)
        if "xn--" in host:
            add("HID-HOMO-08", "hidden_instruction", "red",
                "퓨니코드로 유명 도메인을 흉내낸 주소일 수 있음", host, "homoglyph")

        # 닮은꼴 유니코드 도메인(정규화 후 브랜드 포함 검사)
        ts = scan_text(host)
        if ts.homoglyph_hits >= 1:
            norm = ts.normalized.lower()
            if any(b in norm for b in _BRANDS):
                add("HID-HOMO-08", "hidden_instruction", "red",
                    "다른 문자로 유명 브랜드 도메인을 위장", host, "homoglyph")

        if parsed.scheme == "http":
            add("NET-URL-01", "network", "yellow",
                "암호화되지 않은 http 주소", url, "ext_url")
        if parsed.scheme in ("javascript", "data"):
            add("EXEC-SHELL-03", "exec", "red",
                f"실행 스킴({parsed.scheme}:) 링크", url, "shell_cmd")

        if _IP_HOST.match(host):
            add("NET-SSRF-03", "network", "yellow",
                "도메인 없이 IP 직접 접속", host, "ssrf")
        if host.endswith(_SUSPICIOUS_TLD):
            add("NET-URL-01", "network", "yellow",
                "피싱에 자주 쓰이는 도메인 끝자리", host, "ext_url")
        if host in _SHORTENERS:
            add("NET-URL-01", "network", "yellow",
                "단축 URL — 진짜 목적지가 가려져 있음", host, "ext_url")
        if _LOOKALIKE.search(host):
            add("HID-PERSONA-06", "hidden_instruction", "red",
                "기관·유명 서비스를 사칭하는 것으로 보이는 주소", host, "persona")
        if re.search(r"\.(exe|scr|bat|ps1|apk|msi|dmg|jar)($|\?)", parsed.path, re.I):
            add("EXEC-DROP-04", "exec", "red",
                "실행파일 직접 다운로드 주소", parsed.path, "dropper")
        if len(host.split(".")) > 4:
            add("ID-UNKNOWN-01", "identity", "yellow",
                "비정상적으로 깊은 서브도메인", host, "unknown_author")
        # 브랜드명이 서브도메인/경로에만 있고 실제 등록도메인은 다른 경우
        reg = ".".join(host.split(".")[-2:]) if host.count(".") >= 1 else host
        for b in _BRANDS:
            if b in host and b not in reg and len(b) >= 4:
                add("HID-PERSONA-06", "hidden_instruction", "red",
                    f"'{b}'를 서브도메인에 넣어 진짜 도메인을 숨김", host, "persona")
                break

    sev = overall(findings)
    sc = score(findings)
    card = interpret(findings, sev, cfg)
    v = Verdict(surface_kind="url", overall=sev, score=sc, findings=findings,
                card=card, engine=card.source if card else "fallback")
    v.scan_id = history_service.save("url", url, v, fingerprint="")
    return v
