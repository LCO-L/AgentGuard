// AgentGuard 공통 타입 — 백엔드 /v1 응답 스키마와 1:1.

export type Severity = "critical" | "high" | "medium" | "low";
export type Overall = "red" | "yellow" | "green";
export type Provider = "auto" | "ollama" | "claude" | "openrouter" | "off";
export type Category =
  | "secret" | "pii" | "vuln" | "agency" | "inject" | "stego";

export interface Issue {
  start: number;
  end: number;
  category: Category;
  rule_id: string;
  severity: Severity;
  title: string;
  why: string;
  fix?: string;
  suggestion?: string;
  token?: string;
  decoded?: string;
}

export interface Summary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface InspectResult {
  overall: Overall;
  score: number;
  summary: Summary;
  issues: Issue[];
  masked: string;
  mapping: Record<string, string>;
  has_secrets: boolean;
  coach_note?: string;
}

export interface Card {
  overall: Overall;
  headline: string;
  hidden: string;
  how: string;
  impact: string;
  action: string;
  source: string;
}

export interface Finding {
  layer: number;
  rule_id: string;
  cap_kind: string;
  severity: Overall;
  where: string;
  what: string;
  evidence: string;
  i18n_key: string;
  weight: number;
  confidence: number;
}

export interface Verdict {
  surface_kind: string;
  overall: Overall;
  score: number;
  findings: Finding[];
  card: Card | null;
  engine: string;
  scan_id: string;
}

export interface AIStatus {
  providers: { ollama: boolean; claude: boolean; openrouter: boolean };
  resolved_provider: string;
  ollama_url: string;
  default_models: Record<string, string>;
}

export interface ScenarioInfo {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  why: string;
  has_fix: boolean;
  pack: string;
}
