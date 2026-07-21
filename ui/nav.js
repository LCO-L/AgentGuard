/* AgentGuard 통합 상단 네비게이션 — 모든 페이지 공용(한 줄 <script src="/nav.js"> 로 주입).
 *
 * 순수 HTML 산출물들(검사·에디터·비교·시나리오·설정 + 확장 설치)을 하나로 잇는다.
 * fixed 상단 바 + body padding 자동 확보 → 각 페이지의 기존 레이아웃을 건드리지 않는다.
 */
(function () {
  "use strict";
  if (document.getElementById("ag-topnav")) return;

  var path = (location.pathname.replace(/\/+$/, "") || "/");
  var LINKS = [
    ["/", "🔍", "검사"],
    ["/editor", "✍️", "에디터"],
    ["/compare", "⚖️", "비교"],
    ["/scenarios", "🧩", "시나리오"],
    ["/audit", "📋", "감사"],
    ["/settings", "⚙️", "설정"],
  ];

  var css =
    "#ag-topnav{position:fixed;top:0;left:0;right:0;z-index:9000;height:52px;display:flex;" +
    "align-items:center;gap:12px;padding:0 14px;background:rgba(255,255,255,.9);" +
    "-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid #E8E8EA;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',system-ui,sans-serif}" +
    "#ag-topnav .agb{display:flex;align-items:center;gap:6px;font-weight:800;font-size:14px;color:#16181D;text-decoration:none;white-space:nowrap}" +
    "#ag-topnav .agb .u{color:#1E5BFF}" +
    "#ag-topnav .agl{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:none}" +
    "#ag-topnav .agl::-webkit-scrollbar{display:none}" +
    "#ag-topnav a.agi{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:8px;" +
    "font-size:13px;font-weight:700;color:#6B7280;text-decoration:none;white-space:nowrap;transition:.12s}" +
    "#ag-topnav a.agi:hover{color:#16181D}" +
    "#ag-topnav a.agi.on{background:#16181D;color:#fff}" +
    "#ag-topnav .agx{background:#1E5BFF;color:#fff;padding:7px 12px;border-radius:8px;font-size:12.5px;" +
    "font-weight:800;text-decoration:none;white-space:nowrap;box-shadow:0 4px 14px rgba(30,91,255,.35)}" +
    "#ag-topnav .agx:hover{filter:brightness(1.05)}" +
    "#ag-help-fab{position:fixed;right:22px;bottom:96px;z-index:2147483647;width:46px;height:46px;" +
    "border-radius:50%;border:0;background:#16181D;color:#fff;font-size:20px;font-weight:800;cursor:pointer;" +
    "font-family:inherit;display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 8px 24px rgba(14,17,22,.28);transition:transform .16s cubic-bezier(.2,.7,.2,1),box-shadow .16s}" +
    "#ag-help-fab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(14,17,22,.36)}" +
    "#ag-help-fab:active{transform:translateY(0)}" +
    "@media(max-width:640px){#ag-topnav .agb .t{display:none}#ag-topnav a.agi span.tx{display:none}#ag-topnav a.agi{padding:7px 9px}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  // 파비콘(모든 페이지 공통) — 새 브랜드 로고(방패+투구)
  if (!document.querySelector('link[rel="icon"]')) {
    var fav = document.createElement("link");
    fav.rel = "icon";
    fav.type = "image/svg+xml";
    fav.href = "/icon.svg";
    document.head.appendChild(fav);
  }

  // PWA/모바일 메타 — 모든 페이지에서 '홈 화면에 설치' + 앱처럼 표시(중복 가드)
  function agMeta(sel, make) { if (!document.querySelector(sel)) document.head.appendChild(make()); }
  agMeta('link[rel="manifest"]', function () { var l = document.createElement("link"); l.rel = "manifest"; l.href = "/manifest.webmanifest"; return l; });
  agMeta('meta[name="theme-color"]', function () { var m = document.createElement("meta"); m.name = "theme-color"; m.content = "#1E5BFF"; return m; });
  agMeta('meta[name="apple-mobile-web-app-capable"]', function () { var m = document.createElement("meta"); m.name = "apple-mobile-web-app-capable"; m.content = "yes"; return m; });
  agMeta('meta[name="apple-mobile-web-app-status-bar-style"]', function () { var m = document.createElement("meta"); m.name = "apple-mobile-web-app-status-bar-style"; m.content = "default"; return m; });
  agMeta('meta[name="apple-mobile-web-app-title"]', function () { var m = document.createElement("meta"); m.name = "apple-mobile-web-app-title"; m.content = "AgentGuard"; return m; });
  agMeta('link[rel="apple-touch-icon"]', function () { var l = document.createElement("link"); l.rel = "apple-touch-icon"; l.href = "/icon.svg"; return l; });

  var items = LINKS.map(function (l) {
    var on = (l[0] === "/" ? path === "/" : path.indexOf(l[0]) === 0);
    return '<a class="agi' + (on ? " on" : "") + '" href="' + l[0] + '">' +
      l[1] + ' <span class="tx">' + l[2] + "</span></a>";
  }).join("");

  var nav = document.createElement("nav");
  nav.id = "ag-topnav";
  nav.innerHTML =
    '<a class="agb" href="/">🛡️ <span class="t">AgentGuard <span class="u">ULTRA</span></span></a>' +
    '<div class="agl">' + items + "</div>" +
    '<a class="agx" href="/extension.zip" download title="크롬 확장 프로그램(zip) 다운로드 → 압축해제 후 로드">🧩 확장 설치</a>';
  document.body.insertBefore(nav, document.body.firstChild);

  // 항상 떠 있는 '?' 도움말 플로팅 버튼(우하단) → 온보딩 투어(있으면 즉시, 없으면 홈에서 시작)
  if (!document.getElementById("ag-help-fab")) {
    var fab = document.createElement("button");
    fab.id = "ag-help-fab";
    fab.type = "button";
    fab.textContent = "?";
    fab.title = "사용법 보기";
    fab.setAttribute("aria-label", "사용법 보기");
    fab.onclick = function () {
      if (window.AGOnboard && typeof window.AGOnboard.start === "function") {
        window.AGOnboard.start();
      } else {
        location.href = "/?tour=1";
      }
    };
    document.body.appendChild(fab);
  }

  // 기존 레이아웃을 밀어내지 않도록 상단 여백만 확보
  var cur = parseInt(getComputedStyle(document.body).paddingTop) || 0;
  document.body.style.paddingTop = cur + 56 + "px";
})();
