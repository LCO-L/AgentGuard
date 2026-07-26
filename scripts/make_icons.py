# © 2026 DONGHUN LEE · AgentGuard · MIT License.
"""크롬 웹스토어용 PNG 아이콘 생성 — 의존성 0 (표준 라이브러리만).

ui/icon.svg 의 도형(방패+투구+눈)을 좌표 그대로 래스터라이즈한다:
  베지어 평탄화 → even-odd 다각형 채움 → 512px 렌더 → 박스 평균 다운샘플
  → extension/icons/icon{16,32,48,128}.png (RGBA, 투명 배경)

실행:  python scripts/make_icons.py
"""
from __future__ import annotations

import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "extension", "icons")
S = 512  # 마스터 렌더 크기(= SVG viewBox)


def bez(p0, p1, p2, p3, n=28):
    """3차 베지어 → 선분 점 목록(끝점 포함, 시작점 제외)."""
    pts = []
    for i in range(1, n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def poly_shield():
    p = [(256, 40), (440, 106)]
    p += bez((440, 106), (440, 120), (440, 262), (434, 302))
    p += bez((434, 302), (421, 392), (346, 454), (256, 478))
    p += bez((256, 478), (166, 454), (91, 392), (78, 302))
    p += bez((78, 302), (72, 262), (72, 120), (72, 106))
    return [p]  # 서브패스 1개


def poly_crest():
    p = [(256, 120)]
    p += bez((256, 120), (206, 128), (176, 168), (184, 216))
    p.append((212, 210))
    p += bez((212, 210), (207, 176), (228, 150), (256, 145))
    p += bez((256, 145), (284, 150), (305, 176), (300, 210))
    p.append((328, 216))
    p += bez((328, 216), (336, 168), (306, 128), (256, 120))
    return [p]


def poly_helmet():
    outer = [(196, 206)]
    outer += bez((196, 206), (196, 196), (214, 190), (256, 190))
    outer += bez((256, 190), (298, 190), (316, 196), (316, 206))
    outer.append((316, 268))
    outer += bez((316, 268), (316, 312), (292, 346), (256, 362))
    outer += bez((256, 362), (220, 346), (196, 312), (196, 268))
    slit = [(242, 232), (270, 232), (265, 264), (259, 320), (256, 332), (253, 320), (247, 264)]
    return [outer, slit]  # even-odd → T슬릿이 뚫림


def edges(subpaths):
    es = []
    for pts in subpaths:
        n = len(pts)
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            if y1 != y2:
                es.append((x1, y1, x2, y2))
    return es


def inside(es, x, y):
    """even-odd 교차수 판정."""
    c = 0
    for x1, y1, x2, y2 in es:
        if (y1 > y) != (y2 > y):
            xt = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xt > x:
                c ^= 1
    return c


def render_master():
    shield = edges(poly_shield())
    crest = edges(poly_crest())
    helmet = edges(poly_helmet())
    eyes = [(230.0, 250.0, 8.5), (282.0, 250.0, 8.5)]
    # 방패 그라디언트(#1E5BFF→#3D7BFF, bbox 대각선 방향)
    bx0, by0, bx1, by1 = 72.0, 40.0, 440.0, 478.0
    c0 = (0x1E, 0x5B, 0xFF)
    c1 = (0x3D, 0x7B, 0xFF)

    px = bytearray(S * S * 4)
    for j in range(S):
        y = j + 0.5
        row = j * S * 4
        for i in range(S):
            x = i + 0.5
            if not inside(shield, x, y):
                continue  # 투명
            t = ((x - bx0) / (bx1 - bx0) + (y - by0) / (by1 - by0)) / 2.0
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            r = int(c0[0] + (c1[0] - c0[0]) * t)
            g = int(c0[1] + (c1[1] - c0[1]) * t)
            b = int(c0[2] + (c1[2] - c0[2]) * t)
            # 흰 투구(볏 + 돔, 돔은 T슬릿 even-odd)
            if inside(crest, x, y) or inside(helmet, x, y):
                r = g = b = 255
            # 눈(청록) — 투구 위에 얹힘
            for ex, ey, er in eyes:
                if (x - ex) ** 2 + (y - ey) ** 2 <= er * er:
                    r, g, b = 0x22, 0xD3, 0xEE
                    break
            o = row + i * 4
            px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255
    return px


def downsample(px, size):
    """S×S RGBA → size×size (float 박스 평균, 알파 가중)."""
    out = bytearray(size * size * 4)
    ratio = S / size
    for j in range(size):
        y0, y1 = j * ratio, (j + 1) * ratio
        for i in range(size):
            x0, x1 = i * ratio, (i + 1) * ratio
            rs = gs = bs = as_ = 0.0
            n = 0
            for sy in range(int(y0), min(S, int(y1) + 1)):
                fy = min(y1, sy + 1) - max(y0, sy)
                if fy <= 0:
                    continue
                for sx in range(int(x0), min(S, int(x1) + 1)):
                    fx = min(x1, sx + 1) - max(x0, sx)
                    if fx <= 0:
                        continue
                    w = fx * fy
                    o = (sy * S + sx) * 4
                    a = px[o + 3] / 255.0 * w
                    rs += px[o] * a; gs += px[o + 1] * a; bs += px[o + 2] * a
                    as_ += a; n += 1
            area = ratio * ratio
            o = (j * size + i) * 4
            if as_ > 0:
                out[o] = round(rs / as_); out[o + 1] = round(gs / as_); out[o + 2] = round(bs / as_)
            out[o + 3] = round(255.0 * as_ / area)
    return out


def write_png(path, px, size):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(px[j * size * 4:(j + 1) * size * 4]) for j in range(size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # RGBA8
    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(data)


def main():
    os.makedirs(OUT, exist_ok=True)
    print("렌더링 512px 마스터…")
    master = render_master()
    for size in (128, 48, 32, 16):
        p = os.path.join(OUT, f"icon{size}.png")
        write_png(p, downsample(master, size), size)
        print("생성:", p)
    print("완료")


if __name__ == "__main__":
    main()
