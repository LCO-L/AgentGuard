"""시나리오 레지스트리 기반 — 확장성의 심장.

★ 새 보안 시나리오를 추가하는 법(둘 중 하나):
  (A) 정규식이면 → `scenarios_data.py`의 SCENARIOS 리스트에 Scenario(...) **한 줄** 추가.
  (B) 특수 로직이면 → `rulepacks/`에 scan(text)->list[Hit] 를 가진 팩 파일 1개 만들고
      `registry.PACKS`에 등록 한 줄 추가.

이 구조 덕에 탐지=데이터, 엔진=고정. 시나리오가 100개로 늘어도 코드는 안 는다.
inspect·에디터·익스텐션·통역이 전부 이 Hit 을 공유한다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# 카테고리: inject|vuln|agency|secret|pii|stego
# severity: critical|high|medium|low
SEVERITY_ORDER = {"critical": 3, "high": 2, "medium": 1, "low": 0}


@dataclass
class Scenario:
    """하나의 보안 시나리오(선언형). 정규식이면 자동으로 offset span 이 된다."""
    id: str
    category: str
    severity: str
    title: str
    why: str
    pattern: re.Pattern | None = None
    fix: str = ""
    suggestion: str = ""
    mask: bool = False        # 마스킹 대상(secret/pii)


@dataclass
class Hit:
    """탐지 1건(offset span). 모든 팩의 공통 산출물."""
    start: int
    end: int
    category: str
    rule_id: str
    severity: str
    title: str
    why: str
    fix: str = ""
    suggestion: str = ""
    token: str = ""           # 마스킹 토큰([SECRET_1] 등)
    decoded: str = ""         # 은닉 복원 평문(stego)
