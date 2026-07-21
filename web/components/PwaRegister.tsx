"use client";

import { useEffect } from "react";

/** PWA 서비스워커 등록 — 백엔드가 서빙하는 /api/sw.js 를 프록시 경유로 등록. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/api/sw.js")
        .catch(() => {
          /* SW 등록 실패는 앱 동작에 영향 없음 */
        });
    }
  }, []);
  return null;
}
