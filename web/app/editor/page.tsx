"use client";
// 보안 에디터 페이지 — AI 전송 전 실시간 검사(Grammarly for Security).

import { ShieldAlert } from "lucide-react";
import { SecurityEditor } from "@/components/SecurityEditor";

export default function EditorPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="pt-2">
        <h1 className="flex items-center gap-2 text-[24px] font-extrabold tracking-tight">
          <ShieldAlert className="text-brand" /> 보안 에디터
        </h1>
        <p className="mt-1 text-[14px] text-sub">
          AI에게 보내기 <b>직전</b>에 검사합니다. 비밀·개인정보는 <b>복원 가능하게 마스킹</b>하고,
          취약 코드·과잉권한·숨은 명령은 밑줄과 수정안으로 알려드려요.
        </p>
      </div>
      <SecurityEditor />
    </div>
  );
}
