"""HWP 5.0 (OLE2 복합문서) 어댑터 — ★ 메인 데모 (한컴 정곡).

olefile로 스트림 나열 → Capability로 환원.
위험이 사는 곳: Scripts/*, DefaultJScript, BinData/*, 본문 URL, 요약정보.
"""
from __future__ import annotations

import re

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import (detect_magic, entropy as calc_entropy, find_urls,
                       sha256_hex, sniff_excerpt)

try:
    import olefile
except ImportError:  # olefile 없으면 감지만 포기(레지스트리가 다른 어댑터 시도)
    olefile = None

_SCRIPT_STREAMS = ("DefaultJScript", "JScriptVersion")


class HwpOleAdapter(Adapter):
    kind = "hwp"

    def detect(self, head: bytes, filename: str) -> bool:
        if not head.startswith(b"\xd0\xcf\x11\xe0"):  # OLE2 시그니처
            return False
        return True  # 세부 HWP 판별은 to_surface에서(실패 시 registry 에러 처리)

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        if olefile is None:
            raise RuntimeError("olefile 필요: uv add olefile")
        s = RiskSurface(kind="hwp", name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(open(path, "rb").read())

        if not olefile.isOleFile(path):
            raise ValueError("OLE2 파일이 아닙니다")
        ole = olefile.OleFileIO(path)
        streams = ["/".join(p) for p in ole.listdir()]

        # HWP 판별: FileHeader에 'HWP Document File' 시그니처
        if ole.exists("FileHeader"):
            header = ole.openstream("FileHeader").read()
            if b"HWP Document File" in header:
                s.kind = "hwp"
            flags = header[36] if len(header) > 36 else 0
            if flags & 0x02:  # 배포용 문서 비트
                s.add("permission", "배포용 문서 플래그", location="FileHeader")
            if flags & 0x04:  # 암호 설정 비트
                s.add("permission", "encrypt 암호 설정 문서",
                      location="FileHeader")

        # 신원 단서
        if ole.exists("\x05HwpSummaryInformation"):
            meta = ole.openstream("\x05HwpSummaryInformation").read()
            s.author_hint = sniff_excerpt(meta, 100)
            s.add("identity", "문서 요약정보(작성자·도구)",
                  location="HwpSummaryInformation",
                  excerpt=s.author_hint or "unknown 작성자 불명")

        # 스크립트 스트림 → 자동실행 벡터
        for st in streams:
            base = st.split("/")[-1]
            if base in _SCRIPT_STREAMS or st.startswith("Scripts"):
                data = ole.openstream(st).read()
                s.add("exec", f"autorun script stream: {st}", location=st,
                      excerpt=sniff_excerpt(data), entropy=calc_entropy(data))
                s.add("hidden_instruction", "script text", location=st,
                      excerpt=sniff_excerpt(data, 400))

        # 본문 → URL 추출 (UTF-16LE 텍스트 근사)
        for st in streams:
            if st.startswith("BodyText"):
                raw = ole.openstream(st).read()
                try:
                    text = raw.decode("utf-16-le", "ignore")
                except Exception:
                    text = ""
                for url in find_urls(text):
                    s.add("network", "본문 내 외부 URL", location=st, excerpt=url)

        # BinData 임베드 → 매직·엔트로피
        for st in streams:
            if st.startswith("BinData"):
                blob = ole.openstream(st).read()
                magic = detect_magic(blob)
                e = calc_entropy(blob)
                if magic or e > 7.2:
                    s.add("embed", f"embedded object ({magic or 'binary'})",
                          location=st, entropy=e, magic=magic)
        ole.close()
        return s
