"use client";
// 일관된 개념모델 + 가시성: 어디서나 같은 상단바(브랜드·탭·엔진 상태).
// 비교/확장 다운로드는 백엔드(FastAPI) 산출물이라 /api 프록시 경유 외부 링크.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { cn } from "@/lib/cn";
import { EngineIndicator } from "./EngineIndicator";

const NAV = [
  { href: "/", label: "검사" },
  { href: "/editor", label: "보안 에디터" },
  { href: "/compare", label: "비교", external: true },
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
              const active = !n.external && (n.href === "/" ? path === "/" : path.startsWith(n.href));
              const cls = cn(
                "rounded-lg px-3 py-1.5 text-[13.5px] font-bold transition-colors",
                active ? "bg-ink text-white" : "text-sub hover:text-ink",
              );
              return n.external ? (
                <a key={n.href} href={`/api${n.href}`} className={cls}>
                  {n.label}
                </a>
              ) : (
                <Link key={n.href} href={n.href} className={cls}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/extension.zip"
            download
            className="hidden items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[12.5px] font-extrabold text-white shadow-glow hover:brightness-105 sm:inline-flex"
            title="크롬 확장 프로그램(zip) 다운로드"
          >
            <Download size={14} /> 확장 설치
          </a>
          <EngineIndicator />
        </div>
      </div>
    </header>
  );
}
