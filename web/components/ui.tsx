"use client";
// 디자인 프리미티브 — 어포던스(눌러보임)·피드백(hover/active)·가시성(상태색).

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// ── Button ──
type BtnVariant = "primary" | "ghost" | "danger" | "safe" | "soft";
export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: { variant?: BtnVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-ink text-white hover:bg-black",
    ghost: "bg-transparent text-sub hover:bg-line/50 border border-line",
    danger: "bg-risk-red text-white hover:brightness-95",
    safe: "bg-risk-green text-white hover:brightness-95",
    soft: "bg-brand-soft text-brand-ink hover:brightness-95",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold",
        "transition-all active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Card ──
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-card shadow-card", className)}>
      {children}
    </div>
  );
}

// ── Badge / Pill ──
export function Pill({
  tone = "sub",
  className,
  children,
}: { tone?: "sub" | "brand" | "green" | "red" | "amber"; className?: string; children: ReactNode }) {
  const tones = {
    sub: "bg-line/50 text-sub",
    brand: "bg-brand-soft text-brand-ink",
    green: "bg-risk-green/10 text-risk-green",
    red: "bg-risk-red/10 text-risk-red",
    amber: "bg-risk-yellow/15 text-[#B45309]",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold", tones[tone], className)}>
      {children}
    </span>
  );
}

// ── ScoreBar — 위험 점수 시각화(매핑: 값↑ 위험↑, 색 신호등) ──
export function ScoreBar({ score, hex }: { score: number; hex: string }) {
  return (
    <div className="h-[7px] w-full overflow-hidden rounded-full bg-canvas">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: hex }}
      />
    </div>
  );
}

// ── Tabs ──
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { key: T; label: string }[];
}) {
  return (
    <div className="inline-flex gap-1 rounded-xl bg-canvas p-1">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            "rounded-lg px-3.5 py-2 text-[13px] font-bold transition-colors",
            value === it.key ? "bg-ink text-white" : "text-sub hover:text-ink",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
