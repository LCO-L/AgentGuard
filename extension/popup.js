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

// ══════════════════════════════════════════════════════════════════
//  온디바이스 원클릭 — 어떤 환경에서도 '되는 데까지 자동', 죽은 골목 없음.
//  1) 로컬 AgentGuard 백엔드(:8000) 발견 → 풀 엔진 원클릭(설치→serve→pull)
//  2) 백엔드 없이 Ollama(:11434)만 발견 → 확장이 직결: 모델 자동 pull(REST,
//     진행률) → 1토큰 추론 검증 → provider 저장. 판단이 내 컴퓨터에서 돈다.
//  3) 둘 다 없음 → 에러가 아니라 "지금도 규칙으로 보호 중" + 공식 설치 링크.
// ══════════════════════════════════════════════════════════════════
(function () {
  const btn = $("#odBtn"), body = $("#odBody"), bar = $("#odBar"), msg = $("#odMsg"), link = $("#odLink");
  if (!btn) return;
  let poll = null;
  let userRun = false;  // 사용자가 '실행'을 눌렀을 때만 provider 자동 전환(몰래 설정 변경 금지)
  const RUNNING = ["checking", "starting", "pulling"];
  const LOCAL = "http://localhost:8000";
  const OLLAMA_DEFAULT = "http://localhost:11434";
  const MODEL_DEFAULT = "hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M";

  function ollamaUrl() { return (CFG.ollamaUrl || OLLAMA_DEFAULT).replace(/\/$/, ""); }
  function isLocalBase() { return /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(apiBase()); }
  function timed(ms) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }

  async function probeLocal() {
    try { const r = await fetch(LOCAL + "/v1/health", { signal: timed(1500) }); return r.ok; }
    catch (e) { return false; }
  }
  async function probeOllama() {
    // Ollama 직결 감지 — 설치된 모델 목록 반환(없으면 null)
    try {
      const r = await fetch(ollamaUrl() + "/api/tags", { signal: timed(1500) });
      if (!r.ok) return null;
      const d = await r.json();
      return (d.models || []).map((m) => m.name || m.model).filter(Boolean);
    } catch (e) { return null; }
  }
  function pickChatModel(models) {
    const chat = models.filter((n) => !/embed/i.test(n));
    if (!chat.length) return null;
    return chat.find((n) => /qwen3/i.test(n)) || chat.find((n) => /8b/i.test(n)) || chat[0];
  }

  function show(pct, text, color) {
    body.style.display = "block";
    bar.style.width = (pct || 0) + "%";
    msg.textContent = text || "";
    msg.style.color = color || "#1E5BFF";
  }
  function setReady(text) {
    show(100, text, "#30A46C");
    btn.disabled = false;
    btn.textContent = "✓ 온디바이스 준비 완료 — 다시 실행";
    link.style.display = "none";
  }

  // ── ② Ollama 직결 경로: 모델 확보(REST pull, NDJSON 진행률) → 추론 검증 → 저장 ──
  async function ollamaPull(model) {
    const resp = await fetch(ollamaUrl() + "/api/pull", {
      method: "POST", body: JSON.stringify({ model: model })
    });
    if (!resp.ok || !resp.body) throw new Error("pull HTTP " + resp.status);
    const reader = resp.body.getReader(); const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const ln of lines) {
        if (!ln.trim()) continue;
        try {
          const j = JSON.parse(ln);
          if (j.error) throw new Error(j.error);
          if (j.total && j.completed != null) {
            const pct = Math.min(99, Math.round(j.completed * 100 / j.total));
            show(Math.max(10, pct), model + " 다운로드 중… " + pct + "% (최초 1회)");
          } else if (j.status) show(10, j.status);
        } catch (e) { if (String(e.message || e).length > 3 && !/JSON/.test(String(e))) throw e; }
      }
    }
  }
  async function ollamaVerify(model) {
    const r = await fetch(ollamaUrl() + "/api/chat", {
      method: "POST", signal: timed(90000),
      body: JSON.stringify({ model: model, stream: false, think: false,
        messages: [{ role: "user", content: "hi" }], options: { num_predict: 1 } })
    });
    if (!r.ok) throw new Error("chat HTTP " + r.status);
    const d = await r.json();
    if (!(d.message || d.done)) throw new Error("no response");
  }
  async function runDirectOllama(models) {
    let model = pickChatModel(models);
    if (!model) {
      show(10, "채팅 모델이 없어요 — 소형 4bit 모델을 자동으로 받아올게요");
      await ollamaPull(MODEL_DEFAULT);
      model = MODEL_DEFAULT;
    } else {
      show(60, "설치된 모델 발견: " + model + " — 연결 확인 중…");
    }
    show(90, model + " 추론 확인 중…");
    await ollamaVerify(model);
    CFG.provider = "ollama"; CFG.ollamaUrl = ollamaUrl(); CFG.ollamaModel = model;
    $("#ollamaUrl").value = CFG.ollamaUrl;
    paintProv(); save();
    setReady("준비 완료! " + model + " · Ollama 직결 — 판단이 내 컴퓨터에서 이뤄져요 🖥️");
  }

  // ── ① 로컬 백엔드 경로: 서버의 원클릭 오케스트레이션(설치→serve→pull) 재사용 ──
  function paint(d) {
    if (!d || !d.state) return;
    show(d.progress || 0, d.message || "",
      d.state === "ready" ? "#30A46C"
        : (d.state === "error" || d.state === "no_ollama" || d.state === "blocked") ? "#E5484D" : "#1E5BFF");
    link.style.display = d.state === "no_ollama" ? "inline-block" : "none";
    btn.disabled = RUNNING.includes(d.state);
    btn.textContent = btn.disabled ? "준비 중…"
      : (d.state === "ready" ? "✓ 온디바이스 준비 완료 — 다시 실행" : "🖥️ 온디바이스 실행 — Ollama 자동 준비");
    if (d.state === "ready" && userRun) {
      CFG.provider = "ollama"; if (d.model) CFG.ollamaModel = d.model;
      paintProv(); save(); refreshStatus();
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
  async function runViaBackend() {
    const r = await fetch(apiBase() + "/v1/ai/ondevice/start", { method: "POST" });
    const d = await r.json(); paint(d);
    if (!["blocked"].includes(d.state)) startPoll();
    else btn.disabled = false;
  }

  // ── 원클릭 캐스케이드 ──
  btn.onclick = async () => {
    userRun = true;
    btn.disabled = true;
    show(3, "내 컴퓨터에서 실행 환경을 찾는 중…");
    try {
      // ① 로컬 AgentGuard 백엔드
      if (isLocalBase() || await probeLocal()) {
        if (!isLocalBase()) {
          CFG.apiBase = LOCAL; $("#apiBase").value = LOCAL; save();
          show(6, "내 컴퓨터의 AgentGuard 백엔드를 찾았어요 — 여기서 실행할게요");
        }
        await runViaBackend();
        return;
      }
      // ② Ollama 직결
      const models = await probeOllama();
      if (models) {
        show(8, "Ollama 발견 — 내 컴퓨터의 Ollama와 직결할게요");
        await runDirectOllama(models);
        return;
      }
      // ③ 안내(죽은 골목 아님 — 규칙 보호는 이미 켜져 있음)
      btn.disabled = false;
      link.style.display = "inline-block";
      show(0, "Ollama가 아직 없어요. 아래 '설치하기'로 공식 설치 후 이 버튼을 다시 누르면 " +
        "모델 준비→연결까지 자동으로 끝나요. 지금도 페이지·입력창은 온디바이스 규칙으로 보호 중이에요 🛡️",
        "#B45309");
    } catch (e) {
      btn.disabled = false;
      show(0, "온디바이스 준비 중 문제가 생겼어요: " + String(e && e.message || e).slice(0, 120) +
        " — 다시 눌러 재시도할 수 있어요", "#E5484D");
    }
  };

  // 설정을 열었을 때: 진행/완료 상태 이어보기(로컬 백엔드 우선, 없으면 Ollama 직결 상태)
  // CFG 가 storage 에서 로드된 '후'에 실행돼야 하므로 load() 완료 시점에 호출된다.
  window.__odInit = async () => {
    try {
      if (await probeLocal()) {
        const base = isLocalBase() ? apiBase() : LOCAL;
        const r = await fetch(base + "/v1/ai/ondevice/status");
        const d = await r.json();
        if (d && d.state && d.state !== "idle") { paint(d); if (RUNNING.includes(d.state)) startPoll(); }
        return;
      }
      // Ollama 직결로 이미 쓰고 있으면 준비 상태 표시(설정 변경 없음)
      if (CFG.provider === "ollama" && CFG.ollamaModel) {
        const models = await probeOllama();
        if (models && models.length) setReady("온디바이스 연결됨 · " + CFG.ollamaModel + " (Ollama 직결)");
      }
    } catch (e) { /* 조용히 */ }
  };
})();

load().then(() => { if (window.__odInit) window.__odInit(); });
loadToggles();
