"use client";
// 가시성 원칙: 현재 판단 엔진과 연결 상태를 항상 보여준다. 클릭 → 설정.

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { engineLabel, loadConfig } from "@/lib/config";
import { cn } from "@/lib/cn";

export function EngineIndicator() {
  const [label, setLabel] = useState("✨ 자동");
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    const cfg = loadConfig();
    setLabel(engineLabel(cfg));
    api
      .aiStatus()
      .then((s) => {
        const p = s.providers;
        const on =
          cfg.provider === "ollama"
            ? p.ollama
            : cfg.provider === "claude"
              ? p.claude
              : cfg.provider === "openrouter"
                ? p.openrouter
                : p.ollama || p.claude || p.openrouter;
        setLive(!!on);
      })
      .catch(() => setLive(false));
  }, []);

  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[12.5px] font-bold text-ink transition-colors hover:border-brand"
      title="AI 엔진 설정"
    >
      <span
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          live === null ? "bg-line" : live ? "bg-risk-green" : "bg-sub",
        )}
      />
      {label}
    </Link>
  );
}
