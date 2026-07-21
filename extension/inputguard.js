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
    if (!active) { badge.style.display = "none"; return; }
    var t = getText(active) || "";
    var a = assess(t);
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
    if (!AI) return;
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    if (!isEditable(e.target)) return;
    if (bypass) { bypass = false; return; }
    var a = assess(getText(e.target) || "");
    if (a.level === "green") return;
    e.preventDefault(); e.stopPropagation();
    active = e.target;
    openModal(e.target, a);
  }, true);
})();
