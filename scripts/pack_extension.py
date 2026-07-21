# © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
"""크롬 익스텐션 CRX3 패키저 — 순수 stdlib + openssl CLI.

CRX3 구조:
  "Cr24" | le32(3) | le32(header_size) | CrxFileHeader(protobuf) | zip
  header = sha256_with_rsa { public_key(DER), signature } + signed_header_data
  signature = RSA-SHA256("CRX3 SignedData\\x00" + le32(len(shd)) + shd + zip)

사용: uv run python scripts/pack_extension.py
산출: dist/agentguard-extension.zip / dist/agentguard-extension.crx / dist/extension-key.pem

⚠️ 참고: 최신 Chrome은 웹스토어 외 CRX 직접 설치를 정책상 제한.
  - 개발/데모: chrome://extensions → '압축해제된 확장 프로그램 로드'(ZIP) 권장
  - CRX: 엔터프라이즈 정책(ExtensionInstallForcelist) 배포·서명 보관용
"""
from __future__ import annotations

import hashlib
import io
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT_DIR = ROOT / "extension"
DIST = ROOT / "dist"
KEY = DIST / "extension-key.pem"


# ── 최소 protobuf 인코더 (CRX 헤더 전용) ─────────────────
def _varint(n: int) -> bytes:
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def _field_bytes(num: int, data: bytes) -> bytes:
    return _varint((num << 3) | 2) + _varint(len(data)) + data


def make_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(EXT_DIR.rglob("*")):
            if f.is_file() and "__pycache__" not in str(f):
                z.write(f, arcname=str(f.relative_to(EXT_DIR)))
    return buf.getvalue()


def ensure_key() -> None:
    if not KEY.exists():
        DIST.mkdir(exist_ok=True)
        subprocess.run(
            ["openssl", "genrsa", "-out", str(KEY), "2048"],
            check=True, capture_output=True)


def pubkey_der() -> bytes:
    return subprocess.run(
        ["openssl", "rsa", "-in", str(KEY), "-pubout", "-outform", "DER"],
        check=True, capture_output=True).stdout


def sign(data: bytes) -> bytes:
    with tempfile.NamedTemporaryFile() as tmp:
        tmp.write(data)
        tmp.flush()
        return subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", str(KEY), tmp.name],
            check=True, capture_output=True).stdout


def pack_crx3(zip_bytes: bytes) -> bytes:
    pub = pubkey_der()
    crx_id = hashlib.sha256(pub).digest()[:16]

    signed_header_data = _field_bytes(1, crx_id)          # SignedData { crx_id }
    to_sign = (b"CRX3 SignedData\x00"
               + struct.pack("<I", len(signed_header_data))
               + signed_header_data + zip_bytes)
    sig = sign(to_sign)

    proof = _field_bytes(1, pub) + _field_bytes(2, sig)   # AsymmetricKeyProof
    header = (_field_bytes(1, proof)                      # sha256_with_rsa
              + _field_bytes(10000, signed_header_data))  # signed_header_data

    return b"Cr24" + struct.pack("<II", 3, len(header)) + header + zip_bytes


def main() -> None:
    if not EXT_DIR.exists():
        sys.exit("extension/ 디렉터리가 없습니다")
    DIST.mkdir(exist_ok=True)
    ensure_key()

    zip_bytes = make_zip()
    (DIST / "agentguard-extension.zip").write_bytes(zip_bytes)

    crx = pack_crx3(zip_bytes)
    crx_path = DIST / "agentguard-extension.crx"
    crx_path.write_bytes(crx)

    assert crx[:4] == b"Cr24" and struct.unpack("<I", crx[4:8])[0] == 3
    print(f"✅ ZIP: {DIST / 'agentguard-extension.zip'} ({len(zip_bytes):,}B)")
    print(f"✅ CRX3: {crx_path} ({len(crx):,}B) — 매직/버전 검증 완료")
    print(f"🔑 서명키: {KEY}  (재패키징 시 같은 ID 유지 — gitignore 권장)")


if __name__ == "__main__":
    main()
