"""ZIP 아카이브 어댑터 — 압축 속 위험(zip-slip·이중확장자·실행파일).

OOXML/HWPX 가 아닌 '순수 ZIP'을 담당(레지스트리에서 그 뒤에 위치).
위험:
  • zip-slip     — 엔트리 경로가 '../' 나 절대경로 → 압축 해제 시 시스템 폴더 오염
  • 이중 확장자  — invoice.pdf.exe 처럼 파일종류 위장
  • 실행 파일    — 엔트리 매직이 MZ/ELF, 또는 위험 확장자
"""
from __future__ import annotations

import os
import zipfile

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import detect_magic, entropy as calc_entropy, sha256_hex

_DANGER_EXT = {".exe", ".scr", ".bat", ".cmd", ".com", ".pif", ".js", ".jse",
               ".vbs", ".vbe", ".jar", ".ps1", ".msi", ".lnk", ".hta", ".wsf",
               ".apk", ".dll", ".sh"}
_LURE_EXT = {".pdf", ".doc", ".docx", ".hwp", ".hwpx", ".xlsx", ".xls",
             ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".txt", ".zip"}
_MAX_ENTRIES = 300


def _is_zip_slip(name: str) -> bool:
    n = name.replace("\\", "/")
    if n.startswith("/") or ".." in n.split("/"):
        return True
    # 윈도우 드라이브 절대경로
    if len(n) >= 2 and n[1] == ":":
        return True
    return False


def _is_double_ext(base: str) -> bool:
    parts = base.lower().split(".")
    if len(parts) < 3:
        return False
    last = "." + parts[-1]
    mid = "." + parts[-2]
    return last in _DANGER_EXT and mid in _LURE_EXT


class ArchiveAdapter(Adapter):
    kind = "zip"

    def detect(self, head: bytes, filename: str) -> bool:
        if not head.startswith(b"PK\x03\x04"):
            return False
        try:
            with zipfile.ZipFile(filename) as z:
                names = z.namelist()
                # OOXML/HWPX 는 전용 어댑터 담당 → 여기선 제외
                if "[Content_Types].xml" in names:
                    return False
                if "mimetype" in names:
                    try:
                        mt = z.read("mimetype").decode("utf-8", "replace")
                        if "hwpml" in mt or "hwpx" in mt or "opendocument" in mt:
                            return False
                    except Exception:
                        pass
                return True
        except Exception:
            return False

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        s = RiskSurface(kind="zip", name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(open(path, "rb").read())

        with zipfile.ZipFile(path) as z:
            infos = z.infolist()[:_MAX_ENTRIES]
            for info in infos:
                entry = info.filename
                base = os.path.basename(entry.replace("\\", "/"))
                ext = os.path.splitext(base)[1].lower()

                if _is_zip_slip(entry):
                    s.add("embed", f"zip_slip path traversal: {entry}",
                          location=entry, excerpt=entry)

                if _is_double_ext(base):
                    s.add("permission", f"double_ext 위장: {base}",
                          location=entry, excerpt=base)

                if ext in _DANGER_EXT:
                    s.add("exec", f"실행형 엔트리(.{ext.lstrip('.')}): {base}",
                          location=entry, excerpt=base)

                if entry.lower().endswith(".zip"):
                    s.add("embed", f"중첩 압축(zip-in-zip): {base}",
                          location=entry, excerpt=base)

                # 매직/엔트로피(작은 엔트리만 실제로 읽음)
                if 0 < info.file_size <= 2_000_000:
                    try:
                        with z.open(info) as fh:
                            blob = fh.read(65536)
                        magic = detect_magic(blob)
                        e = calc_entropy(blob)
                        if magic in ("PE(실행파일)", "ELF(리눅스 실행파일)"):
                            s.add("embed", f"embedded executable ({magic})",
                                  location=entry, magic="MZ" if magic.startswith("PE") else "ELF")
                        elif e > 7.4 and ext not in (".jpg", ".png", ".zip", ".gz", ".mp4"):
                            s.add("embed", "고엔트로피 엔트리(암호화/압축 의심)",
                                  location=entry, entropy=e)
                    except Exception:
                        pass
        return s
