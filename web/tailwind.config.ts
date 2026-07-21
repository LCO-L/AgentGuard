import type { Config } from "tailwindcss";

/**
 * AgentGuard 디자인 토큰 — 도널드 노먼 원칙을 색·모션으로 인코딩.
 * · 자연스러운 매핑(mapping): 위험=red, 주의=amber, 안전=green (신호등 관습)
 * · 가시성(visibility): 상태색을 배경/테두리/글자에 일관 적용
 * · 피드백(feedback): fade/rise/pulse 모션으로 결과를 즉시 감각화
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16181D",
        sub: "#6B7280",
        line: "#E8E8EA",
        canvas: "#EEF0F3",
        card: "#FFFFFF",
        brand: { DEFAULT: "#2563EB", soft: "#EFF6FF", ink: "#1D4ED8" },
        risk: {
          critical: "#C4283C",
          red: "#E5484D",
          amber: "#F5A623",
          yellow: "#FFB224",
          green: "#30A46C",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ["SFMono-Regular", "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { xl: "16px", "2xl": "20px", "3xl": "24px" },
      boxShadow: {
        card: "0 10px 34px rgba(20,24,29,.10)",
        pop: "0 18px 60px rgba(20,24,29,.28)",
        glow: "0 8px 26px rgba(37,99,235,.42)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        fade: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(229,72,77,.45)" }, "70%": { boxShadow: "0 0 0 10px rgba(229,72,77,0)" }, "100%": { boxShadow: "0 0 0 0 rgba(229,72,77,0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        rise: "rise .28s cubic-bezier(.2,.7,.2,1)",
        fade: "fade .2s ease",
        pulseRing: "pulseRing 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
