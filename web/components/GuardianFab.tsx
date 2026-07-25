"use client";
// 우하단 원형 플로팅 버튼 — 우하단 원형 플로팅: 점수 링 + 위험 건수 배지 + 상태색.
// 클릭 시 코치 패널로 이동. 색상=신호등(개념모델 일관).

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { InspectResult } from "@/lib/types";

const COLORS: Record<string, string> = {
  green: "#30A46C",
  yellow: "#F5A623",
  red: "#E5484D",
};

export function GuardianFab({
  result,
  onClick,
}: {
  result: InspectResult | null;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  const score = result?.score ?? 100;
  const issues = result?.issues.length ?? 0;
  const level = !result || issues === 0 ? "green" : result.overall === "red" ? "red" : "yellow";
  const color = COLORS[level] ?? COLORS.green;

  // 점수 링(SVG 진행 호)
  const R = 26;
  const CIRC = 2 * Math.PI * R;
  const dash = (score / 100) * CIRC;

  return (
    <motion.button
      onClick={onClick}
      aria-label={`보안 점수 ${score}점, 위험 ${issues}건. 코치 패널 열기`}
      initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-2xl shadow-ink/25 outline-none ring-1 ring-line transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-brand active:scale-95"
    >
      <svg width="60" height="60" viewBox="0 0 60 60" className="absolute inset-0 m-auto -rotate-90">
        <circle cx="30" cy="30" r={R} fill="none" stroke="#EEF0F3" strokeWidth="4.5" />
        <motion.circle
          cx="30" cy="30" r={R} fill="none" stroke={color} strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRC}`}
          animate={reduce ? {} : { strokeDasharray: [`0 ${CIRC}`, `${dash} ${CIRC}`] }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <ShieldCheck size={22} style={{ color }} />
      {issues > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-black text-white ring-2 ring-card"
          style={{ backgroundColor: color }}
        >
          {issues}
        </span>
      )}
    </motion.button>
  );
}
