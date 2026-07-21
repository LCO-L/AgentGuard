/* AgentGuard 익스텐션 팝업 — 지능적 설정(온디바이스/Claude/OpenRouter). */
const DEF = {
  apiBase: "http://localhost:8000", provider: "auto",
  ollamaUrl: "", ollamaModel: "", claudeKey: "", claudeModel: "",
  openrouterKey: "", openrouterModel: ""
};
const $ = (s) => document.querySelector(s);
let CFG = Object.assign({}, DEF);

function aiHeaders(c) {
  const h = { "Content-Type": "application/json" };
  if (c.provider) h["X-AI-Provider"] = c.provider;
  if (c.provider === "claude") { if (c.claudeKey) h["X-AI-Key"] = c.claudeKey; }
  else if (c.provider === "openrouter") { if (c.openrouterKey) h["X-AI-Key"] = c.openrouterKey; }
  if (c.ollamaUrl) h["X-Ollama-Url"] = c.ollamaUrl;
  return h;
}
function apiBase() { return (CFG.apiBase || DEF.apiBase).replace(/\/$/, ""); }

function paintProv() {
  document.querySelectorAll("#prov button").forEach((b) => b.classList.toggle("on", b.dataset.p === CFG.provider));
  ["ollama", "claude", "openrouter"].forEach((p) =>
    $("#box-" + p).classList.toggle("show", CFG.provider === p));
}
function toast() { const s = $("#save"); s.classList.add("show"); setTimeout(() => s.classList.remove("show"), 1200); }
function save() { chrome.storage.local.set(CFG, toast); }

async function load() {
  CFG = Object.assign({}, DEF, await chrome.storage.local.get(DEF));
  $("#apiBase").value = CFG.apiBase; $("#ollamaUrl").value = CFG.ollamaUrl;
  $("#claudeKey").value = CFG.claudeKey; $("#openrouterKey").value = CFG.openrouterKey;
  paintProv(); refreshStatus();
}

document.querySelectorAll("#prov button").forEach((b) =>
  b.onclick = () => { CFG.provider = b.dataset.p; paintProv(); save(); });
$("#apiBase").oninput = (e) => { CFG.apiBase = e.target.value.trim(); save(); };
$("#ollamaUrl").oninput = (e) => { CFG.ollamaUrl = e.target.value.trim(); save(); };
$("#claudeKey").oninput = (e) => { CFG.claudeKey = e.target.value.trim(); save(); };
$("#openrouterKey").oninput = (e) => { CFG.openrouterKey = e.target.value.trim(); save(); };

async function refreshStatus() {
  try {
    const r = await fetch(apiBase() + "/v1/ai/status", { headers: aiHeaders(CFG) });
    const d = await r.json(); const p = d.providers || {};
    const mk = (n, ok) => `<span class="pill ${ok ? "ok" : ""}">${n} ${ok ? "●" : "○"}</span>`;
    $("#status").innerHTML = mk("Ollama", p.ollama) + mk("Claude", p.claude) + mk("OpenRouter", p.openrouter);
  } catch (e) { $("#status").innerHTML = '<span class="pill">백엔드에 연결할 수 없어요</span>'; }
}

$("#testBtn").onclick = async () => {
  const t = $("#test"); t.className = "test"; t.textContent = "테스트 중…";
  try {
    const r = await fetch(apiBase() + "/v1/ai/test", { method: "POST", headers: aiHeaders(CFG), body: "{}" });
    const d = await r.json();
    if (d.ok) { t.className = "test ok"; t.textContent = `✓ 연결됨 · ${d.latency_ms}ms · ${d.model || d.engine}`; }
    else { t.className = "test bad"; t.textContent = "✗ 연결 실패 — 키·주소·모델을 확인하세요"; }
  } catch (e) { t.className = "test bad"; t.textContent = "✗ 백엔드에 연결할 수 없어요"; }
};

$("#scanBtn").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) { chrome.tabs.sendMessage(tab.id, { type: "AG_SCAN_PAGE" }); window.close(); }
};

// ── 마스터 on/off + 사이트별 설정 + 차단 로그 ──
let CUR_HOST = "";

async function loadToggles() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { CUR_HOST = tab && tab.url ? new URL(tab.url).hostname : ""; } catch (e) { CUR_HOST = ""; }
  $("#siteName").textContent = CUR_HOST || "이 페이지";
  const c = Object.assign({ enabled: true, disabledSites: [] }, await chrome.storage.local.get(["enabled", "disabledSites"]));
  $("#masterToggle").checked = c.enabled;
  $("#siteToggle").checked = (c.disabledSites || []).includes(CUR_HOST);
}

$("#masterToggle").onchange = (e) => chrome.storage.local.set({ enabled: e.target.checked });
$("#siteToggle").onchange = async (e) => {
  const c = Object.assign({ disabledSites: [] }, await chrome.storage.local.get(["disabledSites"]));
  let list = c.disabledSites || [];
  if (e.target.checked && !list.includes(CUR_HOST)) list.push(CUR_HOST);
  if (!e.target.checked) list = list.filter((h) => h !== CUR_HOST);
  chrome.storage.local.set({ disabledSites: list });
};

function paintLog(log) {
  $("#logCount").textContent = log.length;
  $("#logList").innerHTML = log.length ? log.map((e) => {
    const d = new Date(e.ts);
    const hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return `<div class="logit"><span class="o-${e.overall}">${e.overall.toUpperCase()}</span>` +
      `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.site || e.source}</span>` +
      `<span class="t">${hh}</span></div>`;
  }).join("") : '<div class="logit">기록이 없어요</div>';
}

$("#logBox").addEventListener("toggle", (e) => {
  if (e.target.open) chrome.runtime.sendMessage({ type: "AG_LOG_GET" }, paintLog);
});
$("#logClear").onclick = () =>
  chrome.runtime.sendMessage({ type: "AG_LOG_CLEAR" }, paintLog);

load();
loadToggles();
