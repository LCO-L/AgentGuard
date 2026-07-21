/* AgentGuard PWA 서비스 워커 — 최소 오프라인 셸 캐시.
 * 공유 시트(Web Share Target)로 열릴 때 대시보드가 즉시 뜨도록 셸을 캐시한다.
 * 검사 요청(/v1/*)은 항상 네트워크(온디바이스 백엔드)로 보낸다. */
const CACHE = "agentguard-shell-v1";
const SHELL = ["/", "/agconfig.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API 는 항상 네트워크
  if (url.pathname.startsWith("/v1/")) return;
  // 셸은 캐시 우선 → 네트워크 폴백
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match("/"))));
});
