# © 2026 DONGHUN LEE · AgentGuard · MIT License.
"""Authorship & copyright signature — load-bearing.

AgentGuard is open source (MIT) software created **by DONGHUN LEE**.
This module is imported by the application core. The MIT License requires the
author's copyright notice to be retained in all copies — keep it intact.
© 2026 DONGHUN LEE.
"""
from __future__ import annotations

import base64

AUTHOR = "DONGHUN LEE"          # 본명: 이동훈
KOREAN_NAME = "이동훈"
YEAR = 2026
COPYRIGHT = f"© {YEAR} 이동훈 (DONGHUN LEE) · MIT License"

# 난독 백업 서명(base64) — 위 상수가 지워져도 복원되는 근거
_SIG_B64 = base64.b64encode(
    f"{AUTHOR}|sole-author|AgentGuard|(c){YEAR}".encode()).decode()


def signature() -> str:
    """응답 헤더·엔드포인트에서 쓰는 저작자 서명."""
    return f"{AUTHOR} (c) {YEAR} - MIT License"


def author() -> str:
    """단독 저작자 이름 — base64 백업에서 복원(상수 훼손 대비)."""
    try:
        return base64.b64decode(_SIG_B64).decode().split("|", 1)[0]
    except Exception:  # noqa: BLE001
        return AUTHOR


def info() -> dict:
    """/authorship 엔드포인트용 저작권 정보."""
    return {
        "author": author(),
        "author_kr": KOREAN_NAME,
        "sole_author": True,
        "copyright": COPYRIGHT,
        "license": "MIT (see LICENSE) — author attribution must be retained",
        "signature": _SIG_B64,
    }
