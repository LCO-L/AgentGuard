// AgentGuard API 클라이언트 — 백엔드 /v1 호출(next.config rewrites 로 /api → FastAPI).
// 헤더에 선택된 provider/키를 실어 온디바이스/클라우드 전환을 지원.

import { aiHeaders, loadConfig } from "./config";
import type {
  AIStatus,
  InspectResult,
  ScenarioInfo,
  Verdict,
} from "./types";

// 웹: /api 프록시(rewrites) / 정적 export: NEXT_PUBLIC_API_ABSOLUTE 사용.
// 빈 문자열("")이면 같은 오리진(FastAPI가 정적 서빙할 때) — /v1 직접 호출.
const BASE = process.env.NEXT_PUBLIC_API_ABSOLUTE ?? "/api";

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aiHeaders(loadConfig()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: aiHeaders(loadConfig()) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  inspect: (text: string, kind = "auto", explain = false) =>
    postJSON<InspectResult>("/v1/inspect", { text, kind, explain }),

  redact: (text: string) =>
    postJSON<{ masked: string; mapping: Record<string, string>; count: number }>(
      "/v1/redact",
      { text },
    ),

  scanText: (text: string, source = "web") =>
    postJSON<Verdict>("/v1/scan/text", { text, source }),

  scanUrl: (url: string) => postJSON<Verdict>("/v1/scan/url", { url }),

  scanFile: async (file: File): Promise<Verdict> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/v1/scan`, {
      method: "POST",
      headers: aiHeaders(loadConfig()),
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error((e as { detail?: string }).detail || `HTTP ${res.status}`);
    }
    return res.json() as Promise<Verdict>;
  },

  chat: (
    messages: { role: string; content: string }[],
    context: unknown = null,
  ) => postJSON<{ reply: string; engine: string }>("/v1/chat", { messages, context }),

  aiStatus: () => getJSON<AIStatus>("/v1/ai/status"),
  aiModels: (provider: string) =>
    getJSON<{ provider: string; models: string[] }>(`/v1/ai/models?provider=${provider}`),
  aiTest: () =>
    postJSON<{ ok: boolean; latency_ms: number; engine: string; model: string }>(
      "/v1/ai/test",
      {},
    ),

  scenarios: () =>
    getJSON<{ stats: Record<string, unknown>; scenarios: ScenarioInfo[] }>(
      "/v1/scenarios",
    ),
};
