# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""3층 러그풀 — 승인 후 변화 감지(지문 비교). 포맷 무관.

RiskSurface.fingerprint를 로컬 저장 → 재검사 시 diff.
문서든 MCP든 확장이든 지문만 비교하므로 같은 3층 로직 재사용.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

CACHE_DIR = Path(os.environ.get("AG_CACHE_DIR", ".cache"))
CACHE_FILE = CACHE_DIR / "fingerprints.json"


def _load() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save(store: dict) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2),
                          encoding="utf-8")


def check_rugpull(name: str, fingerprint: str) -> dict:
    """지문 비교. {"changed": bool, "first_seen": bool, "msg": str}"""
    if not fingerprint:
        return {"changed": False, "first_seen": False, "msg": ""}
    store = _load()
    old = store.get(name)
    if old is None:
        store[name] = fingerprint
        _save(store)
        return {"changed": False, "first_seen": True,
                "msg": "처음 보는 대상. 지문을 저장했어요."}
    if old != fingerprint:
        store[name] = fingerprint
        _save(store)
        return {"changed": True, "first_seen": False,
                "msg": "승인한 뒤 내용이 몰래 바뀌었어요."}
    return {"changed": False, "first_seen": False, "msg": "지문이 이전과 같아요."}
