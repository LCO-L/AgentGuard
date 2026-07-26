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

// ── 온디바이스 통역 진단 ──
// 실패를 '조용히 삼키지' 않는다. 실제 이유(403/타임아웃/파싱/네트워크)를 세 곳에 남긴다:
//   ① 서비스워커 콘솔([AG] 접두어)  ② 카드 엔진 줄  ③ 팝업 상태(스토리지 lastInterpret)
const IRR = {
  ok: "온디바이스 AI 통역 완료",
  provider: "판단 엔진이 온디바이스가 아니에요",
  "no-model": "온디바이스 모델이 지정되지 않았어요 — 팝업에서 '온디바이스 실행'",
  "not-local": "Ollama 주소가 내 컴퓨터(localhost)가 아니에요",
  "no-findings": "위험 신호가 없어 통역할 내용이 없어요",
  already: "이미 AI가 통역한 결과예요",
  "server-side": "로컬 백엔드가 이미 통역했어요",
  "http-403": "Ollama가 확장의 연결을 막았어요(403 · Origin 차단)",
  timeout: "90초 안에 응답이 없었어요(모델 첫 로딩이 느릴 수 있어요)",
  network: "Ollama에 연결하지 못했어요(꺼져 있거나 주소가 달라요)",
  empty: "Ollama 응답이 비었어요",
  parse: "AI 응답에서 JSON을 찾지 못했어요"
};
let LAST_INTERPRET = null;
function agLog() { try { console.log.apply(console, ["[AG]"].concat([].slice.call(arguments))); } catch (e) {} }
function noteInterpret(o) {
  LAST_INTERPRET = Object.assign({
    ts: Date.now(),
    msg: IRR[o.reason] || (o.status ? "Ollama 오류 HTTP " + o.status : "Ollama " + o.reason)
  }, o);
  agLog("interpret", LAST_INTERPRET);
  try { chrome.storage.local.set({ lastInterpret: LAST_INTERPRET }); } catch (e) {}
}

// ── 탭 메시지 안전 전송 ──
// 확장 설치/리로드 '이전'에 열려 있던 탭에는 content script 가 없어서
// sendMessage 가 "Receiving end does not exist" 로 터진다(콘솔 노이즈 + 카드 미표시).
// 해법: 실패하면 scripting 으로 주입 후 1회 재시도. (세 스크립트 모두 중복 마운트 가드 있음)
async function sendToTab(tabId, msg) {
  try { return await chrome.tabs.sendMessage(tabId, msg); }
  catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["agscan.js", "content.js", "inputguard.js"]
      });
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch (e2) { return null; }  // chrome:// 등 주입 불가 탭 — 조용히 무시
  }
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

// ── Ollama 403(오리진 차단) 자동 우회 ──
// 확장이 로컬 Ollama(:11434)로 보내면 브라우저가 Origin: chrome-extension://… 를 붙이는데,
// Ollama 기본 설정은 그 오리진을 허용 목록에 두지 않아 403 을 낸다. 해결: 그 요청에서만
// Origin 헤더를 제거하면 Ollama 가 curl 같은 무-오리진 요청으로 보고 허용한다(설정 변경 불필요).
// MV3 declarativeNetRequest(modifyHeaders) — host_permissions(<all_urls>) 범위에서 동작.
const OLLAMA_DNR_RULE_ID = 8787;
async function ensureOllamaAccess() {
  try {
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) return;
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [OLLAMA_DNR_RULE_ID],
      addRules: [{
        id: OLLAMA_DNR_RULE_ID,
        priority: 1,
        action: { type: "modifyHeaders", requestHeaders: [{ header: "origin", operation: "remove" }] },
        condition: {
          regexFilter: "^https?://(localhost|127\\.0\\.0\\.1):11434/",
          // 서비스워커 fetch 가 "other" 로 분류되는 크롬 버전이 있어 둘 다 커버
          resourceTypes: ["xmlhttprequest", "other"]
        }
      }]
    });
  } catch (e) { /* DNR 미지원/실패 시 조용히 — 사용자가 OLLAMA_ORIGINS 로 우회 가능 */ }
}
chrome.runtime.onInstalled.addListener(ensureOllamaAccess);
ensureOllamaAccess();  // 서비스워커 기동 시에도(업그레이드·재시작 대비)

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === "ag-link") return runScan(tab.id, "url", { url: info.linkUrl });
  if (info.menuItemId === "ag-image") return runScan(tab.id, "url", { url: info.srcUrl });
  if (info.menuItemId === "ag-sel") return runScan(tab.id, "text", { text: info.selectionText, source: "선택 텍스트" });
  if (info.menuItemId === "ag-page") {
    // 페이지 본문은 content script 가 수집(문서 접근) → content 에 지시
    sendToTab(tab.id, { type: "AG_SCAN_PAGE" });
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
      if (tab && tab.id) sendToTab(tab.id, { type: "AG_RESULT", verdict: v });
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
    sendToTab(tabId, { type: "AG_BUSY", kind });
    const c = await getCfg();
    const path = kind === "url" ? "/v1/scan/url" : "/v1/scan/text";
    const body = kind === "url" ? { url: payload.url }
      : { text: payload.text || "", source: payload.source || "선택" };
    // 규칙 결과를 먼저 즉시 보여주고(빠름), 온디바이스 AI 통역이 오면 카드를 교체(느려도 무중단)
    let v = await callApi(path, body);
    sendToTab(tabId, { type: "AG_RESULT", verdict: v });
    if (c.provider === "ollama") {
      // 게이트 판단은 ollamaInterpret 안에서 전부 하고, 각 사유를 noteInterpret 로 남긴다.
      // interpretClean: 발견 0(안전)도 통역 — 안 하면 안전 카드가 영원히 '오프라인 규칙'으로 남는다.
      sendToTab(tabId, { type: "AG_INTERPRETING" });
      const v2 = await ollamaInterpret(c, v, { interpretClean: true });
      if (v2 && v2.engine === "ollama") sendToTab(tabId, { type: "AG_RESULT", verdict: v2 });
      else sendToTab(tabId, { type: "AG_INTERPRET_DONE", info: LAST_INTERPRET });
    }
  } catch (e) {
    sendToTab(tabId, { type: "AG_ERROR", error: String(e && e.message || e) });
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

// 모델 출력에서 카드 JSON 추출 — num_predict 초과로 꼬리가 잘린 JSON도 필드별로 살린다.
function parseCardJson(txt) {
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try {
      const j = JSON.parse(txt.slice(s, e + 1));
      if (j && typeof j === "object" && j.headline) return j;
    } catch (err) { /* 아래 필드별 복구로 */ }
  }
  const j = {};
  for (const k of ["headline", "hidden", "how", "impact", "action"]) {
    const m = txt.match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
    if (m) { try { j[k] = JSON.parse('"' + m[1] + '"'); } catch (e2) { j[k] = m[1]; } }
  }
  return j.headline ? j : null;
}

async function ollamaInterpret(c, v, opt) {
  opt = opt || {};
  if (!v) return v;
  // ── 게이트: 모든 '통역 안 함' 사유를 명시적으로 기록(조용한 실패 금지) ──
  if (c.provider !== "ollama") { noteInterpret({ reason: "provider", provider: c.provider }); return v; }
  if (!c.ollamaModel) { noteInterpret({ reason: "no-model" }); return v; }
  const oURL = (c.ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
  if (!isLocalUrl(oURL)) { noteInterpret({ reason: "not-local", url: oURL }); return v; }
  // 로컬 백엔드(:8000)를 쓰면 서버가 이미 Ollama 로 통역하므로, 규칙(fallback)일 때만 보강한다.
  // 원격 백엔드면 무조건 로컬 Ollama 로 통역(그래야 '오프라인 규칙'이 아니라 온디바이스 AI 판단이 뜬다).
  const src = (v.card && v.card.source) || v.engine || "";
  const backendIsLocal = isLocalUrl(c.apiBase);
  if (backendIsLocal && src && src !== "fallback" && src !== "off" && src !== "local") { noteInterpret({ reason: "server-side", src }); return v; }
  if (src === "ollama") { noteInterpret({ reason: "already" }); return v; }
  const meta = (v.findings || []).slice(0, 8)
    .map((f) => ({ rule: f.rule_id, sev: f.severity, what: f.what || f.title || f.rule_id }));
  if (!meta.length) {
    // ★ 이전 버그: 발견 0(안전 판정)이면 여기서 조용히 끝나 안전 카드가 '항상' 오프라인 규칙으로 남았다.
    //   우클릭 검사(runScan)는 안전도 통역하고, 다운로드 사전검사(scanApi)는 건너뛴다(알림도 안 띄우므로).
    if (!opt.interpretClean) { noteInterpret({ reason: "no-findings" }); return v; }
    meta.push({ rule: "CLEAN", sev: "green", what: "위험 신호가 발견되지 않음" });
  }
  const sys = "너는 보안 통역사다. 아래 '위험 메타' 목록만 근거로, 컴퓨터를 모르는 사람에게 " +
    "쉬운 한국어로 설명하라. 과장 금지, 목록에 없는 사실 금지, 각 항목 1~2문장. " +
    "목록이 '위험 신호가 발견되지 않음'뿐이면 안전하다고 안심시켜라. " +
    '반드시 JSON 하나만 출력: {"headline":"한 줄 요약","hidden":"무엇이 숨어있나",' +
    '"how":"어떻게 작동하나","impact":"내 기기에 무슨 피해","action":"지금 할 일(짧게)"}';
  // 4B CPU 콜드스타트는 카드 한 장 생성에 수십 초 걸릴 수 있다 → 넉넉히 90초.
  // keep_alive로 모델을 10분 상주시켜 다음 검사는 즉시 응답.
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 90000);
  let r;
  try {
    r = await fetch(oURL + "/api/chat", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // think:false — 팝업 검증(ollamaVerify)과 동일하게. 빠지면 thinking 프리앰블로 낭비/파싱 실패 여지.
        model: c.ollamaModel, stream: false, format: "json", think: false, keep_alive: "10m",
        // 한국어 카드 5필드는 400토큰에서 잘려 JSON 파싱이 깨질 수 있다 → 800으로 여유.
        options: { temperature: 0, num_ctx: 4096, num_predict: 800 },
        messages: [{ role: "system", content: sys },
                   { role: "user", content: JSON.stringify(meta) }]
      })
    });
  } catch (e) {
    clearTimeout(tm);
    noteInterpret({ reason: (e && e.name === "AbortError") ? "timeout" : "network", err: String(e && e.message || e) });
    return v;
  }
  clearTimeout(tm);
  if (!r.ok) {
    let bodyTxt = ""; try { bodyTxt = (await r.text()).slice(0, 200); } catch (e) {}
    noteInterpret({ reason: r.status === 403 ? "http-403" : ("http-" + r.status), status: r.status, body: bodyTxt });
    return v;
  }
  let d = null;
  try { d = await r.json(); } catch (e) {}
  const txt = (d && d.message && d.message.content) || "";
  if (!txt.trim()) { noteInterpret({ reason: "empty" }); return v; }
  const j = parseCardJson(txt);
  if (!j) { noteInterpret({ reason: "parse", sample: txt.slice(0, 160) }); return v; }
  v.card = Object.assign({}, v.card, j, { source: "ollama" });
  v.engine = "ollama";
  noteInterpret({ reason: "ok", model: c.ollamaModel });
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
    // runScan 으로 통일 — 규칙 카드 즉시 표시 → 온디바이스 통역 교체(2단계 렌더) + 실패 사유 표시
    if (sender.tab && sender.tab.id)
      runScan(sender.tab.id, "text", { text: msg.text, source: msg.source || "페이지" });
    return false;
  }
  if (msg.type === "AG_GET_CFG") { getCfg().then(sendResponse); return true; }
  if (msg.type === "AG_OPEN_SETTINGS") {
    // 우하단 배지 패널의 ⚙️ → 기존 설정 화면(popup.html)을 탭으로
    chrome.runtime.openOptionsPage();
    return false;
  }
});
