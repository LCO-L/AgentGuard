"""PII·시크릿 탐지 + 복원 가능 마스킹 — Outbound 유출 방지(SecureType Outbound).

AI에게 보내기 직전, 텍스트 속 비밀값·개인정보를 **문자 offset span**으로 잡아
Grammarly식 밑줄에 쓰게 하고, [SECRET_1]/[PII_이름_1] 같은 **복원 가능 토큰**으로
마스킹한다. 매핑을 함께 돌려주므로 AI 응답을 받은 뒤 원래 값으로 되돌릴 수 있다.

원칙(가드코치 문서): 원문·비밀값·토큰 매핑은 서버 로그에 남기지 않는다(호출측 책임).
탐지는 결정적 코드가, 판단·설명은 상위 계층이 맡는다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# severity: "critical"(비밀값 유출) > "high" > "medium"(PII)


@dataclass
class Span:
    start: int
    end: int
    kind: str            # "secret" | "pii"
    rule_id: str         # "SEC-APIKEY-01" 등
    label: str           # 사람이 읽는 종류("API 키","주민등록번호")
    severity: str        # "critical"|"high"|"medium"
    why: str             # 왜 위험한가(한 문장)
    token: str = ""      # 마스킹 치환 토큰([SECRET_1] 등)
    text: str = ""       # 매칭 원문(마스킹 매핑용 — 로그 금지)


# ── 시크릿(크리티컬) ─────────────────────────────────────
_SECRET_PATTERNS = [
    ("SEC-OPENAI-01", "OpenAI API 키", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("SEC-ANTHROPIC-02", "Anthropic API 키", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("SEC-AWS-03", "AWS 액세스 키", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("SEC-GITHUB-04", "GitHub 토큰", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b")),
    ("SEC-GOOGLE-05", "Google API 키", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("SEC-SLACK-06", "Slack 토큰", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("SEC-STRIPE-07", "Stripe 키", re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b")),
    ("SEC-JWT-08", "JWT 토큰", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
    ("SEC-PEM-09", "개인 키(PEM)", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----")),
    ("SEC-SLACKHOOK-10", "Slack 웹훅", re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9/]+")),
]

# 하드코딩된 비밀 대입: password = "...", api_key: '...', secret="..."
_ASSIGN_SECRET = re.compile(
    r"""(?ix)
    \b(password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|
       auth[_-]?token|client[_-]?secret|private[_-]?key|db[_-]?pass)\b
    \s*[:=]\s*
    (['"])(?P<val>[^'"\n]{4,})(\2)
    """)

# ── PII(개인정보) ───────────────────────────────────────
# 한국 주민등록번호: YYMMDD-[1-4]XXXXXX
_RRN = re.compile(r"\b\d{6}-[1-4]\d{6}\b")
# 한국 휴대폰
_PHONE_KR = re.compile(r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b")
# 이메일
_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
# 신용카드 후보(13~16자리, 구분자 허용) — Luhn 검증으로 오탐 제거
_CARD = re.compile(r"\b(?:\d[ -]?){13,16}\b")
# 계좌번호 후보(숫자-숫자-숫자, 10자리 이상)
_ACCOUNT = re.compile(r"\b\d{2,6}-\d{2,6}-\d{2,7}(?:-\d{1,6})?\b")
# 여권(한국) 예: M12345678
_PASSPORT = re.compile(r"\b[MSRODmsrod]\d{8}\b")


def _luhn_ok(digits: str) -> bool:
    d = [int(c) for c in digits if c.isdigit()]
    if not (13 <= len(d) <= 16):
        return False
    total, alt = 0, False
    for x in reversed(d):
        if alt:
            x *= 2
            if x > 9:
                x -= 9
        total += x
        alt = not alt
    return total % 10 == 0


def _overlaps(spans: list[Span], start: int, end: int) -> bool:
    return any(not (end <= s.start or start >= s.end) for s in spans)


def find_spans(text: str) -> list[Span]:
    """텍스트에서 비밀/개인정보 span 목록(offset 기준, 겹침 억제)."""
    spans: list[Span] = []
    if not text:
        return spans

    # 1) 명시적 시크릿 패턴(가장 확실 → 우선)
    for rid, label, rx in _SECRET_PATTERNS:
        for m in rx.finditer(text):
            if _overlaps(spans, m.start(), m.end()):
                continue
            spans.append(Span(m.start(), m.end(), "secret", rid, label, "critical",
                              f"{label}로 보여요. AI로 보내면 그대로 노출·악용될 수 있어요.",
                              text=m.group(0)))

    # 2) 하드코딩된 비밀 대입(값 부분만 span)
    for m in _ASSIGN_SECRET.finditer(text):
        vs, ve = m.start("val"), m.end("val")
        if _overlaps(spans, vs, ve):
            continue
        spans.append(Span(vs, ve, "secret", "SEC-HARDCODE-11",
                          "하드코딩된 비밀값", "critical",
                          "코드에 비밀번호·키가 그대로 박혀 있어요. 환경변수로 빼세요.",
                          text=m.group("val")))

    # 3) PII
    def add_pii(rid, label, sev, why, m):
        if not _overlaps(spans, m.start(), m.end()):
            spans.append(Span(m.start(), m.end(), "pii", rid, label, sev, why,
                              text=m.group(0)))

    for m in _RRN.finditer(text):
        add_pii("PII-RRN-01", "주민등록번호", "high",
                "주민등록번호가 포함돼 있어요. 마스킹 후 보내세요.", m)
    for m in _PHONE_KR.finditer(text):
        add_pii("PII-PHONE-02", "휴대폰 번호", "medium",
                "전화번호가 포함돼 있어요.", m)
    for m in _CARD.finditer(text):
        if _luhn_ok(m.group(0)):
            add_pii("PII-CARD-03", "신용카드 번호", "high",
                    "카드번호로 보이는 숫자가 있어요.", m)
    for m in _EMAIL.finditer(text):
        add_pii("PII-EMAIL-04", "이메일 주소", "medium",
                "이메일 주소가 포함돼 있어요.", m)
    for m in _ACCOUNT.finditer(text):
        add_pii("PII-ACCOUNT-05", "계좌번호", "medium",
                "계좌번호로 보이는 숫자가 있어요.", m)
    for m in _PASSPORT.finditer(text):
        add_pii("PII-PASSPORT-06", "여권번호", "high",
                "여권번호로 보이는 값이 있어요.", m)

    spans.sort(key=lambda s: s.start)
    return spans


# ── 복원 가능 마스킹 ─────────────────────────────────────

_LABEL_SLUG = {
    "API 키": "SECRET", "OpenAI API 키": "SECRET", "Anthropic API 키": "SECRET",
    "AWS 액세스 키": "SECRET", "GitHub 토큰": "SECRET", "Google API 키": "SECRET",
    "Slack 토큰": "SECRET", "Stripe 키": "SECRET", "JWT 토큰": "SECRET",
    "개인 키(PEM)": "SECRET", "Slack 웹훅": "SECRET", "하드코딩된 비밀값": "SECRET",
    "주민등록번호": "RRN", "휴대폰 번호": "PHONE", "신용카드 번호": "CARD",
    "이메일 주소": "EMAIL", "계좌번호": "ACCOUNT", "여권번호": "PASSPORT",
}


def redact(text: str, spans: list[Span] | None = None) -> dict:
    """복원 가능 마스킹. 반환 {masked, mapping:{token:original}, count}.

    같은 원문 값은 같은 토큰으로 매핑(일관성). AI 응답 후 token→original 로 복원.
    """
    spans = spans if spans is not None else find_spans(text)
    if not spans:
        return {"masked": text, "mapping": {}, "count": 0}

    mapping: dict[str, str] = {}
    value_to_token: dict[str, str] = {}
    counters: dict[str, int] = {}

    # 뒤에서부터 치환해야 offset이 안 밀린다
    ordered = sorted(spans, key=lambda s: s.start)
    # 먼저 토큰 배정(앞→뒤 순서로 번호 매김)
    for s in ordered:
        original = s.text or text[s.start:s.end]
        if original in value_to_token:
            s.token = value_to_token[original]
            continue
        slug = _LABEL_SLUG.get(s.label, "SECRET" if s.kind == "secret" else "PII")
        counters[slug] = counters.get(slug, 0) + 1
        token = f"[{slug}_{counters[slug]}]"
        value_to_token[original] = token
        mapping[token] = original
        s.token = token

    masked = text
    for s in sorted(ordered, key=lambda s: s.start, reverse=True):
        masked = masked[:s.start] + s.token + masked[s.end:]

    return {"masked": masked, "mapping": mapping, "count": len(spans)}


def restore(masked: str, mapping: dict) -> str:
    """마스킹 복원 — AI 응답에서 토큰을 원래 값으로."""
    out = masked
    for token, original in mapping.items():
        out = out.replace(token, original)
    return out
