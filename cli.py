# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""AgentGuard CLI — 터미널/CI 게이트용 스캐너.

사용:
  python cli.py samples/evil.mcp.json samples/evil.pdf
  python cli.py --json samples/*.pdf
  find . -name '*.md' | python cli.py --stdin --fail-on yellow

종료 코드(CI 게이트):
  0 = 안전(green)  ·  1 = 주의(yellow)  ·  2 = 위험(red)  ·  3 = 처리 오류
그래서 CI 파이프라인에서 `agentguard ... || exit 1` 로 위험 파일 병합 차단 가능.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

# 로컬 실행 시 패키지 경로 보장
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.ai import backend  # noqa: E402
from services import scan_service  # noqa: E402

_ICON = {"red": "🔴", "yellow": "🟡", "green": "🟢"}
_EXIT = {"green": 0, "yellow": 1, "red": 2}
_ORDER = {"green": 0, "yellow": 1, "red": 2}


def _scan_one(path: str, cfg) -> dict:
    with open(path, "rb") as f:
        data = f.read()
    v = scan_service.scan_bytes(data, os.path.basename(path), cfg)
    return scan_service.verdict_to_dict(v)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="agentguard", description="온디바이스 통합 보안 스캐너")
    ap.add_argument("paths", nargs="*", help="검사할 파일/글롭")
    ap.add_argument("--stdin", action="store_true", help="stdin 에서 경로 목록 읽기")
    ap.add_argument("--json", action="store_true", help="JSON 출력")
    ap.add_argument("--provider", default=None, help="ollama|claude|openrouter|auto|off")
    ap.add_argument("--fail-on", default="red", choices=["red", "yellow"],
                    help="이 등급 이상이면 실패 종료(기본 red)")
    args = ap.parse_args(argv)

    paths: list[str] = []
    for p in args.paths:
        paths.extend(glob.glob(p) if any(c in p for c in "*?[") else [p])
    if args.stdin:
        paths += [ln.strip() for ln in sys.stdin if ln.strip()]
    if not paths:
        ap.print_help()
        return 3

    cfg = backend.resolve_config({"provider": args.provider} if args.provider else None)

    results = []
    worst = "green"
    for path in paths:
        if not os.path.isfile(path):
            results.append({"path": path, "error": "not a file"})
            continue
        try:
            v = _scan_one(path, cfg)
            results.append({"path": path, "verdict": v})
            if _ORDER[v["overall"]] > _ORDER[worst]:
                worst = v["overall"]
        except Exception as e:  # noqa: BLE001
            results.append({"path": path, "error": str(e)})

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for r in results:
            if "error" in r:
                print(f"  ⚠️  {r['path']}: {r['error']}")
                continue
            v = r["verdict"]
            print(f"  {_ICON[v['overall']]} [{v['score']:3d}/100] {r['path']}  "
                  f"({v['surface_kind']}, {len(v['findings'])} findings, {v['engine']})")
            c = v.get("card") or {}
            if c.get("headline"):
                print(f"        → {c['headline']}  {c.get('action','')}")

    # 게이트 판정
    threshold = _ORDER[args.fail_on]
    if _ORDER[worst] >= threshold and worst != "green":
        return _EXIT[worst]
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
