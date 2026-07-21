/* AgentGuard 보안 도우미 위젯 — 채널톡/Intercom Fin 스타일.
 * 아무 사이트에 <script src=".../widget.js"></script> 한 줄로 임베드.
 * Shadow DOM 으로 호스트 페이지 CSS 와 격리. 온디바이스 우선(헤더로 provider/키 주입).
 *
 * 설정: window.AGENTGUARD_CONFIG = {
 *   apiBase:"http://localhost:8000",  // 백엔드 주소
 *   provider:"auto"|"ollama"|"claude"|"openrouter"|"off",
 *   apiKey:"", model:"", ollamaUrl:"",
 *   greeting:"..." }
 *
 * 공개 API: window.AgentGuard.open() / .close() / .scanText(t) / .scanUrl(u)
 *           / .scanFile(File) / .ingest(verdict)  // 외부(익스텐션)에서 결과 주입
 */
(function () {
  "use strict";
  if (window.AgentGuard && window.AgentGuard.__mounted) return;

  var CFG = Object.assign({
    apiBase: "", provider: "auto", apiKey: "", model: "", ollamaUrl: "",
    greeting: "안녕하세요! 저는 AgentGuard 보안 도우미예요. 링크·파일·문구가 안전한지 검사하고 쉬운 말로 설명해 드려요. 무엇을 확인해 드릴까요?"
  }, window.AGENTGUARD_CONFIG || {});

  var LV = { red: "위험", yellow: "주의", green: "안전" };
  var DOT = { red: "🛑", yellow: "⚠️", green: "✅" };
  var COL = { red: "#E5484D", yellow: "#FFB224", green: "#30A46C" };
  var ENGINE = {
    ollama: "🖥️ 온디바이스 Ollama", claude: "☁️ Claude", openrouter: "☁️ OpenRouter",
    fallback: "⚙️ 오프라인 규칙", off: "⚙️ 오프라인 규칙", local: "⚙️ 오프라인 규칙"
  };

  var lastVerdict = null;
  var history = [];   // 대화 이력

  // ── 스타일(Shadow DOM 내부) ──
  var CSS = `
  :host{ all: initial; }
  *{ box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Malgun Gothic",system-ui,sans-serif; }
  .launcher{ position:fixed; right:22px; bottom:22px; width:60px; height:60px; border-radius:50%;
    background:linear-gradient(135deg,#2563EB,#3B82F6); color:#fff; border:0; cursor:pointer;
    box-shadow:0 8px 26px rgba(37,99,235,.42); font-size:26px; z-index:2147483000;
    display:flex; align-items:center; justify-content:center; transition:transform .15s; }
  .launcher:hover{ transform:scale(1.06); }
  .launcher .badge{ position:absolute; top:-3px; right:-3px; min-width:20px; height:20px; padding:0 5px;
    background:#E5484D; color:#fff; border-radius:99px; font-size:11px; font-weight:800;
    display:none; align-items:center; justify-content:center; border:2px solid #fff; }
  .panel{ position:fixed; right:22px; bottom:94px; width:380px; max-width:calc(100vw - 32px);
    height:600px; max-height:calc(100vh - 130px); background:#fff; border-radius:20px;
    box-shadow:0 18px 60px rgba(20,24,29,.28); z-index:2147483000; overflow:hidden;
    display:none; flex-direction:column; opacity:0; transform:translateY(12px); transition:.22s; }
  .panel.show{ display:flex; opacity:1; transform:none; }
  .hd{ background:linear-gradient(135deg,#2563EB,#3B82F6); color:#fff; padding:16px 18px;
    display:flex; align-items:center; gap:10px; }
  .hd .av{ width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.22);
    display:flex; align-items:center; justify-content:center; font-size:18px; }
  .hd .t b{ font-size:15px; font-weight:800; display:block; }
  .hd .t span{ font-size:11.5px; opacity:.9; }
  .hd .cog{ margin-left:auto; background:transparent; border:0; color:#fff; font-size:16px; cursor:pointer; opacity:.85; }
  .hd .x{ background:transparent; border:0; color:#fff; font-size:20px; cursor:pointer; opacity:.85; }
  .msgs{ flex:1; overflow-y:auto; padding:16px; background:#F4F5F8; display:flex; flex-direction:column; gap:10px; }
  .m{ max-width:86%; font-size:14px; line-height:1.55; padding:10px 13px; border-radius:14px; white-space:pre-wrap; word-break:keep-all; }
  .m.bot{ background:#fff; color:#16181D; align-self:flex-start; border-bottom-left-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .m.user{ background:#2563EB; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }
  .m.typing{ color:#6B7280; font-style:italic; }
  /* 카드 */
  .card{ align-self:stretch; max-width:100%; background:#fff; border:1px solid #E8E8EA; border-radius:16px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,.06); }
  .card .bar{ display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #EEF0F3; font-size:12px; font-weight:700; }
  .card .lv{ padding:3px 9px; border-radius:99px; font-size:11px; }
  .lv.red{ background:rgba(229,72,77,.12); color:#E5484D; } .lv.yellow{ background:rgba(255,178,36,.16); color:#B45309; } .lv.green{ background:rgba(48,164,108,.12); color:#30A46C; }
  .card .top{ padding:13px 15px 8px; display:flex; gap:11px; }
  .card .dot{ width:38px; height:38px; border-radius:11px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; font-size:19px; }
  .dot.red{ background:rgba(229,72,77,.12);} .dot.yellow{ background:rgba(255,178,36,.16);} .dot.green{ background:rgba(48,164,108,.12);}
  .card .hl{ font-size:15.5px; font-weight:800; letter-spacing:-.02em; }
  .sbar{ height:6px; border-radius:99px; background:#EEF0F3; margin:2px 15px 0; overflow:hidden; }
  .sbar i{ display:block; height:100%; }
  .stx{ font-size:11px; color:#6B7280; padding:2px 15px 0; font-weight:700; }
  .rows{ padding:6px 15px 4px; }
  .r{ display:flex; gap:9px; padding:9px 0; border-top:1px solid #EEF0F3; }
  .r .k{ font-size:11px; color:#6B7280; font-weight:700; }
  .r .v{ font-size:13.5px; margin-top:1px; }
  .act{ margin:6px 15px 12px; border-radius:12px; padding:11px; font-size:14px; font-weight:800; }
  .act.red{ background:#FCECEC; color:#E5484D; } .act.yellow{ background:#FFF7E8; color:#B45309; } .act.green{ background:#EEF9F2; color:#30A46C; }
  .eng{ font-size:11px; color:#2563EB; padding:0 15px 10px; font-weight:700; }
  /* 빠른 액션 */
  .quick{ display:flex; gap:6px; flex-wrap:wrap; padding:0 16px 8px; background:#F4F5F8; }
  .quick button{ border:1px solid #E1E3EA; background:#fff; border-radius:99px; padding:6px 11px; font-size:12px; font-weight:700; cursor:pointer; color:#16181D; }
  /* 입력 */
  .inbar{ display:flex; align-items:center; gap:8px; padding:11px 12px; border-top:1px solid #E8E8EA; background:#fff; }
  .inbar .att{ background:#F4F5F8; border:0; width:38px; height:38px; border-radius:10px; cursor:pointer; font-size:17px; flex:0 0 auto; }
  .inbar input{ flex:1; border:1px solid #E1E3EA; border-radius:11px; padding:10px 12px; font-size:14px; outline:none; }
  .inbar .send{ background:#2563EB; border:0; color:#fff; width:40px; height:40px; border-radius:11px; cursor:pointer; font-size:16px; flex:0 0 auto; }
  .foot{ text-align:center; font-size:10.5px; color:#9AA0AA; padding:0 0 8px; background:#fff; }
  /* Grammarly식 호버 툴팁 */
  .ag-tip{ position:fixed; z-index:2147483600; max-width:280px; background:#16181D; color:#fff;
    border-radius:12px; padding:11px 13px; font-size:12.5px; line-height:1.5; box-shadow:0 10px 30px rgba(0,0,0,.32);
    display:none; word-break:keep-all; }
  .ag-tip.show{ display:block; }
  .ag-tip .tt{ font-weight:800; margin-bottom:3px; display:flex; align-items:center; gap:6px; }
  .ag-tip .tt.red{ color:#FF8A8D; } .ag-tip .tt.yellow{ color:#FFCF6B; }
  .ag-tip .decoded{ margin-top:6px; background:#23262F; border-radius:7px; padding:6px 8px; font-family:monospace; color:#9EE6C0; word-break:break-all; }
  .ag-tip .hint{ margin-top:7px; color:#A6ADC8; font-size:11px; }
  `;

  // 호스트 페이지에 주입할 하이라이트 스타일(<mark>는 호스트 DOM에 들어감)
  var HOST_HL_CSS = `
  mark.ag-hl{ background:transparent; color:inherit; border-bottom:2px solid #E5484D;
    cursor:help; padding:0; border-radius:0; }
  mark.ag-hl.ag-yellow{ border-bottom-color:#FFB224; }
  mark.ag-hl.ag-invisible{ background:rgba(229,72,77,.16); border-bottom:2px solid #E5484D;
    padding:0 3px; border-radius:4px; font-style:normal; }
  mark.ag-hl.ag-invisible::after{ content:"⚠"; font-size:11px; }
  `;

  // ── DOM 생성 ──
  var host = document.createElement("div");
  host.id = "agentguard-widget-host";
  var root = host.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  var launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.innerHTML = '<svg viewBox="0 0 512 512" width="34" height="34" aria-hidden="true" style="display:block">' +
    '<g fill="#fff"><path d="M256 120 C206 128 176 168 184 216 L212 210 C207 176 228 150 256 145 C284 150 305 176 300 210 L328 216 C336 168 306 128 256 120 Z"/>' +
    '<path fill-rule="evenodd" d="M196 206 C196 196 214 190 256 190 C298 190 316 196 316 206 L316 268 C316 312 292 346 256 362 C220 346 196 312 196 268 Z M242 232 L270 232 L265 264 L259 320 L256 332 L253 320 L247 264 Z"/></g>' +
    '<circle cx="230" cy="250" r="9" fill="#22D3EE"/><circle cx="282" cy="250" r="9" fill="#22D3EE"/></svg>' +
    '<span class="badge" id="ag-badge"></span>';

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="hd">
      <div class="av"><svg viewBox="0 0 512 512" width="22" height="22" aria-hidden="true" style="display:block"><g fill="#fff"><path d="M256 120 C206 128 176 168 184 216 L212 210 C207 176 228 150 256 145 C284 150 305 176 300 210 L328 216 C336 168 306 128 256 120 Z"/><path fill-rule="evenodd" d="M196 206 C196 196 214 190 256 190 C298 190 316 196 316 206 L316 268 C316 312 292 346 256 362 C220 346 196 312 196 268 Z M242 232 L270 232 L265 264 L259 320 L256 332 L253 320 L247 264 Z"/></g><circle cx="230" cy="250" r="9" fill="#22D3EE"/><circle cx="282" cy="250" r="9" fill="#22D3EE"/></svg></div>
      <div class="t"><b>AgentGuard</b><span>온디바이스 보안 도우미</span></div>
      <button class="cog" title="AI 엔진 설정">⚙️</button>
      <button class="x" title="닫기">×</button>
    </div>
    <div class="msgs" id="ag-msgs"></div>
    <div class="quick">
      <button data-q="이거 왜 위험해요?">왜 위험해요?</button>
      <button data-q="어떻게 대응해요?">어떻게 대응해요?</button>
      <button data-q="이 페이지 검사해줘" data-scan="page">이 페이지 검사</button>
    </div>
    <div class="inbar">
      <button class="att" title="파일 검사">📎</button>
      <input type="text" placeholder="링크·문구를 붙여넣거나 질문하세요" />
      <button class="send" title="보내기">➤</button>
    </div>
    <div class="foot">🔒 원본은 기기 안에서만 검사 · 위험 요약만 AI로</div>
  `;
  root.appendChild(launcher);
  root.appendChild(panel);

  var $ = function (s) { return root.querySelector(s); };
  var msgs = $("#ag-msgs"), input = panel.querySelector(".inbar input");
  var fileInput = document.createElement("input");
  fileInput.type = "file"; fileInput.style.display = "none";
  root.appendChild(fileInput);

  // ── 유틸 ──
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]; }); }
  function scrollBottom() { msgs.scrollTop = msgs.scrollHeight; }
  function addMsg(who, text) {
    var d = document.createElement("div");
    d.className = "m " + who; d.textContent = text;
    msgs.appendChild(d); scrollBottom(); return d;
  }
  function typing() {
    var d = document.createElement("div");
    d.className = "m bot typing"; d.textContent = "살펴보는 중…";
    msgs.appendChild(d); scrollBottom(); return d;
  }
  // 공유 설정(localStorage ag_cfg) 우선 → 없으면 임베드 CFG 폴백
  function readShared() {
    try { return JSON.parse(localStorage.getItem("ag_cfg") || "null"); } catch (e) { return null; }
  }
  function headers(extra) {
    var h = extra || {};
    var c = readShared();
    if (c && c.provider) {
      h["X-AI-Provider"] = c.provider;
      if (c.provider === "claude") { if (c.claudeKey) h["X-AI-Key"] = c.claudeKey; if (c.claudeModel) h["X-AI-Model"] = c.claudeModel; }
      else if (c.provider === "openrouter") { if (c.openrouterKey) h["X-AI-Key"] = c.openrouterKey; if (c.openrouterModel) h["X-AI-Model"] = c.openrouterModel; }
      else if (c.provider === "ollama") { if (c.ollamaModel) h["X-AI-Model"] = c.ollamaModel; }
      if (c.ollamaUrl) h["X-Ollama-Url"] = c.ollamaUrl;
    } else {
      if (CFG.provider) h["X-AI-Provider"] = CFG.provider;
      if (CFG.apiKey) h["X-AI-Key"] = CFG.apiKey;
      if (CFG.model) h["X-AI-Model"] = CFG.model;
      if (CFG.ollamaUrl) h["X-Ollama-Url"] = CFG.ollamaUrl;
    }
    return h;
  }
  function api(path) { return (CFG.apiBase || "") + path; }

  // ── 카드 렌더(메시지로) ──
  function addCard(v) {
    lastVerdict = v;
    var c = v.card || {}, o = v.overall || "green", sc = v.score || 0;
    var rows = [
      ["무엇이 숨어 있나", c.hidden], ["어떻게 작동하나", c.how], ["내 기기에 무슨 피해", c.impact]
    ].filter(function (r) { return r[1]; }).map(function (r) {
      return '<div class="r"><div><div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div></div></div>';
    }).join("");
    var eng = ENGINE[v.engine] || ENGINE[(c.source || "fallback")] || "⚙️ 오프라인 규칙";
    var card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
      '<div class="bar"><span>검사한 것 · <b>' + esc(v.surface_kind || "") + '</b></span><span class="lv ' + o + '">' + LV[o] + '</span></div>' +
      '<div class="top"><div class="dot ' + o + '">' + DOT[o] + '</div><div class="hl">' + esc(c.headline || "") + '</div></div>' +
      '<div class="sbar"><i style="width:' + sc + '%;background:' + COL[o] + '"></i></div>' +
      '<div class="stx">위험 점수 ' + sc + ' / 100</div>' +
      '<div class="rows">' + rows + '</div>' +
      (c.action ? '<div class="act ' + o + '">' + esc(c.action) + '</div>' : "") +
      '<div class="eng">판단: ' + eng + '</div>';
    msgs.appendChild(card); scrollBottom();
    updateBadge(o);
    // 후속 대화 유도
    if (o !== "green") addMsg("bot", "왜 이렇게 판단했는지, 어떻게 대응해야 하는지 물어보세요.");
  }
  function updateBadge(o) {
    var b = $("#ag-badge");
    if (o === "red" || o === "yellow") { b.style.display = "flex"; b.textContent = "!"; }
  }

  // ── 백엔드 호출 ──
  async function post(path, body, isForm) {
    var opt = { method: "POST", headers: headers(isForm ? {} : { "Content-Type": "application/json" }) };
    opt.body = isForm ? body : JSON.stringify(body);
    var r = await fetch(api(path), opt);
    if (!r.ok) { var e = await r.json().catch(function () { return {}; }); throw new Error(e.detail || ("HTTP " + r.status)); }
    return r.json();
  }
  async function scanFile(file) {
    if (!file) return;
    addMsg("user", "📄 " + file.name); var t = typing();
    try { var fd = new FormData(); fd.append("file", file); var v = await post("/v1/scan", fd, true); t.remove(); addCard(v); }
    catch (e) { t.remove(); addMsg("bot", "검사에 실패했어요: " + e.message); }
  }
  async function scanUrl(url) {
    addMsg("user", "🔗 " + url); var t = typing();
    try { var v = await post("/v1/scan/url", { url: url }); t.remove(); addCard(v); }
    catch (e) { t.remove(); addMsg("bot", "링크 검사에 실패했어요: " + e.message); }
  }
  async function scanText(text, label) {
    addMsg("user", label || ("✍️ " + (text.length > 60 ? text.slice(0, 60) + "…" : text)));
    var t = typing();
    try { var v = await post("/v1/scan/text", { text: text, source: "widget" }); t.remove(); addCard(v); }
    catch (e) { t.remove(); addMsg("bot", "검사에 실패했어요: " + e.message); }
  }
  async function ask(question) {
    history.push({ role: "user", content: question });
    var t = typing();
    try {
      var d = await post("/v1/chat", { messages: history.slice(-8), context: lastVerdict ? { verdict: lastVerdict } : null });
      t.remove(); addMsg("bot", d.reply); history.push({ role: "assistant", content: d.reply });
    } catch (e) { t.remove(); addMsg("bot", "답변 생성에 실패했어요: " + e.message); }
  }

  function looksLikeUrl(s) { return /^(https?:\/\/|www\.)\S+$/i.test(s.trim()) || /^[\w.-]+\.(com|net|org|io|kr|co|top|xyz|zip|exe)\b/i.test(s.trim()); }

  function handleUserInput(text) {
    text = text.trim(); if (!text) return;
    if (looksLikeUrl(text)) { scanUrl(text); return; }
    // 직전 검사 없고 문장이 길면(붙여넣은 의심 텍스트) 텍스트 검사, 아니면 대화
    if (!lastVerdict && text.length >= 40) { addMsg("user", text.length > 60 ? text.slice(0, 60) + "…" : text); scanTextRaw(text); return; }
    addMsg("user", text); ask(text);
  }
  async function scanTextRaw(text) {
    var t = typing();
    try { var v = await post("/v1/scan/text", { text: text, source: "widget" }); t.remove(); addCard(v); }
    catch (e) { t.remove(); addMsg("bot", "검사에 실패했어요: " + e.message); }
  }

  function scanPage() {
    var text = (document.body ? document.body.innerText : "").slice(0, 40000);
    if (!text) { addMsg("bot", "이 페이지에서 읽을 텍스트를 찾지 못했어요."); return; }
    scanText(text, "🔍 이 페이지 검사");
  }

  // ── 이벤트 ──
  function open() {
    panel.classList.add("show");
    if (!msgs.children.length) {
      addMsg("bot", CFG.greeting);
      if (_pageFindings.length) {
        addMsg("bot", "⚠️ 이 페이지에서 숨은 위험 신호 " + _pageFindings.length +
          "곳을 발견해 표시해 뒀어요. 빨간 밑줄에 마우스를 올려 보세요.");
      }
    }
    input.focus();
  }
  function close() { panel.classList.remove("show"); }
  launcher.onclick = function () { panel.classList.contains("show") ? close() : open(); };
  panel.querySelector(".x").onclick = close;
  panel.querySelector(".cog").onclick = function () { window.open((CFG.apiBase || "") + "/settings", "_blank"); };
  panel.querySelector(".att").onclick = function () { fileInput.click(); };
  fileInput.onchange = function (e) { scanFile(e.target.files[0]); e.target.value = ""; };
  panel.querySelector(".send").onclick = function () { var v = input.value; input.value = ""; handleUserInput(v); };
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") { var v = input.value; input.value = ""; handleUserInput(v); } });
  panel.querySelectorAll(".quick button").forEach(function (b) {
    b.onclick = function () {
      if (b.dataset.scan === "page") { open(); scanPage(); return; }
      open(); addMsg("user", b.dataset.q); ask(b.dataset.q);
    };
  });

  document.documentElement.appendChild(host);

  // 호스트 하이라이트 스타일 + 툴팁 요소
  if (!document.getElementById("ag-hl-style")) {
    var hs = document.createElement("style");
    hs.id = "ag-hl-style"; hs.textContent = HOST_HL_CSS;
    document.head.appendChild(hs);
  }
  var tip = document.createElement("div");
  tip.className = "ag-tip";
  root.appendChild(tip);

  // ════════════════════════════════════════════════════════
  //  Grammarly식 온디바이스 인라인 스캐너 (백엔드 불필요)
  //  페이지 텍스트에서 숨은 명령·닮은꼴·보이지 않는 글자를 형광펜으로.
  // ════════════════════════════════════════════════════════
  var ZW = /[​‌‍⁠﻿᠎‎‏]/;
  var ZW_ALL = /[​‌‍⁠﻿᠎‎‏]/g;
  var TAGCH = /[\u{E0000}-\u{E007F}]/u;
  var BIDI = /[‪-‮⁦-⁩]/;
  // 키릴/그리스 등 닮은꼴 → 라틴
  var HOMO = { "а":"a","е":"e","о":"o","р":"p","с":"c","х":"x","у":"y","і":"i","ѕ":"s","ԁ":"d","һ":"h","ј":"j","в":"b","к":"k","м":"m","н":"h","т":"t","п":"n","ο":"o","α":"a","ν":"v","ρ":"p","ε":"e","ι":"i","κ":"k","μ":"u","τ":"t","υ":"u","χ":"x" };
  var HOMO_RE = new RegExp("[" + Object.keys(HOMO).join("") + "]", "g");
  var RISK = [
    { re: /ignore\s+(all\s+|the\s+)?(previous|prior|above)\s+(instructions?|prompts?|messages?)/i, sev: "red", label: "숨은 지시", msg: "AI에게 이전 지시를 무시하라고 시켜요." },
    { re: /(disregard|forget)\s+(all|everything|previous|above)/i, sev: "red", label: "숨은 지시", msg: "기존 규칙을 잊게 만들려 해요." },
    { re: /(id_rsa|id_ed25519|\.ssh\b|\.env\b|\.aws\/credentials|\.netrc|credentials\.json)/i, sev: "red", label: "비밀 파일", msg: "비밀 키·설정 파일을 노려요." },
    { re: /(do\s+not\s+(tell|inform|notify|mention)\s+the\s+user|사용자에게\s*(말하지|알리지|보고하지)\s*마)/i, sev: "red", label: "은폐 지시", msg: "사용자에게 숨기라고 지시해요." },
    { re: /(you\s+are\s+now|from\s+now\s+on\s+you\s+are|지금부터\s*너는|개발자\s*모드|developer\s+mode|DAN\b|jailbreak)/i, sev: "yellow", label: "역할 조작", msg: "AI 역할을 바꾸려 해요." },
    { re: /<\s*important\s*>|\[SYSTEM\]|<<SYS>>/i, sev: "red", label: "위조 태그", msg: "관리자인 척하는 가짜 태그예요." },
  ];

  function decodeZeroWidth(s) {
    var seq = "";
    for (var i = 0; i < s.length; i++) { var c = s[i]; if (c === "​" || c === "‌" || c === "‍") seq += c; }
    if (seq.length < 8) return "";
    var maps = [["​", "‌"], ["‌", "‍"]];
    for (var m = 0; m < maps.length; m++) {
      var zero = maps[m][0], one = maps[m][1], bits = "";
      for (var j = 0; j < seq.length; j++) { if (seq[j] === zero) bits += "0"; else if (seq[j] === one) bits += "1"; }
      if (bits.length < 8) continue;
      var out = "", ok = true;
      for (var k = 0; k + 8 <= bits.length; k += 8) {
        var code = parseInt(bits.substr(k, 8), 2);
        if (code >= 32 && code <= 126) out += String.fromCharCode(code);
        else if (code === 10 || code === 9) out += " ";
        else { ok = false; break; }
      }
      out = out.trim();
      if (ok && out.length >= 3) return out;
    }
    return "";
  }
  function decodeTagChars(s) {
    var out = "";
    for (var ch of s) { var cp = ch.codePointAt(0); if (cp >= 0xE0000 && cp <= 0xE007F) { var a = cp - 0xE0000; if (a >= 0x20 && a <= 0x7E) out += String.fromCharCode(a); } }
    return out.trim();
  }
  // 텍스트 1개 → 발견 목록 [{severity,label,msg,decoded}]
  function scanText(t) {
    var found = [];
    if (!t) return found;
    if (ZW.test(t)) { var d = decodeZeroWidth(t); found.push({ severity: "red", label: "보이지 않는 글자", msg: d ? "글자 사이에 숨긴 명령을 찾았어요." : "눈에 안 보이는 특수문자가 섞여 있어요.", decoded: d }); }
    if (TAGCH.test(t)) { var dt = decodeTagChars(t); found.push({ severity: "red", label: "밀수된 명령", msg: "특수 유니코드로 숨긴 명령이에요.", decoded: dt }); }
    if (BIDI.test(t)) found.push({ severity: "yellow", label: "방향 뒤집기", msg: "글자 방향을 뒤집어 위장했어요." });
    var norm = t.replace(HOMO_RE, function (m2) { return HOMO[m2]; });
    if (norm !== t) {
      for (var r0 = 0; r0 < RISK.length; r0++) if (RISK[r0].re.test(norm)) { found.push({ severity: "red", label: "닮은꼴 위장", msg: "비슷하게 생긴 문자로 명령을 숨겼어요: " + RISK[r0].label }); break; }
    }
    for (var r = 0; r < RISK.length; r++) if (RISK[r].re.test(t) || RISK[r].re.test(norm)) found.push({ severity: RISK[r].sev, label: RISK[r].label, msg: RISK[r].msg });
    return found;
  }

  function showTip(rect, findings) {
    var f = findings[0], sev = f.severity;
    var body = findings.map(function (x) { return "• " + x.label + " — " + x.msg; }).join("<br>");
    var decoded = findings.filter(function (x) { return x.decoded; }).map(function (x) { return x.decoded; })[0];
    tip.innerHTML = '<div class="tt ' + sev + '">🛡️ AgentGuard</div>' + body +
      (decoded ? '<div class="decoded">숨은 내용: ' + esc(decoded) + '</div>' : "") +
      '<div class="hint">클릭하면 자세히 물어볼 수 있어요.</div>';
    tip.classList.add("show");
    var tw = 280, x = Math.min(rect.left, window.innerWidth - tw - 12);
    var ty = rect.bottom + 8; if (ty > window.innerHeight - 120) ty = rect.top - tip.offsetHeight - 8;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = ty + "px";
  }
  function hideTip() { tip.classList.remove("show"); }

  var _pageFindings = [];
  function highlightPage() {
    if (!document.body) return 0;
    _pageFindings = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var tag = (p.nodeName || "").toLowerCase();
        if (tag === "script" || tag === "style" || tag === "noscript" || tag === "textarea") return NodeFilter.FILTER_REJECT;
        if (p.closest && (p.closest("#agentguard-widget-host") || p.closest("mark.ag-hl"))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [], node, count = 0;
    while ((node = walker.nextNode()) && count < 5000) { targets.push(node); count++; }
    var hits = 0;
    targets.forEach(function (n) {
      var f = scanText(n.nodeValue);
      if (!f.length) return;
      hits++;
      _pageFindings.push({ text: n.nodeValue, findings: f });
      var m = document.createElement("mark");
      m.className = "ag-hl" + (f[0].severity === "yellow" ? " ag-yellow" : "");
      if (ZW.test(n.nodeValue) || TAGCH.test(n.nodeValue)) m.className += " ag-invisible";
      var parent = n.parentNode;
      parent.replaceChild(m, n);
      m.appendChild(n);
      m.addEventListener("mouseenter", function () { showTip(m.getBoundingClientRect(), f); });
      m.addEventListener("mouseleave", hideTip);
      m.addEventListener("click", function (e) {
        e.preventDefault();
        open();
        addMsg("bot", "이 부분에서 '" + f[0].label + "'을(를) 발견했어요. " + f[0].msg +
          (f[0].decoded ? " 숨은 내용: " + f[0].decoded : ""));
      });
    });
    if (hits) { var b = $("#ag-badge"); b.style.display = "flex"; b.textContent = hits; }
    return hits;
  }

  // ── 공개 API ──
  window.AgentGuard = {
    __mounted: true,
    open: open, close: close,
    scanText: function (t) { open(); scanText(t); },
    scanUrl: function (u) { open(); scanUrl(u); },
    scanFile: function (f) { open(); scanFile(f); },
    scanPage: function () { open(); scanPage(); },
    highlightPage: highlightPage,                   // Grammarly식 인라인 하이라이트
    scanTextLocal: scanText,                         // 온디바이스 경량 스캐너(백엔드 불필요)
    ingest: function (v) { open(); addCard(v); },   // 외부(익스텐션)에서 결과 주입
    config: CFG
  };

  // Grammarly식 자동 인라인 스캔(기본 on) — 페이지 로드 후 숨은 위험을 형광펜으로
  if (CFG.autoscan !== false) {
    var runHL = function () { try { highlightPage(); } catch (e) { } };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runHL);
    else setTimeout(runHL, 300);
  }
})();
