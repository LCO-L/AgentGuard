"use client";
// 지능적 AI 엔진 설정 — 온디바이스/Claude/OpenRouter. 상태 자동감지·모델 로드·연결 테스트.
// 노먼: 가시성(상태 배지)·피드백(테스트 결과)·제약(선택된 provider만 키 노출).

import { useEffect, useState } from "react";
import { CheckCircle2, Cpu, Cloud, Loader2, Sparkles, Power } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { aiHeaders, loadConfig, saveConfig, type AGConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import type { Provider } from "@/lib/types";

export default function SettingsPage() {
  const [cfg, setCfg] = useState<AGConfig>(loadConfig());
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [test, setTest] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const patch = (p: Partial<AGConfig>) => {
    const next = { ...cfg, ...p };
    setCfg(next);
    saveConfig(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  useEffect(() => {
    api.aiStatus().then((s) => setStatus(s.providers)).catch(() => setStatus({}));
  }, []);

  async function runTest(provider: Provider) {
    setTest((t) => ({ ...t, [provider]: "…" }));
    try {
      // 테스트는 해당 provider 헤더로 강제
      const headers = aiHeaders({ ...cfg, provider });
      const res = await fetch("/api/v1/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: "{}",
      });
      const d = await res.json();
      setTest((t) => ({
        ...t,
        [provider]: d.ok ? `✓ 연결됨 · ${d.latency_ms}ms · ${d.model || d.engine}` : `✗ 연결 실패${d.error ? ` — ${d.error}` : ""}`,
      }));
    } catch {
      setTest((t) => ({ ...t, [provider]: "✗ 서버 없음" }));
    }
  }

  const cards = [
    {
      p: "ollama" as Provider,
      icon: <Cpu size={18} />,
      title: "온디바이스 (Ollama)",
      desc: "내 컴퓨터에서 실행 · 파일이 밖으로 안 나감",
      keyField: (
        <Field label="Ollama 주소">
          <input
            value={cfg.ollamaUrl}
            onChange={(e) => patch({ ollamaUrl: e.target.value })}
            placeholder="http://localhost:11434"
            className="ag-input"
          />
        </Field>
      ),
    },
    {
      p: "claude" as Provider,
      icon: <Cloud size={18} />,
      title: "Claude",
      desc: "Anthropic API · 가장 정교한 통역",
      keyField: (
        <Field label="API 키 (브라우저에만 저장)">
          <input
            type="password"
            value={cfg.claudeKey}
            onChange={(e) => patch({ claudeKey: e.target.value })}
            placeholder="sk-ant-..."
            className="ag-input"
          />
        </Field>
      ),
    },
    {
      p: "openrouter" as Provider,
      icon: <Cloud size={18} />,
      title: "OpenRouter",
      desc: "수백 개 모델을 한 키로",
      keyField: (
        <Field label="API 키 (브라우저에만 저장)">
          <input
            type="password"
            value={cfg.openrouterKey}
            onChange={(e) => patch({ openrouterKey: e.target.value })}
            placeholder="sk-or-..."
            className="ag-input"
          />
        </Field>
      ),
    },
  ];

// ── 온디바이스 원클릭 실행 카드 — 버튼 하나로 Ollama 기동+8B pull+즉시 사용 ──
type OdState = { state: string; progress: number; message: string; model: string };

function OndeviceCard({ onReady }: { onReady: (model: string) => void }) {
  const [od, setOd] = useState<OdState | null>(null);
  const busy = od && ["checking", "starting", "pulling"].includes(od.state);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/v1/ai/ondevice/status");
        const d = (await r.json()) as OdState;
        setOd(d);
        if (d.state === "ready") onReady(d.model);
      } catch { /* 서버 끊기면 다음 폴 백 */ }
    }, 1200);
    return () => clearInterval(t);
  }, [busy, onReady]);

  async function start() {
    setOd({ state: "checking", progress: 0, message: "준비 중…", model: "" });
    try {
      const r = await fetch("/api/v1/ai/ondevice/start", { method: "POST" });
      setOd(await r.json());
    } catch {
      setOd({ state: "error", progress: 0, message: "백엔드에 연결할 수 없어요", model: "" });
    }
  }

  const color = od?.state === "ready" ? "text-risk-green"
    : od?.state === "error" || od?.state === "no_ollama" ? "text-risk-red" : "text-brand";

  return (
    <Card className="border-brand/40 bg-gradient-to-br from-brand-soft/60 to-transparent p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
          <Power size={19} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-extrabold">온디바이스 실행</div>
          <div className="text-[12px] text-sub">
            버튼 하나면 Ollama가 켜지고 8B 모델이 자동으로 준비돼요
          </div>
        </div>
        <Button onClick={start} disabled={!!busy} className="px-4 py-2.5 text-[13px]">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
          {busy ? "준비 중…" : od?.state === "ready" ? "다시 실행" : "실행"}
        </Button>
      </div>
      {od && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-line/60">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${od.progress}%` }}
            />
          </div>
          <div className={cn("mt-1.5 text-[12px] font-bold", color)}>{od.message}</div>
          {od.state === "no_ollama" && (
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer"
              className="mt-1 inline-block text-[12px] font-extrabold text-brand underline underline-offset-4">
              Ollama 설치하기 →
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <style>{`.ag-input{width:100%;border:1px solid #E8E8EA;border-radius:9px;padding:9px 11px;font-size:13.5px;outline:none}.ag-input:focus{border-color:#5B5BD6}`}</style>
      <div className="pt-2">
        <h1 className="text-[24px] font-extrabold tracking-tight">AI 엔진 설정</h1>
        <p className="mt-1 text-[13.5px] text-sub">
          보안 판단·통역에 쓸 엔진을 고르세요. <b>온디바이스</b>는 인터넷 없이, <b>Claude·OpenRouter</b>는
          API 키로. 셋 다 없어도 오프라인 규칙으로 항상 작동해요.
        </p>
      </div>

      {/* ── 온디바이스 원클릭 실행 ── */}
      <OndeviceCard onReady={(model) => patch({ provider: "ollama", ollamaModel: model })} />

      {cards.map((c) => {
        const on = status[c.p];
        const selected = cfg.provider === c.p;
        return (
          <Card key={c.p} className={cn("p-4 transition-shadow", selected && "border-brand shadow-glow")}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                {c.icon}
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-extrabold">{c.title}</div>
                <div className="text-[12px] text-sub">{c.desc}</div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                  on ? "bg-risk-green/10 text-risk-green" : "bg-line/50 text-sub",
                )}
              >
                {on ? "● 연결됨" : c.p === "ollama" ? "○ 오프라인" : "○ 키 필요"}
              </span>
              <Button
                variant={selected ? "primary" : "ghost"}
                onClick={() => patch({ provider: c.p })}
                className="px-3.5 py-2 text-[13px]"
              >
                {selected ? "선택됨" : "선택"}
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {c.keyField}
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => runTest(c.p)} className="px-3 py-2 text-[12.5px]">
                  연결 테스트
                </Button>
                {test[c.p] && (
                  <span
                    className={cn(
                      "text-[12px] font-bold",
                      test[c.p].startsWith("✓") ? "text-risk-green" : test[c.p] === "…" ? "text-sub" : "text-risk-red",
                    )}
                  >
                    {test[c.p] === "…" ? <Loader2 className="inline animate-spin" size={13} /> : test[c.p]}
                  </span>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <div className="flex gap-2">
        <button
          onClick={() => patch({ provider: "auto" })}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-[13px] font-bold",
            cfg.provider === "auto" ? "border-brand text-brand" : "border-line text-ink",
          )}
        >
          <Sparkles size={16} /> 자동 (지능적 선택)
        </button>
        <button
          onClick={() => patch({ provider: "off" })}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-[13px] font-bold",
            cfg.provider === "off" ? "border-brand text-brand" : "border-line text-ink",
          )}
        >
          <Power size={16} /> 끄기 (오프라인 규칙만)
        </button>
      </div>

      <p className="text-center text-[11.5px] text-sub">
        설정은 이 브라우저에만 저장됩니다. 대시보드·에디터·위젯이 이 설정을 함께 사용해요.
      </p>

      {saved && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-bold text-white animate-fade">
          <CheckCircle2 size={14} /> 저장됐어요
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] font-bold text-sub">{label}</span>
      {children}
    </label>
  );
}
