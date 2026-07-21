"""MCP 서버 설정 어댑터 — 툴포이즈닝 탐지의 핵심(시의성 컷).

JSON 설정 파싱 → command/args(실행벡터) + tools[].description(은닉지시) 추출.
"""
from __future__ import annotations

import json

from adapters.base import Adapter
from core.surface import RiskSurface
from core.util import find_urls, sha256_hex


class McpAdapter(Adapter):
    kind = "mcp"

    def detect(self, head: bytes, filename: str) -> bool:
        try:
            cfg = json.loads(head.decode("utf-8", "replace"))
        except Exception:
            try:
                cfg = json.loads(open(filename, encoding="utf-8").read())
            except Exception:
                return False
        return isinstance(cfg, dict) and (
            "mcpServers" in cfg or ("tools" in cfg and "name" in cfg))

    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        raw = open(path, encoding="utf-8").read()
        cfg = json.loads(raw)
        s = RiskSurface(kind="mcp", name=name or path, raw_ref=path)
        s.fingerprint = sha256_hex(raw)

        servers = cfg.get("mcpServers") or {}
        if "tools" in cfg:  # 단일 서버 정의 형태도 수용
            servers = {cfg.get("name", "unnamed"): cfg}

        for srv_name, srv in servers.items():
            cmd = srv.get("command", "")
            args = " ".join(str(a) for a in srv.get("args", []))
            if cmd:
                s.add("exec", f"command: {cmd} {args}".strip(),
                      location=f"mcpServers.{srv_name}.command",
                      excerpt=f"{cmd} {args}".strip())

            tools = srv.get("tools", [])
            for tool in tools:
                tname = tool.get("name", "unnamed")
                desc = str(tool.get("description", ""))
                loc = f"tools.{tname}.description"
                if desc:
                    # 설명서 전문은 hidden_instruction 분석 대상(1층 룰 + 2층 의도)
                    s.add("hidden_instruction", "tool description text",
                          location=loc, excerpt=desc)
                for url in find_urls(desc):
                    s.add("network", "설명서 내 외부 URL",
                          location=loc, excerpt=url)

            if not srv.get("publisher") and not srv.get("homepage"):
                s.add("identity", "unknown 등록자·출처 불명",
                      location=f"mcpServers.{srv_name}", excerpt=srv_name)
        return s
