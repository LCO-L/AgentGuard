"use client";
// 프리미엄 온볼딩 — 첫 방문 3단계 가이드 투어.
// 노먼: 개념모델(문지기) 점진 형성 · 피드백(단계 진행) · 제약(한 번에 한 가지).
// 접근성: Esc 닫기 · 포커스 이동 · reduced-motion 시 페이드만.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "ag_onboarded";

const STEPS = [
  {
    emoji: "🛡️",
    title: "AI에게 별내기 전, 먼저 검사하세요",
    body: "문서·링크·AI 도구에 숨은 명령과 개인정보를 기기 안에서 찾아, 쉬운 말로 알려드려요. 원본은 밖으로 나가지 않아요.",
    cta: "다음",
  },
  {
    emoji: "🚦",
    title: "신호등만 볼면 돼요",
    body: "초록은 안전, 노랑은 주의, 빨강은 위험. 어려운 경고문 대신 '지금 뭘 하면 되는지' 한 줄로 알려드려요.",
    cta: "다음",
  },
  {
    emoji: "🧩",
    title: "확장 프로그램으로 항상 곁에",
    body: "브라우저 확장을 설치하면 ChatGPT·Claude에 별내기 직전에 자동으로 지켜드려요. 10초면 설치돼요.",
    cta: "체험 시작하기",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) {
        const t = setTimeout(() => setStep(0), 600); // 첫 페인트 후 부드럽게
        return () => clearTimeout(t);
      }
    } catch { /* localStorage 불가 환경 무시 */ }
  }, []);

  useEffect(() => {
    if (step !== null) btnRef.current?.focus();
  }, [step]);

  const close = useCallback((go?: string) => {
    try { localStorage.setItem(KEY, "1"); } catch { /* 무시 */ }
    setStep(null);
    if (go) router.push(go);
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 24, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.98 } };

  return (
    <AnimatePresence>
      {step !== null && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" aria-label="AgentGuard 시작 가이드"
          onClick={() => close()}
        >
          <motion.div
            {...fade}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="w-full max-w-md rounded-3xl border border-line bg-card p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 진행 표시 — 피드백 */}
            <div className="mb-5 flex gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <div key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    i <= step ? "bg-brand" : "bg-line"}`} />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, x: reduce ? 0 : 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduce ? 0 : -18 }}
                transition={{ duration: 0.22 }}>
                <div className="text-4xl">{STEPS[step].emoji}</div>
                <h2 className="mt-3 text-xl font-extrabold tracking-tight">
                  {STEPS[step].title}
                </h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-sub">
                  {STEPS[step].body}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => close()}
                className="text-[13px] font-bold text-sub underline-offset-4 hover:underline">
                건늘뛰기
              </button>
              <button
                ref={btnRef}
                onClick={() =>
                  step < STEPS.length - 1 ? setStep(step + 1) : close("/scan")}
                className="rounded-xl bg-brand px-5 py-2.5 text-[14px] font-extrabold text-white shadow-lg shadow-brand/30 transition-transform hover:scale-[1.03] active:scale-95">
                {STEPS[step].cta}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 설정 등에서 "가이드 다시 보기"용 */
export function resetOnboarding(): void {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}
