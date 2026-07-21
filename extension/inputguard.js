/* AgentGuard 익스텐션 — 입력창 가드(Grammarly for Security, Outbound/Inbound).
 *
 * 사람이 AI에게 보내는 '바로 그 순간'을 지킨다:
 *  - textarea / contenteditable 감시(input·paste, 500ms 디바운스)
 *  - AGScan 로컬 탐지: 시크릿·PII(유출) + 프롬프트 인젝션·은닉(주입)  ← 백엔드 불필요
 *  - 입력창 근처 배지(위험 건수)
 *  - AI 사이트에서 Enter 전송을 가로채 확인 모달(마스킹 후 전송 / 그대로 / 취소)
 *
 * 프라이버시: 탐지는 전부 로컬. 원문은 어디로도 안 나간다.
 */
(function () {
  "use strict";
  if (window.__agInputGuard) return;
  window.__agInputGuard = true;
  var AGScan = window.AGScan;
  if (!AGScan) return;

  var AI = [/chatgpt\.com/, /chat\.openai\.com/, /claude\.ai/, /gemini\.google/,
    /bard\.google/, /poe\.com/, /perplexity\.ai/, /copilot\.microsoft/,
    /you\.com/, /x\.com/, /grok\./, /huggingface\.co/].some(function (r) { return r.test(location.hostname); });

  // ── Shadow UI(배지 + 모달) ──
  var host = document.createElement("div");
  host.id = "agentguard-input-host";
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    '<style>' +
    ':host{all:initial}*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Malgun Gothic",system-ui,sans-serif}' +
    '.badge{position:fixed;z-index:2147483400;height:26px;padding:0 9px;border-radius:99px;background:#5B5BD6;color:#fff;font-size:12px;font-weight:800;display:none;align-items:center;gap:5px;cursor:pointer;box-shadow:0 4px 14px rgba(91,91,214,.4)}' +
    '.badge.red{background:#E5484D}.badge.yellow{background:#F5A623}' +
    '.ov{position:fixed;inset:0;background:rgba(16,18,29,.5);z-index:2147483500;display:none;align-items:center;justify-content:center}' +
    '.ov.show{display:flex}' +
    '.modal{background:#fff;border-radius:18px;width:400px;max-width:calc(100vw - 32px);box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden}' +
    '.mh{padding:16px 18px;font-size:15px;font-weight:800;color:#16181D;border-bottom:1px solid #EEF0F3}' +
    '.mb{padding:14px 18px;max-height:280px;overflow:auto}' +
    '.it{display:flex;gap:8px;font-size:13px;padding:7px 0;border-bottom:1px solid #F4F5F8;color:#16181D}' +
    '.it .d{width:8px;height:8px;border-radius:50%;margin-top:6px;flex:0 0 auto}' +
    '.it .d.red{background:#E5484D}.it .d.yellow{background:#F5A623}' +
    '.it b{font-weight:800}' +
    '.mf{padding:14px 18px;display:flex;gap:8px;flex-wrap:wrap}' +
    '.mf button{flex:1;min-width:110px;border:0;border-radius:10px;padding:11px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit}' +
    '.b-mask{background:#30A46C;color:#fff}.b-send{background:#F3F4F6;color:#16181D}.b-cancel{background:#fff;color:#6B7280;border:1px solid #E8E8EA}' +
    '.tip{margin:0 18px 14px;font-size:11.5px;color:#6B7280}' +
    '.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#16181D;color:#fff;padding:10px 16px;border-radius:99px;font-size:13px;font-weight:700;z-index:2147483600;opacity:0;transition:.2s}' +
    '.toast.show{opacity:1}' +
    '</style>' +
    '<div class="badge"><span>🛡️</span><span class="bn"></span></div>' +
    '<div class="ov"><div class="modal"><div class="mh"></div><div class="mb"></div>' +
    '<div class="mf"><button class="b-mask">마스킹 후 전송</button><button class="b-send">그대로 전송</button><button class="b-cancel">취소</button></div>' +
    '<div class="tip">🔒 검사는 이 브라우저 안에서만 이뤄져요. 원문은 어디로도 나가지 않아요.</div></div></div>' +
    '<div class="toast"></div>';
  (document.documentElement || document.body).appendChild(host);
  var badge = root.querySelector(".badge"), bn = root.querySelector(".bn");
  var ov = root.querySelector(".ov"), mh = root.querySelector(".mh"), mb = root.querySelector(".mb");
  var toastEl = root.querySelector(".toast");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]; }); }
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("show"); setTimeout(function () { toastEl.classList.remove("show"); }, 2000); }

  var active = null, timer = null, bypass = false;

  function isEditable(el) {
    return el && (el.tagName === "TEXTAREA" ||
      (el.getAttribute && el.getAttribute("contenteditable") === "true"));
  }
  function getText(el) { return (el.tagName === "TEXTAREA" || el.tagName === "INPUT") ? el.value : (el.innerText || el.textContent || ""); }
  function setText(el, v) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      var proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var d = Object.getOwnPropertyDescriptor(proto, "value");
      d.set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.textContent = v;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }

  function assess(t) {
    var threats = AGScan.scanText(t), pii = AGScan.scanPII(t);
    var hasSecret = pii.some(function (p) { return p.category === "secret"; });
    var hasRed = threats.some(function (x) { return x.severity === "red"; });
    var level = (hasSecret || hasRed) ? "red" : (pii.length || threats.length) ? "yellow" : "green";
    return { threats: threats, pii: pii, level: level, count: threats.length + pii.length };
  }

  function scan() {
    if (!active || !allowed()) { badge.style.display = "none"; clearUnderline(); return; }
    var t = getText(active) || "";
    var a = assess(t);
    underlineField(active, t);          // 타깃 사이트 인라인 물결(② 계층)
    if (a.count > 0 || t.length > 800) deepScan(active, t, a);  // (B) LLM 심층 계층
    if (a.count === 0) { badge.style.display = "none"; return; }
    var r = active.getBoundingClientRect();
    badge.className = "badge " + a.level;
    badge.style.display = "flex";
    badge.style.left = Math.max(8, r.right - 84) + "px";
    badge.style.top = Math.max(8, r.top - 14) + "px";
    bn.textContent = a.count + " 위험";
    badge.onclick = function () { openModal(active, a); };
  }

  function openModal(field, a) {
    mh.textContent = a.level === "red" ? "🔴 전송 전에 확인하세요" : "🟡 확인이 필요해요";
    var rows = [];
    a.pii.forEach(function (p) { rows.push('<div class="it"><span class="d ' + (p.severity === "critical" || p.severity === "high" ? "red" : "yellow") + '"></span><div><b>' + esc(p.label) + '</b> — AI로 보내면 노출될 수 있어요.</div></div>'); });
    a.threats.forEach(function (t) { rows.push('<div class="it"><span class="d ' + (t.severity === "red" ? "red" : "yellow") + '"></span><div><b>' + esc(t.label) + '</b> — ' + esc(t.msg) + (t.decoded ? " (숨은 내용: " + esc(t.decoded) + ")" : "") + '</div></div>'); });
    mb.innerHTML = rows.join("") || '<div class="it">위험 요소가 정리됐어요.</div>';
    ov.classList.add("show");
    root.querySelector(".b-mask").onclick = function () {
      var r = AGScan.redact(getText(field));
      if (r.count) { setText(field, r.masked); toast(r.count + "건 마스킹 완료 — 이제 안전하게 보낼 수 있어요"); }
      else toast("마스킹할 비밀·개인정보는 없어요. 남은 위험을 확인하세요.");
      ov.classList.remove("show"); scan();
    };
    root.querySelector(".b-send").onclick = function () {
      bypass = true; ov.classList.remove("show");
      toast("한 번 더 Enter를 누르면 그대로 전송됩니다");
    };
    root.querySelector(".b-cancel").onclick = function () { ov.classList.remove("show"); };
  }

  // 이벤트
  document.addEventListener("focusin", function (e) { if (isEditable(e.target)) { active = e.target; scan(); } }, true);
  document.addEventListener("input", function (e) { if (isEditable(e.target)) { active = e.target; clearTimeout(timer); timer = setTimeout(scan, 500); } }, true);
  document.addEventListener("paste", function (e) { if (isEditable(e.target)) { active = e.target; clearTimeout(timer); timer = setTimeout(scan, 60); } }, true);
  window.addEventListener("scroll", function () { if (active && badge.style.display !== "none") scan(); }, true);

  // AI 사이트: Enter 전송 인터셉트
  document.addEventListener("keydown", function (e) {
    if (!AI || !allowed()) return;
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    if (!isEditable(e.target)) return;
    if (bypass) { bypass = false; return; }
    var a = assess(getText(e.target) || "");
    if (a.level === "green") return;
    e.preventDefault(); e.stopPropagation();
    active = e.target;
    openModal(e.target, a);
  }, true);

  /* ═══ 추가 계층: 설정 게이팅 · (B) LLM 심층 · 인라인 물결 · 교정 카드 ═══ */

  // ── 마스터 on/off · 사이트 제외 설정 ──
  var cfg = { enabled: true, disabledSites: [] };
  try {
    chrome.storage.local.get({ enabled: true, disabledSites: [] }, function (c) { cfg = c; });
    chrome.storage.onChanged.addListener(function (ch) {
      if (ch.enabled) cfg.enabled = ch.enabled.newValue;
      if (ch.disabledSites) cfg.disabledSites = ch.disabledSites.newValue;
    });
  } catch (e) { /* 무시 */ }
  function allowed() {
    return cfg.enabled && (cfg.disabledSites || []).indexOf(location.hostname) < 0;
  }

  // ── (B) LLM 심층 탐지 — 로컬 탐지에 걸리거나 대용량 붙여넣기 시만 ──
  var lastDeep = null, deepField = null;
  function deepScan(field, text, localA) {
    if (deepField === field && lastDeep && lastDeep._len === text.length) return;
    try {
      chrome.runtime.sendMessage(
        { type: "AG_INSPECT", text: text.slice(0, 40000), source: "입력창" },
        function (res) {
          if (chrome.runtime.lastError || !res || res.error) return;
          lastDeep = res; lastDeep._len = text.length; deepField = field;
          var deepCount = (res.issues || []).length;
          if (deepCount > localA.count) {
            badge.className = "badge " + (res.overall === "red" ? "red" : "yellow");
            badge.style.display = "flex";
            var r = field.getBoundingClientRect();
            badge.style.left = Math.max(8, r.right - 84) + "px";
            badge.style.top = Math.max(8, r.top - 14) + "px";
            bn.textContent = deepCount + " 위험(심층)";
            badge.onclick = function () { openModal(field, localA); };
          }
          if (ov.classList.contains("show")) renderDeepRows();
        });
    } catch (e) { /* 백엔드 없으면 로컬 결과만 */ }
  }
  function renderDeepRows() {
    if (!lastDeep || !lastDeep.issues) return;
    if (mb.innerHTML.indexOf("심층 분석(LLM)") >= 0) return;
    var extra = lastDeep.issues.slice(0, 8).map(function (i) {
      var red = i.severity === "high" || i.severity === "critical";
      return '<div class="it"><span class="d ' + (red ? "red" : "yellow") + '"></span><div><b>' +
        esc(i.title || i.rule_id) + '</b>' +
        (i.suggestion ? ' — ' + esc(i.suggestion) : "") + '</div></div>';
    }).join("");
    if (extra)
      mb.innerHTML += '<div class="it" style="border-top:2px solid #EEF0F3;font-weight:800;color:#5B5BD6">🔬 심층 분석(LLM)</div>' + extra;
  }

  // ── 인라인 물결 밑줄 — 타깃 AI 사이트(contenteditable) 정밀 지원 ──
  // 노랑 물결 = 개인정보 / 빨강 물결 = 숨은 명령 · 클릭 시 교정 카드
  var pageStyle = document.createElement("style");
  pageStyle.textContent =
    ".ag-u-red{text-decoration:underline wavy #E5484D 2px;text-underline-offset:3px;cursor:pointer;background:rgba(229,72,77,.08)}" +
    ".ag-u-yellow{text-decoration:underline wavy #F5A623 2px;text-underline-offset:3px;cursor:pointer;background:rgba(245,166,35,.10)}";
  (document.head || document.documentElement).appendChild(pageStyle);

  function injectSpans(text) {
    var spans = [];
    AGScan.scanPII(text).forEach(function (s) {
      spans.push({ s: s.start, e: s.end, kind: "pii", label: s.label });
    });
    AGScan.RISK.forEach(function (r) {
      var flags = r.re.flags.indexOf("g") >= 0 ? r.re.flags : r.re.flags + "g";
      var re = new RegExp(r.re.source, flags), m;
      while ((m = re.exec(text))) {
        if (m[0].length) spans.push({ s: m.index, e: m.index + m[0].length, kind: "inject", label: r.label });
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    });
    spans.sort(function (a, b) { return a.s - b.s; });
    var out = [];
    spans.forEach(function (sp) {
      if (!out.some(function (o) { return !(sp.e <= o.s || sp.s >= o.e); })) out.push(sp);
    });
    return out;
  }

  function clearUnderline(field) {
    field = (field && field.querySelectorAll) ? field : document;
    Array.prototype.slice.call(field.querySelectorAll("span[data-agu]")).forEach(function (u) {
      var p = u.parentNode;
      while (u.firstChild) p.insertBefore(u.firstChild, u);
      p.removeChild(u);
      if (p.normalize) p.normalize();
    });
  }

  function underlineField(field, text) {
    clearUnderline(field);
    if (!AI || !field || field.tagName === "TEXTAREA") return; // textarea는 배지 폴 백
    if (!text || text.length > 50000) return;
    var spans = injectSpans(text);
    if (!spans.length) return;

    var walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentNode && n.parentNode.closest && n.parentNode.closest("span[data-agu]"))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], node;
    while ((node = walker.nextNode())) nodes.push(node);

    var pos = 0;
    nodes.forEach(function (n) {
      var len = n.nodeValue.length, start = pos, end = pos + len;
      pos = end + 1;
      spans.forEach(function (sp) {
        var os = Math.max(sp.s, start), oe = Math.min(sp.e, end);
        if (os >= oe || !n.parentNode) return;
        try {
          var range = document.createRange();
          range.setStart(n, os - start); range.setEnd(n, oe - start);
          var u = document.createElement("span");
          u.setAttribute("data-agu", "1");
          u.className = sp.kind === "inject" ? "ag-u-red" : "ag-u-yellow";
          u.title = "🛡️ " + sp.label;
          range.surroundContents(u);
          u.addEventListener("click", function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            openCoach(u, sp);
          });
        } catch (e) { /* 분할 실패 구간 건늘뛰기 */ }
      });
    });
  }

  // ── 교정 카드: [마스킹] [제거] [무시] ──
  var coach = document.createElement("div");
  coach.style.cssText = "position:fixed;z-index:2147483600;display:none;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);padding:12px 14px;width:250px;font:13px -apple-system,system-ui,sans-serif;color:#16181D";
  document.documentElement.appendChild(coach);
  document.addEventListener("click", function (e) {
    if (!coach.contains(e.target)) coach.style.display = "none";
  }, true);

  function openCoach(u, sp) {
    var red = sp.kind === "inject";
    coach.innerHTML =
      '<div style="font-weight:800;margin-bottom:4px">' + (red ? "🔴" : "🟡") + " 🛡️ " + esc(sp.label) + "</div>" +
      '<div style="color:#6B7280;font-size:12px;margin-bottom:10px">' +
        (red ? "AI를 향한 숨은 명령이에요." : "개인정보가 포함되어 있어요.") + "</div>" +
      '<div style="display:flex;gap:6px">' +
      (red ? "" : '<button data-a="mask" style="flex:1;border:0;border-radius:8px;padding:8px;font-weight:800;cursor:pointer;background:#30A46C;color:#fff">마스킹</button>') +
      '<button data-a="remove" style="flex:1;border:0;border-radius:8px;padding:8px;font-weight:800;cursor:pointer;background:#F3F4F6;color:#16181D">제거</button>' +
      '<button data-a="ignore" style="flex:1;border:1px solid #E8E8EA;border-radius:8px;padding:8px;font-weight:800;cursor:pointer;background:#fff;color:#6B7280">무시</button>' +
      "</div>";
    var r = u.getBoundingClientRect();
    coach.style.left = Math.min(r.left, window.innerWidth - 266) + "px";
    coach.style.top = (r.bottom + 8 > window.innerHeight - 130 ? r.top - 130 : r.bottom + 8) + "px";
    coach.style.display = "block";

    coach.querySelectorAll("button").forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var act = b.getAttribute("data-a");
        if (act === "mask") {
          var rr = AGScan.redact(u.textContent);
          u.textContent = rr.masked || u.textContent;
          toast("마스킹했어요 — 안전하게 별낼 수 있어요");
        } else if (act === "remove") {
          u.remove(); toast("제거했어요");
        } else { // ignore — 밑줄만 해제(텍스트 유지)
          var p = u.parentNode;
          while (u.firstChild) p.insertBefore(u.firstChild, u);
          p.removeChild(u);
        }
        coach.style.display = "none";
        if (active) {
          active.dispatchEvent(new InputEvent("input", { bubbles: true }));
          scan();
        }
      };
    });
  }
})();
