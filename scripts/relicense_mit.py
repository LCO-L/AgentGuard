# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""저장소 전체 저작권 헤더를 MIT 오픈소스 문구로 일괄 전환하는 스크립트.

원칙: **저작자 표기(© 2026 이동훈/DONGHUN LEE)는 절대 지우지 않는다.**
MIT 라이선스는 저작권 고지 보존을 요구하므로 이름은 그대로 두고,
MIT와 모순되는 "(Proprietary) / Unauthorized copying prohibited" 문구만 바꾼다.

사용법:
    python scripts/relicense_mit.py            # dry-run (무엇이 바뀔지 목록만)
    python scripts/relicense_mit.py --apply    # 실제 적용
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 바꿀 문구(순서 중요 — 긴 것 먼저). 이름·연도는 보존된다.
REPLACEMENTS: list[tuple[str, str]] = [
    (" · All Rights Reserved · AgentGuard (Proprietary). Unauthorized copying/use prohibited.",
     " · AgentGuard · MIT License."),
    (" · All Rights Reserved · AgentGuard (Proprietary).",
     " · AgentGuard · MIT License."),
    ("All Rights Reserved · AgentGuard (Proprietary)",
     "AgentGuard · MIT License"),
]

EXTS = {".py", ".js", ".ts", ".tsx", ".html", ".css", ".sh", ".md", ".mjs"}
SKIP_DIRS = {"node_modules", "dist", ".venv", "__pycache__", ".git",
             ".next", "out", "android", ".cache", ".logs"}


SELF = Path(__file__).resolve()   # 치환 패턴 문자열을 담고 있으므로 자신은 제외


def iter_files() -> list[Path]:
    files = []
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.suffix not in EXTS:
            continue
        if p.resolve() == SELF:
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts):
            continue
        files.append(p)
    return sorted(files)


def main() -> int:
    apply = "--apply" in sys.argv
    changed = []
    for f in iter_files():
        try:
            text = f.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        new = text
        for old, rep in REPLACEMENTS:
            new = new.replace(old, rep)
        if new != text:
            changed.append(f.relative_to(ROOT))
            if apply:
                f.write_text(new, encoding="utf-8")
    mode = "적용됨" if apply else "dry-run (적용하려면 --apply)"
    print(f"[relicense-mit] {mode} — {len(changed)}개 파일:")
    for c in changed:
        print(f"  {c}")
    if not changed:
        print("  (바꿀 것이 없습니다 — 이미 MIT 헤더)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
