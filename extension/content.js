/* AgentGuard 익스텐션 — content script.
 *
 * 1) 실시간 인라인 하이라이트: 페이지의 숨은 명령·닮은꼴·보이지 않는 글자에
 *    빨간 밑줄 + 호버 미니카드(AGScan, 온디바이스·백엔드 불필요).
 * 2) 우하단 플로팅 배지(발견 개수).
 * 3) 우클릭/다운로드 검사 결과(background) → 화면 오버레이 통역 카드.
 */
(function () {
  "use strict";
  if (window.__agMounted) return;
  window.__agMounted = true;
  var AGScan = window.AGScan;

  // ── Shadow DOM UI(배지 + 카드 + 툴팁) ──
  var host = document.createElement("div");
  host.id = "agentguard-ext-host";
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Malgun Gothic",system-ui,sans-serif}' +
    '.badge{position:fixed;right:20px;bottom:20px;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#1E5BFF,#3D7BFF);color:#fff;border:0;cursor:pointer;box-shadow:0 8px 24px rgba(30,91,255,.42);font-size:24px;display:flex;align-items:center;justify-content:center;z-index:2147483000}' +
    '.badge .n{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;background:#E5484D;color:#fff;border-radius:99px;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center;border:2px solid #fff}' +
    '.panel{position:fixed;right:20px;bottom:86px;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 130px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(20,24,29,.30);z-index:2147483000;display:none}' +
    '.panel.show{display:block}' +
    '.bar{display:flex;align-items:center;justify-content:space-between;padding:11px 15px;border-bottom:1px solid #EEF0F3;font-size:12px;font-weight:700}' +
    '.bar .x{border:0;background:transparent;font-size:18px;cursor:pointer;color:#6B7280}' +
    '.bar .cog{border:1px solid #E8E8EA;background:#fff;border-radius:99px;padding:3px 10px;' +
    'font-size:11px;font-weight:700;color:#6B7280;cursor:pointer;white-space:nowrap;font-family:inherit}' +
    '.bar .cog:hover{color:#16181D;border-color:#C9CDD4}' +
    '.lv{padding:3px 9px;border-radius:99px;font-size:11px}' +
    '.lv.red{background:rgba(229,72,77,.12);color:#E5484D}.lv.yellow{background:rgba(255,178,36,.16);color:#B45309}.lv.green{background:rgba(48,164,108,.12);color:#30A46C}' +
    '.top{padding:14px 16px 8px;display:flex;gap:11px}' +
    '.dot{width:40px;height:40px;border-radius:11px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:20px}' +
    '.dot.red{background:rgba(229,72,77,.12)}.dot.yellow{background:rgba(255,178,36,.16)}.dot.green{background:rgba(48,164,108,.12)}' +
    '.hl{font-size:16px;font-weight:800;letter-spacing:-.02em;color:#16181D}' +
    '.sbar{height:6px;border-radius:99px;background:#EEF0F3;margin:2px 16px 0;overflow:hidden}.sbar i{display:block;height:100%}' +
    '.stx{font-size:11px;color:#6B7280;padding:2px 16px 0;font-weight:700}' +
    '.rows{padding:6px 16px 4px}.r{padding:9px 0;border-top:1px solid #EEF0F3}.r .k{font-size:11px;color:#6B7280;font-weight:700}.r .v{font-size:13.5px;color:#16181D;margin-top:1px}' +
    '.act{margin:6px 16px 10px;border-radius:12px;padding:11px;font-size:14px;font-weight:800}' +
    '.act.red{background:#FCECEC;color:#E5484D}.act.yellow{background:#FFF7E8;color:#B45309}.act.green{background:#EEF9F2;color:#30A46C}' +
    '.eng{font-size:11px;color:#1E5BFF;padding:0 16px 12px;font-weight:700}' +
    '.msg{padding:16px;font-size:13.5px;color:#16181D;line-height:1.6}' +
    '.tip{position:fixed;z-index:2147483600;max-width:280px;background:#16181D;color:#fff;border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.5;box-shadow:0 10px 30px rgba(0,0,0,.32);display:none}' +
    '.tip.show{display:block}.tip .tt{font-weight:800;margin-bottom:3px;color:#FF8A8D}.tip .dec{margin-top:6px;background:#23262F;border-radius:7px;padding:6px 8px;font-family:monospace;color:#9EE6C0;word-break:break-all}' +
    '</style>' +
    '<button class="badge"><svg viewBox="0 0 512 512" width="30" height="30" aria-hidden="true" style="display:block"><g fill="#fff"><path d="M256 120 C206 128 176 168 184 216 L212 210 C207 176 228 150 256 145 C284 150 305 176 300 210 L328 216 C336 168 306 128 256 120 Z"/><path fill-rule="evenodd" d="M196 206 C196 196 214 190 256 190 C298 190 316 196 316 206 L316 268 C316 312 292 346 256 362 C220 346 196 312 196 268 Z M242 232 L270 232 L265 264 L259 320 L256 332 L253 320 L247 264 Z"/></g><circle cx="230" cy="250" r="9" fill="#22D3EE"/><circle cx="282" cy="250" r="9" fill="#22D3EE"/></svg><span class="n"></span></button>' +
    '<div class="panel"></div><div class="tip"></div>';
  (document.documentElement || document.body).appendChild(host);

  var badge = root.querySelector(".badge"), nEl = root.querySelector(".n");
  var panel = root.querySelector(".panel"), tip = root.querySelector(".tip");

  // 호스트 하이라이트 스타일
  var hs = document.createElement("style");
  hs.textContent = "mark.ag-hl{background:transparent;color:inherit;border-bottom:2px solid #E5484D;cursor:help}" +
    "mark.ag-hl.ag-yellow{border-bottom-color:#FFB224}" +
    "mark.ag-hl.ag-invisible{background:rgba(229,72,77,.16);border-bottom:2px solid #E5484D;padding:0 3px;border-radius:4px}" +
    "mark.ag-hl.ag-invisible::after{content:'⚠';font-size:11px}";
  (document.head || document.documentElement).appendChild(hs);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]; }); }
  var LV = { red: "위험", yellow: "주의", green: "안전" }, DOT = { red: "🛑", yellow: "⚠️", green: "✅" }, COL = { red: "#E5484D", yellow: "#FFB224", green: "#30A46C" };
  // 패널 우측 버튼 묶음: ⚙️ 설정(기존 설정 화면을 탭으로) + × 닫기
  var BTNS = '<span style="display:flex;gap:6px;align-items:center"><button class="cog" title="엔진·서버 설정 열기">⚙️ 설정</button><button class="x">×</button></span>';
  var ENG = { ollama: "🖥️ 온디바이스 Ollama", claude: "☁️ Claude", openrouter: "☁️ OpenRouter", fallback: "⚙️ 오프라인 규칙", off: "⚙️ 오프라인 규칙", local: "⚙️ 오프라인 규칙" };

  function openPanel() { panel.classList.add("show"); }
  function closePanel() { panel.classList.remove("show"); }
  badge.addEventListener("click", function () { panel.classList.contains("show") ? closePanel() : (_lastVerdict ? showCard(_lastVerdict) : showSummary()); });

  var _lastVerdict = null;
  function showBusy(kind) { openPanel(); panel.innerHTML = '<div class="bar"><span>🛡️ AgentGuard</span>' + BTNS + '</div><div class="msg"><b>검사 중…</b> 기기 안에서 살펴보는 중이에요</div>'; bindClose(); }
  function showError(e) { openPanel(); panel.innerHTML = '<div class="bar"><span>🛡️ AgentGuard</span>' + BTNS + '</div><div class="msg"><b>검사 서버에 연결하지 못했어요.</b><br>⚙️ 버튼(또는 확장 아이콘)을 눌러 <b>백엔드 주소</b>를 확인하세요 — 기본값은 <code>agentguard.maeum.ai</code>, 로컬 실행 시 <code>localhost:8000</code>으로 바꾸면 돼요.<br><br><span style="opacity:.55;font-size:11px">' + esc(e) + '</span></div>'; bindClose(); }
  function showSummary() {
    openPanel();
    var msg = _pageHits ? ("이 페이지에서 숨은 위험 신호 <b>" + _pageHits + "곳</b>을 찾아 빨간 밑줄로 표시했어요. 밑줄에 마우스를 올려 보세요.") : "이 페이지에서는 특별한 숨은 위험이 보이지 않아요. 링크나 파일을 우클릭해 검사할 수도 있어요.";
    panel.innerHTML = '<div class="bar"><span>🛡️ AgentGuard</span>' + BTNS + '</div><div class="msg">' + msg + '</div>'; bindClose();
  }
  function bindClose() {
    var x = panel.querySelector(".x"); if (x) x.onclick = closePanel;
    var g = panel.querySelector(".cog");
    if (g) g.onclick = function () { try { chrome.runtime.sendMessage({ type: "AG_OPEN_SETTINGS" }); } catch (e) { } };
  }

  function showCard(v) {
    _lastVerdict = v; openPanel();
    var c = v.card || {}, o = v.overall || "green", sc = v.score || 0;
    var rows = [["무엇이 숨어 있나", c.hidden], ["어떻게 작동하나", c.how], ["내 기기에 무슨 피해", c.impact]]
      .filter(function (r) { return r[1]; })
      .map(function (r) { return '<div class="r"><div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div></div>'; }).join("");
    var eng = ENG[v.engine] || ENG[(c.source || "fallback")] || "⚙️ 오프라인 규칙";
    panel.innerHTML =
      '<div class="bar"><span>검사한 것 · <b>' + esc(v.surface_kind || "") + '</b></span><span style="display:flex;gap:8px;align-items:center"><span class="lv ' + o + '">' + LV[o] + '</span><button class="cog" title="엔진·서버 설정 열기">⚙️ 설정</button><button class="x">×</button></span></div>' +
      '<div class="top"><div class="dot ' + o + '">' + DOT[o] + '</div><div class="hl">' + esc(c.headline || "") + '</div></div>' +
      '<div class="sbar"><i style="width:' + sc + '%;background:' + COL[o] + '"></i></div><div class="stx">위험 점수 ' + sc + ' / 100</div>' +
      '<div class="rows">' + rows + '</div>' +
      (c.action ? '<div class="act ' + o + '">' + esc(c.action) + '</div>' : "") +
      '<div class="eng">🔒 기기 안에서 검사 · 판단: ' + eng + '</div>';
    bindClose();
    if (o === "red" || o === "yellow") { nEl.style.display = "flex"; nEl.textContent = "!"; }
  }

  // ── 실시간 인라인 하이라이트 ──
  var ZW = /[​‌‍⁠﻿᠎‎‏]/, TAG = /[\u{E0000}-\u{E007F}]/u;
  var _pageHits = 0;
  function showTip(rect, findings) {
    var f = findings[0];
    var dec = findings.filter(function (x) { return x.decoded; }).map(function (x) { return x.decoded; })[0];
    tip.innerHTML = '<div class="tt">🛡️ ' + esc(f.label) + '</div>' + esc(f.msg) + (dec ? '<div class="dec">숨은 내용: ' + esc(dec) + '</div>' : "");
    tip.classList.add("show");
    var x = Math.min(rect.left, window.innerWidth - 292), y = rect.bottom + 8;
    if (y > window.innerHeight - 120) y = rect.top - tip.offsetHeight - 8;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = y + "px";
  }
  function hideTip() { tip.classList.remove("show"); }

  function highlightPage() {
    if (!AGScan || !document.body) return 0;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var tag = (p.nodeName || "").toLowerCase();
        if (tag === "script" || tag === "style" || tag === "noscript" || tag === "textarea") return NodeFilter.FILTER_REJECT;
        if (p.closest && (p.closest("#agentguard-ext-host") || p.closest("mark.ag-hl"))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [], node, guard = 0;
    while ((node = walker.nextNode()) && guard < 6000) { targets.push(node); guard++; }
    var hits = 0;
    targets.forEach(function (n) {
      var f = AGScan.scanText(n.nodeValue);
      if (!f.length) return;
      hits++;
      var m = document.createElement("mark");
      m.className = "ag-hl" + (AGScan.worst(f) === "yellow" ? " ag-yellow" : "");
      if (ZW.test(n.nodeValue) || TAG.test(n.nodeValue)) m.className += " ag-invisible";
      n.parentNode.replaceChild(m, n); m.appendChild(n);
      m.addEventListener("mouseenter", function () { showTip(m.getBoundingClientRect(), f); });
      m.addEventListener("mouseleave", hideTip);
    });
    _pageHits = hits;
    if (hits) { nEl.style.display = "flex"; nEl.textContent = hits; }
    return hits;
  }

  // 페이지 로드 후 자동 스캔 — 마스터 on/off·사이트 제외 설정 존중
  function gatedRun() {
    try {
      chrome.storage.local.get({ enabled: true, disabledSites: [] }, function (c) {
        if (!c.enabled) return;
        if ((c.disabledSites || []).indexOf(location.hostname) >= 0) return;
        try { highlightPage(); } catch (e) { }
      });
    } catch (e) { try { highlightPage(); } catch (e2) { } }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(gatedRun, 400); });
  else setTimeout(gatedRun, 400);

  // ── background 메시지 ──
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === "AG_BUSY") showBusy(msg.kind);
    else if (msg.type === "AG_RESULT") showCard(msg.verdict);
    else if (msg.type === "AG_ERROR") showError(msg.error);
    else if (msg.type === "AG_SCAN_PAGE") {
      var text = (document.body ? document.body.innerText : "").slice(0, 40000);
      chrome.runtime.sendMessage({ type: "AG_SCAN_TEXT", text: text, source: "현재 페이지" });
      showBusy("page");
    } else if (msg.type === "AG_HIGHLIGHT") {
      var n = highlightPage();
      showSummary();
    }
  });
})();
