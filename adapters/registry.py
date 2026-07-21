"""레지스트리 — 매직바이트/확장자로 어댑터 자동 선택.

포맷 추가 = 어댑터 파일 1개 + ADAPTERS에 1줄. 엔진은 안 는다.
"""
from __future__ import annotations

from adapters.archive import ArchiveAdapter
from adapters.base import Adapter
from adapters.extension import ExtensionAdapter
from adapters.hwp_ole import HwpOleAdapter
from adapters.hwpx import HwpxAdapter
from adapters.mcp import McpAdapter
from adapters.ooxml import OoxmlAdapter
from adapters.pdf import PdfAdapter
from adapters.rtf import RtfAdapter
from adapters.svg import SvgAdapter
from adapters.textfile import TextFileAdapter

# 순서 = 특이도 높은 것 우선. 마지막 두 개(Archive/TextFile)는 폴백성.
ADAPTERS: list[Adapter] = [
    HwpOleAdapter(),     # OLE2
    HwpxAdapter(),       # ZIP + hwpx marker
    OoxmlAdapter(),      # ZIP + [Content_Types].xml
    RtfAdapter(),        # {\rtf
    PdfAdapter(),        # %PDF
    SvgAdapter(),        # <svg / xml+svg
    McpAdapter(),        # JSON + mcpServers/tools
    ExtensionAdapter(),  # JSON + manifest_version
    ArchiveAdapter(),    # 순수 ZIP(폴백)
    TextFileAdapter(),   # .md/.txt/.sh/SKILL.md… (텍스트 폴백)
]


def pick(path: str, filename: str = "") -> Adapter:
    head = open(path, "rb").read(4096)
    for adapter in ADAPTERS:
        try:
            if adapter.detect(head, path):
                return adapter
        except Exception:
            continue
    raise ValueError(
        f"지원하지 않는 형식입니다: {filename or path} "
        f"(지원: hwp, hwpx, docx/xlsx/pptx, pdf, mcp json, 확장 manifest)")
