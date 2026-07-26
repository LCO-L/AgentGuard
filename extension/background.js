/* © 2026 DONGHUN LEE · AgentGuard · MIT License. */
/* AgentGuard 익스텐션 — 백그라운드 서비스 워커.
 *
 * 역할:
 *  1) 우클릭 컨텍스트 메뉴(링크·이미지·선택텍스트·페이지) → 즉시 검사
 *  2) 다운로드 가로채기(downloads.onCreated) → URL 사전 검사
 *  3) 백엔드 호출(설정된 provider/키 헤더 주입) → 결과를 content 로 전달
 *
 * 설정은 chrome.storage.local 에 저장(온디바이스 원칙: 키는 로컬만).
 */
const DEFAULTS = {
  apiBase: "https://agentguard.maeum.ai",  // 기본 = 배포 백엔드(설치 없이 바로 동작). 로컬 실행 시 팝업에서 http://localhost:8000 로 변경
  provider: "ollama",     // 기본 = 온디바이스

  ollamaUrl: "", ollamaModel: "",
  claudeKey: "", claudeModel: "",
  openrouterKey: "", openrouterModel: "",
  enabled: true,          // 마스터 on/off
  disabledSites: [],      // 사이트별 제외
  log: [],                // 차단/검사 로그(최근 50건, 로컬만)
  clientId: ""            // 브라우저별 익명 ID — 러그풀·이력을 이 브라우저 단위로 격리
};

async function getCfg() {
  const c = await chrome.storage.local.get(DEFAULTS);
  const cfg = Object.assign({}, DEFAULTS, c);
  if (!cfg.clientId) {  // 최초 1회 생성 후 보존
    cfg.clientId = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36));
    chrome.storage.local.set({ clientId: cfg.clientId });
  }
  return cfg;
}

function aiHeaders(c) {
  const h = { "Content-Type": "application/json" };
  if (c.clientId) h["X-AG-Client"] = c.clientId;
  if (c.provider) h["X-AI-Provider"] = c.provider;
  if (c.provider === "claude") { if (c.claudeKey) h["X-AI-Key"] = c.claudeKey; if (c.claudeModel) h["X-AI-Model"] = c.claudeModel; }
  else if (c.provider === "openrouter") { if (c.openrouterKey) h["X-AI-Key"] = c.openrouterKey; if (c.openrouterModel) h["X-AI-Model"] = c.openrouterModel; }
  else if (c.provider === "ollama") { if (c.ollamaModel) h["X-AI-Model"] = c.ollamaModel; }
  if (c.ollamaUrl) h["X-Ollama-Url"] = c.ollamaUrl;
  return h;
}

// ── 컨텍스트 메뉴 ──
const MENUS = [
  { id: "ag-link", title: "🛡️ AgentGuard로 이 링크 검사", contexts: ["link"] },
  { id: "ag-image", title: "🛡️ AgentGuard로 이 이미지 검사", contexts: ["image"] },
  { id: "ag-sel", title: "🛡️ AgentGuard로 선택한 텍스트 검사", contexts: ["selection"] },
  { id: "ag-page", title: "🛡️ AgentGuard로 이 페이지 검사", contexts: ["page"] }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    MENUS.forEach((m) => chrome.contextMenus.create(m));
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === "ag-link") return runScan(tab.id, "url", { url: info.linkUrl });
  if (info.menuItemId === "ag-image") return runScan(tab.id, "url", { url: info.srcUrl });
  if (info.menuItemId === "ag-sel") return runScan(tab.id, "text", { text: info.selectionText, source: "선택 텍스트" });
  if (info.menuItemId === "ag-page") {
    // 페이지 본문은 content script 가 수집(문서 접근) → content 에 지시
    chrome.tabs.sendMessage(tab.id, { type: "AG_SCAN_PAGE" });
  }
});

// ── 다운로드 가로채기 ──
chrome.downloads.onCreated.addListener(async (item) => {
  const url = item.finalUrl || item.url || "";
  if (!/^https?:/i.test(url)) return;
  try {
    const v = await scanApi("/v1/scan/url", { url });
    if (v && (v.overall === "red" || v.overall === "yellow")) {
      notify(v, url);
      // 활성 탭에도 카드 전달
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: "AG_RESULT", verdict: v });
    }
  } catch (e) { /* 백엔드 없으면 조용히 무시 */ }
});

function notify(v, url) {
  const icon = v.overall === "red" ? "🛑" : "⚠️";
  const c = v.card || {};
  chrome.notifications.create({
    type: "basic",
    iconUrl: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#1E5BFF"/><text x="32" y="44" font-size="34" text-anchor="middle">🛡️</text></svg>'),
    title: icon + " " + (c.headline || "위험한 다운로드일 수 있어요"),
    message: (c.action || "열기 전에 확인하세요") + "\n" + url.slice(0, 80),
    priority: 2
  });
}

// ── 검사 실행 → content 로 결과 ──
async function runScan(tabId, kind, payload) {
  try {
    chrome.tabs.sendMessage(tabId, { type: "AG_BUSY", kind });
    let v;
    if (kind === "url") v = await scanApi("/v1/scan/url", { url: payload.url });
    else v = await scanApi("/v1/scan/text", { text: payload.text || "", source: payload.source || "선택" });
    chrome.tabs.sendMessage(tabId, { type: "AG_RESULT", verdict: v });
  } catch (e) {
    chrome.tabs.sendMessage(tabId, { type: "AG_ERROR", error: String(e && e.message || e) });
  }
}

async function callApi(path, body) {
  const c = await getCfg();
  const r = await fetch(c.apiBase.replace(/\/$/, "") + path, {
    method: "POST", headers: aiHeaders(c), body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

// ── Ollama 직결 통역 — 백엔드가 원격이라 사용자 로컬 Ollama 에 못 닿을 때,
//    확장이 직접 로컬 Ollama 로 통역 카드를 보강한다(익스텐션 단독 온디바이스).
//    원문이 아니라 '위험 메타(findings)'만 전달 — 비유출 원칙은 로컬에서도 지킨다.
function isLocalUrl(u) { return /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(u || ""); }

async function ollamaInterpret(c, v) {
  try {
    if (!v || c.provider !== "ollama" || !c.ollamaModel) return v;
    const oURL = (c.ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
    // 로컬 백엔드를 쓰면 서버가 이미 Ollama 로 통역함 — 원격 백엔드일 때만 직결 보강
    if (!isLocalUrl(oURL) || isLocalUrl(c.apiBase)) return v;
    const meta = (v.findings || []).slice(0, 8)
      .map((f) => ({ rule: f.rule_id, sev: f.severity, what: f.what }));
    if (!meta.length) return v;
    const sys = "너는 보안 통역사다. 아래 '위험 메타' 목록만 근거로, 컴퓨터를 모르는 사람에게 " +
      "쉬운 한국어로 설명하라. 과장 금지, 목록에 없는 사실 금지, 각 항목 1~2문장. " +
      '반드시 JSON 하나만 출력: {"headline":"한 줄 요약","hidden":"무엇이 숨어있나",' +
      '"how":"어떻게 작동하나","impact":"내 기기에 무슨 피해","action":"지금 할 일(짧게)"}';
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(oURL + "/api/chat", {
      method: "POST", signal: ctl.signal,
      body: JSON.stringify({
        model: c.ollamaModel, stream: false, think: false, format: "json",
        options: { temperature: 0 },
        messages: [{ role: "system", content: sys },
                   { role: "user", content: JSON.stringify(meta) }]
      })
    });
    clearTimeout(tm);
    if (!r.ok) return v;
    const d = await r.json();
    const txt = (d.message && d.message.content) || "";
    const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
    if (s < 0 || e <= s) return v;
    const j = JSON.parse(txt.slice(s, e + 1));
    if (j && j.headline) {
      v.card = Object.assign({}, v.card, j, { source: "ollama" });
      v.engine = "ollama";
    }
  } catch (e) { /* 직결 실패 시 규칙 카드 그대로 — 항상 결과는 나온다 */ }
  return v;
}

async function scanApi(path, body) {
  const c = await getCfg();
  const r = await fetch(c.apiBase.replace(/\/$/, "") + path, {
    method: "POST", headers: aiHeaders(c), body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return ollamaInterpret(c, await r.json());
}

// ── (B) LLM 심층 검사 계층 — 결과 캐싱(Map) + 차단 로그 ──
const inspectCache = new Map(); // textHash → result (서비스워커 생애주기 내)
const CACHE_MAX = 200;

function hashText(t) {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return h.toString(36) + ":" + t.length;
}

async function deepInspect(text, meta) {
  const key = hashText(text);
  if (inspectCache.has(key)) return Object.assign({ cached: true }, inspectCache.get(key));
  const v = await callApi("/v1/inspect", { text, kind: "auto", explain: false });
  if (inspectCache.size >= CACHE_MAX) inspectCache.delete(inspectCache.keys().next().value);
  inspectCache.set(key, v);
  await appendLog(meta || {}, v);
  return v;
}

async function appendLog(meta, v) {
  try {
    const c = await getCfg();
    const entry = {
      ts: Date.now(),
      site: meta.site || "",
      source: meta.source || "inspect",
      overall: v.overall || "unknown",
      score: v.score ?? null,
      issues: (v.issues || []).length
    };
    const log = [entry].concat(c.log || []).slice(0, 50);
    await chrome.storage.local.set({ log });
  } catch (e) { /* 로그 실패는 무시 */ }
}

// content/popup 에서 오는 요청(페이지 텍스트 검사 등)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AG_INSPECT") {
    const site = sender.tab && sender.tab.url ? new URL(sender.tab.url).hostname : "";
    deepInspect(String(msg.text || "").slice(0, 40000), { site, source: msg.source || "입력창" })
      .then(sendResponse)
      .catch((e) => sendResponse({ error: String(e && e.message || e) }));
    return true; // async sendResponse
  }
  if (msg.type === "AG_LOG_GET") {
    getCfg().then((c) => sendResponse(c.log || []));
    return true;
  }
  if (msg.type === "AG_LOG_CLEAR") {
    chrome.storage.local.set({ log: [] }).then(() => sendResponse([]));
    return true;
  }
  if (msg.type === "AG_SCAN_TEXT") {
    scanApi("/v1/scan/text", { text: msg.text, source: msg.source || "페이지" })
      .then((v) => { if (sender.tab && sender.tab.id) chrome.tabs.sendMessage(sender.tab.id, { type: "AG_RESULT", verdict: v }); })
      .catch((e) => { if (sender.tab && sender.tab.id) chrome.tabs.sendMessage(sender.tab.id, { type: "AG_ERROR", error: String(e) }); });
    return false;
  }
  if (msg.type === "AG_GET_CFG") { getCfg().then(sendResponse); return true; }
  if (msg.type === "AG_OPEN_SETTINGS") {
    // 우하단 배지 패널의 ⚙️ → 기존 설정 화면(popup.html)을 탭으로
    chrome.runtime.openOptionsPage();
    return false;
  }
});
