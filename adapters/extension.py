"""브라우저 확장(manifest.json) 어댑터 — 권한·스크립트 범위 검사."""
from __future__ import annotations

import json

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import find_urls, sha256_hex


class ExtensionAdapter(Adapter):
    kind = "extension"

    def detect(self, head: bytes, filename: str) -> bool:
        try:
            cfg = json.loads(open(filename, encoding="utf-8").read())
        except Exception:
            return False
        return isinstance(cfg, dict) and "manifest_version" in cfg

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        raw = open(path, encoding="utf-8").read()
        cfg = json.loads(raw)
        s = RiskSurface(kind="extension",
                        name=name or cfg.get("name", path), raw_ref=path)
        s.fingerprint = sha256_hex(raw)

        perms = cfg.get("permissions", []) + cfg.get("host_permissions", [])
        for p in perms:
            s.add("permission", f"permission: {p}", location="manifest.permissions",
                  excerpt=str(p))
        if not perms:
            s.add("identity", "unknown 개발자 정보 없음", location="manifest")

        for cs in cfg.get("content_scripts", []):
            matches = " ".join(cs.get("matches", []))
            s.add("exec", f"content_script matches: {matches}",
                  location="manifest.content_scripts", excerpt=matches)

        bg = cfg.get("background", {})
        if bg:
            s.add("exec", "background script 존재",
                  location="manifest.background", excerpt=str(bg)[:150])

        for key in ("homepage_url", "update_url"):
            if key in cfg:
                for url in find_urls(str(cfg[key])):
                    s.add("network", f"{key} 외부 URL", location=f"manifest.{key}",
                          excerpt=url)

        author = cfg.get("author") or cfg.get("developer")
        if not author:
            s.add("identity", "unknown 개발자 불명", location="manifest")
        return s
