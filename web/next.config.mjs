/** @type {import('next').NextConfig} */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
// CAPACITOR_BUILD=1 이면 APK용 정적 export (rewrites 불가 → 클라이언트가 백엔드 직접 호출)
const IS_CAP = process.env.CAPACITOR_BUILD === "1";

const nextConfig = {
  reactStrictMode: true,
  ...(IS_CAP
    ? { output: "export", images: { unoptimized: true } }
    : {
        // 개발 편의: /api/* 를 FastAPI 백엔드로 프록시(CORS 없이도 동작)
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${API_BASE}/:path*` }];
        },
      }),
};

export default nextConfig;
