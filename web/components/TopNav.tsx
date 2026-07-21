"use client";
// 일관된 개념모델 + 가시성: 어디서나 같은 상단바(브랜드·탭·엔진 상태).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { EngineIndicator } from "./EngineIndicator";

const NAV = [
  { href: "/", label: "검사" },
  { href: "/editor", label: "보안 에디터" },
  { href: "/scenarios", label: "시나리오" },
];

export function TopNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2 font-extrabold">
            <span className="text-lg">🛡️</span>
            <span className="text-[15px]">
              AgentGuard <span className="text-brand">ULTRA</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13.5px] font-bold transition-colors",
                    active ? "bg-ink text-white" : "text-sub hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <EngineIndicator />
      </div>
    </header>
  );
}
