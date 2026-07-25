# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""3층 러그풀 — 승인 후 변화 감지(지문 비교). 포맷 무관.

RiskSurface.fingerprint를 로컬 저장 → 재검사 시 diff.
문서든 MCP든 확장이든 지문만 비교하므로 같은 3층 로직 재사용.
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path

CACHE_DIR = Path(os.environ.get("AG_CACHE_DIR", ".cache"))
CACHE_FILE = CACHE_DIR / "fingerprints.json"
_lock = threading.Lock()  # 동시 스캔 시 read-modify-write 경합으로 지문이 유실되지 않게


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


def check_rugpull(name: str, fingerprint: str, client: str = "") -> dict:
    """지문 비교. {"changed": bool, "first_seen": bool, "msg": str}

    client가 있으면 사용자 단위로 격리 — 다른 사용자의 동명 파일이
    "변조 감지" 거짓 경보를 내지 않는다. 없으면(CLI 등) 기존 전역 동작.
    """
    if not fingerprint:
        return {"changed": False, "first_seen": False, "msg": ""}
    key = f"{client}|{name}" if client else name
    with _lock:
        store = _load()
        old = store.get(key)
        if old is None:
            store[key] = fingerprint
            _save(store)
            return {"changed": False, "first_seen": True,
                    "msg": "처음 보는 대상. 지문을 저장했어요."}
        if old != fingerprint:
            store[key] = fingerprint
            _save(store)
            return {"changed": True, "first_seen": False,
                    "msg": "승인한 뒤 내용이 몰래 바뀌었어요."}
    return {"changed": False, "first_seen": False, "msg": "지문이 이전과 같아요."}
