/** @type {import('next').NextConfig} */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  // 개발 편의: /api/* 를 FastAPI 백엔드로 프록시(CORS 없이도 동작)
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_BASE}/:path*` }];
  },
};

export default nextConfig;
