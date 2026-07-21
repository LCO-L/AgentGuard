// AGConfig — AI provider 설정(브라우저 localStorage). 순수 JS 위젯과 같은 키("ag_cfg").
// 온디바이스 원칙: 키는 브라우저에만, 선택된 provider 헤더만 전송.

import type { Provider } from "./types";

export interface AGConfig {
  provider: Provider;
  ollamaUrl: string;
  ollamaModel: string;
  claudeKey: string;
  claudeModel: string;
  openrouterKey: string;
  openrouterModel: string;
}

const KEY = "ag_cfg";
const DEFAULT: AGConfig = {
  provider: "auto",
  ollamaUrl: "",
  ollamaModel: "",
  claudeKey: "",
  claudeModel: "",
  openrouterKey: "",
  openrouterModel: "",
};

export function loadConfig(): AGConfig {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveConfig(cfg: AGConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT, ...cfg }));
}

export function aiHeaders(cfg: AGConfig): Record<string, string> {
  const h: Record<string, string> = {};
  if (cfg.provider) h["X-AI-Provider"] = cfg.provider;
  if (cfg.provider === "claude") {
    if (cfg.claudeKey) h["X-AI-Key"] = cfg.claudeKey;
    if (cfg.claudeModel) h["X-AI-Model"] = cfg.claudeModel;
  } else if (cfg.provider === "openrouter") {
    if (cfg.openrouterKey) h["X-AI-Key"] = cfg.openrouterKey;
    if (cfg.openrouterModel) h["X-AI-Model"] = cfg.openrouterModel;
  } else if (cfg.provider === "ollama") {
    if (cfg.ollamaModel) h["X-AI-Model"] = cfg.ollamaModel;
  }
  if (cfg.ollamaUrl) h["X-Ollama-Url"] = cfg.ollamaUrl;
  return h;
}

export function engineLabel(cfg: AGConfig): string {
  return (
    {
      ollama: "🖥️ 온디바이스",
      claude: "☁️ Claude",
      openrouter: "☁️ OpenRouter",
      auto: "✨ 자동",
      off: "⚙️ 오프라인 규칙",
    } as Record<Provider, string>
  )[cfg.provider];
}
