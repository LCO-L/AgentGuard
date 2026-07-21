"""스캔 이력 저장소 — 원본은 저장하지 않는다(비저장 원칙).

보관: scan_id, 시각, 포맷, 이름, overall, findings, card, fingerprint.
JSON Lines 파일 기반(의존성 0). Railway 배포 시 볼륨 마운트 경로는
AG_HISTORY_PATH 환경변수로 교체 가능.
"""
from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from core.model import Verdict

HISTORY_PATH = Path(os.environ.get("AG_HISTORY_PATH", ".cache/history.jsonl"))
_MAX_KEEP = int(os.environ.get("AG_HISTORY_MAX", "1000"))


def save(surface_kind: str, name: str, verdict: Verdict, fingerprint: str) -> str:
    scan_id = uuid.uuid4().hex[:12]
    record = {
        "scan_id": scan_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "surface_kind": surface_kind,
        "name": name,
        "overall": verdict.overall,
        "findings": [asdict(f) for f in verdict.findings],
        "card": asdict(verdict.card) if verdict.card else None,
        "fingerprint": fingerprint,
    }
    HISTORY_PATH.parent.mkdir(exist_ok=True)
    with HISTORY_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    _trim()
    return scan_id


def _trim() -> None:
    try:
        lines = HISTORY_PATH.read_text(encoding="utf-8").splitlines()
        if len(lines) > _MAX_KEEP:
            HISTORY_PATH.write_text(
                "\n".join(lines[-_MAX_KEEP:]) + "\n", encoding="utf-8")
    except FileNotFoundError:
        pass


def list_scans(limit: int = 50, offset: int = 0) -> dict:
    if not HISTORY_PATH.exists():
        return {"total": 0, "items": []}
    lines = HISTORY_PATH.read_text(encoding="utf-8").splitlines()
    records = [json.loads(l) for l in lines if l.strip()]
    records.reverse()  # 최신순
    return {"total": len(records),
            "items": records[offset:offset + limit]}


def get_scan(scan_id: str) -> dict | None:
    if not HISTORY_PATH.exists():
        return None
    for line in HISTORY_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        if rec["scan_id"] == scan_id:
            return rec
    return None
