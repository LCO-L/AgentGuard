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
    ["/settings", "⚙️", "설정"],
  ];

  var css =
    "#ag-topnav{position:fixed;top:0;left:0;right:0;z-index:9000;height:52px;display:flex;" +
    "align-items:center;gap:12px;padding:0 14px;background:rgba(255,255,255,.9);" +
    "-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid #E8E8EA;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',system-ui,sans-serif}" +
    "#ag-topnav .agb{display:flex;align-items:center;gap:6px;font-weight:800;font-size:14px;color:#16181D;text-decoration:none;white-space:nowrap}" +
    "#ag-topnav .agb .u{color:#2563EB}" +
    "#ag-topnav .agl{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:none}" +
    "#ag-topnav .agl::-webkit-scrollbar{display:none}" +
    "#ag-topnav a.agi{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:8px;" +
    "font-size:13px;font-weight:700;color:#6B7280;text-decoration:none;white-space:nowrap;transition:.12s}" +
    "#ag-topnav a.agi:hover{color:#16181D}" +
    "#ag-topnav a.agi.on{background:#16181D;color:#fff}" +
    "#ag-topnav .agx{background:#2563EB;color:#fff;padding:7px 12px;border-radius:8px;font-size:12.5px;" +
    "font-weight:800;text-decoration:none;white-space:nowrap;box-shadow:0 4px 14px rgba(91,91,214,.35)}" +
    "#ag-topnav .agx:hover{filter:brightness(1.05)}" +
    "@media(max-width:640px){#ag-topnav .agb .t{display:none}#ag-topnav a.agi span.tx{display:none}#ag-topnav a.agi{padding:7px 9px}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

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

  // 기존 레이아웃을 밀어내지 않도록 상단 여백만 확보
  var cur = parseInt(getComputedStyle(document.body).paddingTop) || 0;
  document.body.style.paddingTop = cur + 56 + "px";
})();
