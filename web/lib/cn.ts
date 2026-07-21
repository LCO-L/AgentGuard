import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// severity → 표시 색 계열(자연스러운 매핑: 위험=red)
export const sevTone: Record<string, { text: string; bg: string; ring: string; label: string }> = {
  critical: { text: "text-risk-critical", bg: "bg-risk-critical/10", ring: "border-risk-critical", label: "치명" },
  high: { text: "text-risk-red", bg: "bg-risk-red/10", ring: "border-risk-red", label: "높음" },
  medium: { text: "text-[#B45309]", bg: "bg-risk-yellow/15", ring: "border-risk-yellow", label: "주의" },
  low: { text: "text-sub", bg: "bg-line/40", ring: "border-line", label: "낮음" },
};

export const overallTone: Record<string, { text: string; bg: string; dot: string; word: string; hex: string }> = {
  red: { text: "text-risk-red", bg: "bg-risk-red/10", dot: "🛑", word: "위험", hex: "#E5484D" },
  yellow: { text: "text-[#B45309]", bg: "bg-risk-yellow/15", dot: "⚠️", word: "주의", hex: "#FFB224" },
  green: { text: "text-risk-green", bg: "bg-risk-green/10", dot: "✅", word: "안전", hex: "#30A46C" },
};

export const categoryLabel: Record<string, string> = {
  secret: "비밀값",
  pii: "개인정보",
  vuln: "취약코드",
  agency: "과잉권한",
  inject: "인젝션",
  stego: "은닉",
};
