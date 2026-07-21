"use client";
// 시나리오 카탈로그 — "무엇을 잡는지" 가시화 + 확장성("데이터 한 줄로 추가") 설명.

import { useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
import { Card, Pill } from "@/components/ui";
import { api } from "@/lib/api";
import { categoryLabel, sevTone } from "@/lib/cn";
import type { ScenarioInfo } from "@/lib/types";

export default function ScenariosPage() {
  const [scen, setScen] = useState<ScenarioInfo[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});

  useEffect(() => {
    api
      .scenarios()
      .then((d) => {
        setScen(d.scenarios);
        setStats(d.stats);
      })
      .catch(() => setScen([]));
  }, []);

  const byCat: Record<string, ScenarioInfo[]> = {};
  for (const s of scen) (byCat[s.category] ??= []).push(s);

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-2">
        <h1 className="flex items-center gap-2 text-[24px] font-extrabold tracking-tight">
          <Layers className="text-brand" /> 탐지 시나리오
        </h1>
        <p className="mt-1 text-[14px] text-sub">
          지금 잡을 수 있는 보안 시나리오예요. 새 공격 유형은 <b>데이터 한 줄</b>이면 추가됩니다
          (엔진 코드는 안 바꿔요).
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-4 text-[13px]">
        <Pill tone="brand">
          <Plus size={12} /> 확장성
        </Pill>
        <span className="text-sub">
          <code className="rounded bg-canvas px-1.5 py-0.5 font-mono">rulepacks/scenarios_data.py</code> 에
          Scenario(...) 한 줄을 추가하면 인스펙션·에디터·익스텐션·통역이 자동으로 잡습니다.
        </span>
        <span className="ml-auto font-bold text-ink">
          총 {typeof stats.regex_scenarios === "number" ? stats.regex_scenarios : scen.length}개 시나리오
        </span>
      </Card>

      {Object.entries(byCat).map(([cat, items]) => (
        <div key={cat}>
          <div className="mb-2 flex items-center gap-2 text-[15px] font-extrabold">
            {categoryLabel[cat] ?? cat}
            <span className="text-[12px] font-bold text-sub">{items.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((s) => {
              const tone = sevTone[s.severity] ?? sevTone.low;
              return (
                <Card key={s.id} className={`border-l-4 p-3 ${tone.ring}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-sub">{s.id}</span>
                    <span className={`text-[10.5px] font-extrabold uppercase ${tone.text}`}>{s.severity}</span>
                  </div>
                  <div className="mt-0.5 text-[14px] font-extrabold">{s.title}</div>
                  <div className="text-[12.5px] text-[#3A3D46]">{s.why}</div>
                  {s.has_fix && <div className="mt-1 text-[11px] font-bold text-risk-green">✓ 수정안 제공</div>}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
