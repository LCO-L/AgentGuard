"""텍스트/에이전트 파일 어댑터 — ★ AI 에이전트 시대의 정곡.

요즘 공격은 실행파일이 아니라 **에이전트가 읽는 텍스트**에 숨는다:
  • SKILL.md / AGENTS.md / CLAUDE.md / .cursorrules — 에이전트 규칙 파일에 숨은 명령
  • .md / .txt 문서에 프롬프트 인젝션 + 보이지 않는 글자
  • .sh / .ps1 / .js 스크립트에 curl|bash 원격 실행

전체 텍스트를 hidden_instruction(인젝션/은닉 룰용) + exec(쉘/드롭 룰용)로 환원.
원문을 그대로 넘겨야 제로위드·태그문자 은닉이 살아있어 1층이 복원한다.
"""
from __future__ import annotations

import os

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import find_urls, sha256_hex

_TEXT_EXT = {".md", ".markdown", ".mdx", ".txt", ".text", ".rst", ".mdc"}
_RULE_EXT = {".cursorrules", ".windsurfrules", ".clinerules"}
_SCRIPT_EXT = {".js", ".mjs", ".cjs", ".ts", ".py", ".sh", ".bash",
               ".zsh", ".ps1", ".bat", ".cmd", ".vbs", ".rb", ".pl", ".lua"}
_AGENT_NAMES = {"skill.md", "agents.md", "claude.md", "agent.md",
                "mcp.md", "readme.md", "gemini.md", "copilot-instructions.md",
                ".cursorrules", ".windsurfrules", ".clinerules"}

_MAX_CHARS = 20000  # 은닉 문자 보존 위해 원문 유지하되 상한


def _is_probably_text(head: bytes) -> bool:
    if b"\x00" in head:
        return False
    try:
        head.decode("utf-8")
        return True
    except UnicodeDecodeError:
        # 부분 멀티바이트 잘림 허용
        try:
            head.decode("utf-8", "ignore")
            return True
        except Exception:
            return False


class TextFileAdapter(Adapter):
    """확장자·파일명 화이트리스트 + 텍스트 판별(광범위 폴백 아님)."""
    kind = "text"

    def detect(self, head: bytes, filename: str) -> bool:
        base = os.path.basename(filename).lower()
        ext = os.path.splitext(base)[1].lower()
        named = base in _AGENT_NAMES
        known = ext in (_TEXT_EXT | _RULE_EXT | _SCRIPT_EXT) or named
        return known and _is_probably_text(head)

    def _kind_of(self, base: str, ext: str) -> str:
        if base in _AGENT_NAMES or ext in _RULE_EXT:
            return "agentfile"
        if ext in _SCRIPT_EXT:
            return "script"
        return "text"

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        raw = open(path, "rb").read()
        text = raw.decode("utf-8", "replace")[:_MAX_CHARS]
        base = os.path.basename(name or path).lower()
        ext = os.path.splitext(base)[1].lower()
        kind = self._kind_of(base, ext)

        s = RiskSurface(kind=kind, name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(raw)

        # 전체 텍스트 → 은닉/인젝션 룰 대상(원문 유지: 제로위드 보존)
        s.add("hidden_instruction", f"{kind} full text", location=base,
              excerpt=text)
        # 전체 텍스트 → 쉘/드롭/DDE 룰 대상(코드가 텍스트에 섞였을 때)
        s.add("exec", f"{kind} body (script/command scan)", location=base,
              excerpt=text)

        # 쉬뱅·스크립트면 자동실행 성격 강조
        if kind == "script" or text.startswith("#!"):
            s.add("exec", "autorun script body", location=base,
                  excerpt=text[:400])

        # URL
        for url in find_urls(text):
            s.add("network", "본문 내 외부 URL", location=base, excerpt=url)

        # 신원: 에이전트 규칙 파일은 출처가 특히 중요
        if kind == "agentfile":
            s.add("identity", f"에이전트 규칙 파일({base}) — 출처 확인 필요",
                  location=base, excerpt=base)
        return s
