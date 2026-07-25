"use client";
// 보안 코치 패널 — 설명 먼저(why) + 수정안(fix/suggestion) + 명시적 선택(마스킹/허용).

import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { categoryLabel, sevTone } from "@/lib/cn";
import type { Issue, InspectResult } from "@/lib/types";

// 4색 카테고리 도트 — 밑줄 물결과 같은 색(매핑 일관)
const CAT_DOT: Record<string, string> = {
  inject: "#E5484D",
  secret: "#F5A623",
  pii: "#F5A623",
  vuln: "#3B82F6",
  agency: "#3B82F6",
  stego: "#8B5CF6",
  obfuscation: "#8B5CF6",
};

export function CoachPanel({
  result,
  allow,
  onMask,
  onAllow,
  onGoto,
}: {
  result: InspectResult | null;
  allow: Set<string>;
  onMask: () => void;
  onAllow: (key: string) => void;
  onGoto: (start: number) => void;
}) {
  if (!result) {
    return (
      <div className="p-8 text-center text-sm text-sub">
        여기에 위험 요소와 수정안이 실시간으로 나타납니다.
      </div>
    );
  }
  const issues = result.issues.filter((i) => !allow.has(i.rule_id + ":" + i.start));
  if (issues.length === 0) {
    return <div className="p-8 text-center text-sm text-risk-green">✅ 지금은 위험 신호가 없어요.</div>;
  }
  return (
    <div className="flex flex-col gap-2.5 p-3">
      {result.coach_note && (
        <div className="rounded-xl border border-[#DADCFB] bg-[#EEF0FF] px-3 py-2.5 text-[12.5px] text-[#3A3D6B]">
          💡 {result.coach_note}
        </div>
      )}
      {issues.map((i: Issue, idx) => {
        const tone = sevTone[i.severity] ?? sevTone.low;
        const canMask = i.category === "secret" || i.category === "pii";
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className={`rounded-xl border border-l-4 border-line bg-card p-3 ${tone.ring}`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CAT_DOT[i.category] ?? "#6B7280" }}
              />
              <span className={`text-[10.5px] font-extrabold uppercase tracking-wide ${tone.text}`}>
                {categoryLabel[i.category] ?? i.category} · {i.severity}
              </span>
            </div>
            <div className="mt-0.5 text-sm font-extrabold">{i.title}</div>
            <div className="text-[12.5px] text-[#3A3D46]">{i.why}</div>
            {i.decoded && (
              <div className="mt-1.5 break-all rounded-md bg-[#F4F5F8] px-2 py-1.5 font-mono text-[11.5px]">
                숨은 내용: {i.decoded}
              </div>
            )}
            {i.fix && <div className="mt-1.5 text-xs text-sub">→ {i.fix}</div>}
            {i.suggestion && (
              <div className="mt-1.5 whitespace-pre-wrap break-all rounded-md bg-[#F4F5F8] px-2 py-1.5 font-mono text-[11.5px]">
                {i.suggestion}
              </div>
            )}
            <div className="mt-2.5 flex gap-1.5">
              {canMask && (
                <button
                  onClick={onMask}
                  className="rounded-lg bg-[#30A46C] px-3 py-1.5 text-xs font-extrabold text-white transition-transform hover:scale-[1.03] active:scale-95"
                >
                  ✓ 마스킹 적용
                </button>
              )}
              <Button variant="ghost" onClick={() => onGoto(i.start)} className="px-2.5 py-1.5 text-xs">
                위치로
              </Button>
              <Button variant="ghost" onClick={() => onAllow(i.rule_id + ":" + i.start)} className="px-2.5 py-1.5 text-xs text-sub">
                무시
              </Button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
