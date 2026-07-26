/* AgentGuard 익스텐션 팝업 — 지능적 설정(온디바이스/Claude/OpenRouter). */
const DEF = {
  apiBase: "https://agentguard.maeum.ai", provider: "ollama",
  ollamaUrl: "", ollamaModel: "", claudeKey: "", claudeModel: "",
  openrouterKey: "", openrouterModel: "", clientId: ""
};
const $ = (s) => document.querySelector(s);
let CFG = Object.assign({}, DEF);

function aiHeaders(c) {
  const h = { "Content-Type": "application/json" };
  if (c.clientId) h["X-AG-Client"] = c.clientId;
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
  // 설정 탭(options_ui)이나 chrome:// 페이지에서는 '현재 사이트' 개념이 없다 —
  // 확장 ID 같은 깨진 문자열 대신, 사이트별 끄기·페이지 검사 UI 를 숨긴다
  const onWebPage = !!(tab && tab.url && /^https?:/i.test(tab.url));
  if (!onWebPage) {
    const sb = document.querySelector(".sitebox"); if (sb) sb.style.display = "none";
    $("#scanBtn").style.display = "none";
  }
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

// ── 온디바이스 원클릭 실행 — 백엔드의 /v1/ai/ondevice/* 로직 재사용(설정 페이지와 동일) ──
// 핵심: 온디바이스는 '사용자 컴퓨터의 로컬 백엔드'에서 완결된다. 실행을 누르면
// localhost:8000 을 먼저 자동 감지하고, 살아 있으면 그쪽으로 전환해 실행한다.
(function () {
  const btn = $("#odBtn"), body = $("#odBody"), bar = $("#odBar"), msg = $("#odMsg"), link = $("#odLink");
  if (!btn) return;
  let poll = null;
  let userRun = false;  // 사용자가 '실행'을 눌렀을 때만 provider 자동 전환(몰래 설정 변경 금지)
  const RUNNING = ["checking", "starting", "pulling"];
  const LOCAL = "http://localhost:8000";

  function isLocalBase() { return /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(apiBase()); }
  async function probeLocal() {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1500);
      const r = await fetch(LOCAL + "/v1/health", { signal: ctl.signal });
      clearTimeout(t); return r.ok;
    } catch (e) { return false; }
  }
  function paint(d) {
    if (!d || !d.state) return;
    body.style.display = "block";
    bar.style.width = (d.progress || 0) + "%";
    msg.textContent = d.message || "";
    msg.style.color = d.state === "ready" ? "#30A46C"
      : (d.state === "error" || d.state === "no_ollama" || d.state === "blocked") ? "#E5484D" : "#1E5BFF";
    link.style.display = d.state === "no_ollama" ? "inline-block" : "none";
    btn.disabled = RUNNING.includes(d.state);
    btn.textContent = btn.disabled ? "준비 중…"
      : (d.state === "ready" ? "✓ 온디바이스 준비 완료 — 다시 실행" : "🖥️ 온디바이스 실행 — Ollama 자동 준비");
    if (d.state === "ready" && userRun) {
      CFG.provider = "ollama"; if (d.model) CFG.ollamaModel = d.model;
      paintProv(); save(); refreshStatus();
    }
    if (d.state === "blocked" || d.state === "error" || d.state === "no_ollama") {
      msg.textContent = (d.message || "자동 실행에 실패했어요") +
        (isLocalBase() ? "" : " — 온디바이스는 내 컴퓨터의 AgentGuard 백엔드에서 완결돼요 (github.com/LCO-L/AgentGuard → ./install.sh)");
    }
  }
  function startPoll() {
    if (poll) clearInterval(poll);
    poll = setInterval(async () => {
      try {
        const r = await fetch(apiBase() + "/v1/ai/ondevice/status");
        const d = await r.json(); paint(d);
        if (!RUNNING.includes(d.state)) clearInterval(poll);
      } catch (e) { clearInterval(poll); }
    }, 1200);
  }
  btn.onclick = async () => {
    userRun = true;
    body.style.display = "block"; btn.disabled = true; msg.textContent = "준비 중…"; msg.style.color = "#1E5BFF";
    // 1) 로컬 백엔드 자동 감지 — 있으면 그쪽으로 전환(온디바이스는 내 컴퓨터에서 완결)
    if (!isLocalBase() && await probeLocal()) {
      CFG.apiBase = LOCAL; $("#apiBase").value = LOCAL; save();
      msg.textContent = "내 컴퓨터의 AgentGuard 백엔드를 찾았어요 — 여기서 실행할게요";
    } else if (!isLocalBase()) {
      // 로컬 백엔드가 없음 — 원격 서버에 설치 시도하지 않고 안내
      btn.disabled = false;
      msg.style.color = "#E5484D";
      msg.textContent = "내 컴퓨터에서 AgentGuard 백엔드를 찾지 못했어요. " +
        "온디바이스는 로컬 백엔드에서 완결돼요 — 터미널에서 ./install.sh 한 줄이면 준비됩니다 (github.com/LCO-L/AgentGuard)";
      return;
    }
    // 2) 로컬 백엔드의 온디바이스 원클릭(설치→서브→모델 pull) 실행
    try {
      const r = await fetch(apiBase() + "/v1/ai/ondevice/start", { method: "POST" });
      const d = await r.json(); paint(d);
      if (d.state === "blocked") { btn.disabled = false; return; }
    } catch (e) {
      msg.textContent = "백엔드에 연결할 수 없어요"; msg.style.color = "#E5484D"; btn.disabled = false; return;
    }
    startPoll();
  };
  // 설정을 열었을 때: 로컬 백엔드가 있으면 그쪽 상태를, 없으면 현재 백엔드 상태를 이어서 표시
  (async () => {
    try {
      const base = (!isLocalBase() && await probeLocal()) ? LOCAL : apiBase();
      const r = await fetch(base + "/v1/ai/ondevice/status");
      const d = await r.json();
      if (d && d.state && d.state !== "idle") { paint(d); if (RUNNING.includes(d.state)) startPoll(); }
    } catch (e) { /* 백엔드 없으면 조용히 */ }
  })();
})();

load();
loadToggles();
