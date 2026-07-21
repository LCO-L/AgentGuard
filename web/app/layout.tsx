import "./globals.css";
import type { Metadata, Viewport } from "next";
import { TopNav } from "@/components/TopNav";

export const metadata: Metadata = {
  title: "AgentGuard — 온디바이스 통합 보안",
  description:
    "파일·AI도구·링크·프롬프트의 숨은 위험을 기기 안에서 검사하고 쉬운 말로 통역합니다.",
  manifest: "/api/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#5B5BD6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <TopNav />
        <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-6">{children}</main>
      </body>
    </html>
  );
}
