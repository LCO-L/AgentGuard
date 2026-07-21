"use client";
// 통역 카드 — 피드백(결과 rise 애니메이션) + 매핑(색) + 온디바이스 신뢰 표시.

import { motion } from "framer-motion";
import { Card, Pill, ScoreBar } from "@/components/ui";
import { overallTone } from "@/lib/cn";
import type { Verdict } from "@/lib/types";

const ENGINE: Record<string, string> = {
  ollama: "🖥️ 온디바이스 Ollama",
  claude: "☁️ Claude",
  openrouter: "☁️ OpenRouter",
  fallback: "⚙️ 오프라인 규칙",
  off: "⚙️ 오프라인 규칙",
  local: "⚙️ 오프라인 규칙",
};

export function RiskCard({ v }: { v: Verdict }) {
  const t = overallTone[v.overall] ?? overallTone.green;
  const c = v.card;
  if (!c) return null;
  const rows = [
    { k: "무엇이 숨어 있나", val: c.hidden, mark: v.overall === "green" ? "🟢" : "🔴" },
    { k: "어떻게 작동하나", val: c.how, mark: "🟡" },
    { k: "내 기기에 무슨 피해", val: c.impact, mark: v.overall === "green" ? "🟢" : "🔴" },
  ].filter((r) => r.val);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-[18px] py-3 text-xs font-bold">
          <span className="text-sub">
            검사한 것 · <b className="text-ink">{v.surface_kind}</b>
          </span>
          <Pill tone={v.overall === "red" ? "red" : v.overall === "yellow" ? "amber" : "green"}>
            {t.word}
          </Pill>
        </div>

        <div className="flex items-start gap-3.5 px-[22px] pb-3 pt-[18px]">
          <div className={`flex h-[46px] w-[46px] items-center justify-center rounded-[14px] text-[23px] ${t.bg}`}>
            {t.dot}
          </div>
          <div className="pt-1 text-[19px] font-extrabold tracking-tight">{c.headline}</div>
        </div>

        <div className="px-[22px]">
          <ScoreBar score={v.score} hex={t.hex} />
          <div className="pt-1 text-[11.5px] font-bold text-sub">위험 점수 {v.score} / 100</div>
        </div>

        <div className="px-[22px] pb-1.5 pt-2">
          {rows.map((r) => (
            <div key={r.k} className="flex gap-3 border-t border-line py-3">
              <div className="text-base">{r.mark}</div>
              <div>
                <div className="text-xs font-bold text-sub">{r.k}</div>
                <div className="mt-0.5 text-[15px]">{r.val}</div>
              </div>
            </div>
          ))}
        </div>

        {c.action && (
          <div className={`mx-[22px] mb-3 rounded-[14px] p-3.5 ${t.bg}`}>
            <div className={`text-[15px] font-extrabold ${t.text}`}>{c.action}</div>
          </div>
        )}

        {v.findings?.length > 0 && (
          <div className="flex flex-col gap-1.5 px-[22px] pb-2">
            {v.findings.slice(0, 6).map((f, i) => (
              <div key={i} className="flex gap-2 rounded-[9px] bg-[#F7F8FA] px-2.5 py-[7px] text-xs">
                <span className={`font-mono font-bold ${f.severity === "red" ? "text-risk-red" : f.severity === "yellow" ? "text-[#B45309]" : "text-sub"}`}>
                  {f.rule_id}
                </span>
                <span>{f.what}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 border-t border-line bg-risk-green/[.07] p-[11px] text-xs font-bold text-risk-green">
          🔒 기기 안에서 검사했어요 · 판단: <span className="text-brand">{ENGINE[v.engine] ?? "⚙️ 오프라인 규칙"}</span>
        </div>
      </Card>
    </motion.div>
  );
}
