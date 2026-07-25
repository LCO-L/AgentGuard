/* © 2026 DONGHUN LEE · AgentGuard · MIT License.
 * AgentGuard 통합 상단 네비게이션 — 모든 페이지 공용(한 줄 <script src="/nav.js"> 로 주입).
 *
 * 순수 HTML 산출물들(검사·에디터·비교·시나리오·감사·설정 + 확장 설치)을 하나로 잇는다.
 * fixed 상단 바 + body padding 자동 확보 → 각 페이지의 기존 레이아웃을 건드리지 않는다.
 */
(function () {
  "use strict";
  if (document.getElementById("ag-topnav")) return;

  var path = (location.pathname.replace(/\/+$/, "") || "/");

  // 24×24 stroke 아이콘(대시보드 탭과 동일한 선 굵기·톤)
  function ic(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }
  var ICONS = {
    scan: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    editor: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    compare: ic('<path d="M12 3v18"/><path d="M5.5 7h5"/><path d="M13.5 7h5"/><path d="M5.5 12h5"/><path d="M13.5 12h5"/><path d="M5.5 17h5"/><path d="M13.5 17h5"/>'),
    scenarios: ic('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>'),
    audit: ic('<path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" transform="translate(1.5 0)"/><path d="M11 8h5" transform="translate(1.5 0)"/><path d="M11 12h5" transform="translate(1.5 0)"/><path d="M11 16h3" transform="translate(1.5 0)"/>'),
    settings: ic('<path d="M4 8h10"/><circle cx="17" cy="8" r="2.6"/><path d="M20 16H10"/><circle cx="7" cy="16" r="2.6"/>'),
    ext: ic('<path d="M4 11h3a2.5 2.5 0 1 1 5 0h3v3a2.5 2.5 0 1 0 0 5v0h-11Z" transform="translate(1 -1)"/>'),
  };
  var LINKS = [
    ["/", ICONS.scan, "검사"],
    ["/editor", ICONS.editor, "에디터"],
    ["/compare", ICONS.compare, "비교"],
    ["/scenarios", ICONS.scenarios, "시나리오"],
    ["/audit", ICONS.audit, "감사"],
    ["/settings", ICONS.settings, "설정"],
  ];

  var css =
    "#ag-topnav{position:fixed;top:0;left:0;right:0;z-index:9000;height:54px;display:flex;" +
    "align-items:center;gap:12px;padding:0 16px;background:rgba(255,255,255,.82);" +
    "-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);" +
    "border-bottom:1px solid rgba(14,17,22,.08);" +
    "font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','SF Pro Text','Segoe UI',Roboto,'Noto Sans KR','Malgun Gothic',sans-serif;" +
    "-webkit-font-smoothing:antialiased;letter-spacing:-.011em}" +
    "#ag-topnav .agb{display:flex;align-items:center;gap:7px;font-weight:700;font-size:14px;color:#101319;text-decoration:none;white-space:nowrap;letter-spacing:-.02em}" +
    "#ag-topnav .agb img{width:20px;height:20px;display:block}" +
    "#ag-topnav .agb .u{color:#1E5BFF}" +
    "#ag-topnav .agl{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:none}" +
    "#ag-topnav .agl::-webkit-scrollbar{display:none}" +
    "#ag-topnav a.agi{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;" +
    "font-size:13px;font-weight:600;color:#6A7080;text-decoration:none;white-space:nowrap;" +
    "transition:color .14s,background .14s,transform .14s cubic-bezier(.2,.7,.2,1)}" +
    "#ag-topnav a.agi svg{width:15px;height:15px;flex:0 0 auto}" +
    "#ag-topnav a.agi:hover{color:#101319;background:rgba(16,19,25,.05)}" +
    "#ag-topnav a.agi.on{background:rgba(16,19,25,.06);color:#101319;font-weight:600}" +
    "#ag-topnav .agx{display:inline-flex;align-items:center;gap:6px;background:#101319;color:#fff;" +
    "padding:8px 13px;border-radius:9px;font-size:12.5px;font-weight:600;text-decoration:none;white-space:nowrap;" +
    "box-shadow:0 1px 2px rgba(16,19,25,.2);transition:transform .14s cubic-bezier(.2,.7,.2,1),background .14s}" +
    "#ag-topnav .agx svg{width:14px;height:14px}" +
    "#ag-topnav .agx:hover{transform:translateY(-1px);background:#23262E}" +
    "#ag-topnav .agx:active{transform:translateY(0)}" +
    "#ag-help-fab{position:fixed;right:22px;bottom:150px;z-index:2147483647;width:46px;height:46px;" +
    "border-radius:50%;border:0;background:#0E1116;color:#fff;font-size:19px;font-weight:800;cursor:pointer;" +
    "font-family:inherit;display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 8px 24px rgba(14,17,22,.28);transition:transform .16s cubic-bezier(.2,.7,.2,1),box-shadow .16s}" +
    "#ag-help-fab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(14,17,22,.36)}" +
    "#ag-help-fab:active{transform:translateY(0)}" +
    "@media(max-width:640px){#ag-topnav{padding:0 12px;gap:9px}#ag-topnav .agb .t{display:none}" +
    "#ag-topnav a.agi span.tx{display:none}#ag-topnav a.agi{padding:8px 10px}" +
    "#ag-topnav .agx .tx{display:none}#ag-topnav .agx{padding:8px 10px}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  // 파비콘(모든 페이지 공통) — 브랜드 로고(방패+투구)
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
  agMeta('link[rel="apple-touch-icon"]', function () { var l = document.createElement("link"); l.rel = "apple-touch-icon"; l.href = "/logo.svg"; return l; });

  var items = LINKS.map(function (l) {
    var on = (l[0] === "/" ? path === "/" : path.indexOf(l[0]) === 0);
    return '<a class="agi' + (on ? " on" : "") + '" href="' + l[0] + '"' +
      (on ? ' aria-current="page"' : "") + ">" +
      l[1] + '<span class="tx">' + l[2] + "</span></a>";
  }).join("");

  var nav = document.createElement("nav");
  nav.id = "ag-topnav";
  nav.setAttribute("aria-label", "AgentGuard");
  nav.innerHTML =
    '<a class="agb" href="/"><img src="/icon.svg" alt=""> <span class="t">AgentGuard</span></a>' +
    '<div class="agl">' + items + "</div>" +
    '<a class="agx" href="/extension.zip" download title="크롬 확장 프로그램(zip) 다운로드 → 압축해제 후 로드">' +
    ICONS.ext + '<span class="tx">확장 설치</span></a>';
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

  // 숨은 소유권 워터마크(이스터에그) — 화면엔 안 보이지만 여러 곳에 남는다. © DONGHUN LEE
  try {
    if (!document.querySelector('meta[name="author"]')) {
      var _am = document.createElement("meta"); _am.name = "author"; _am.content = "DONGHUN LEE";
      document.head.appendChild(_am);
    }
    document.documentElement.setAttribute("data-author", "DONGHUN LEE");
    window.__AGENTGUARD_AUTHOR__ = "© 2026 DONGHUN LEE · MIT License";
    // devtools 콘솔 이스터에그(일반 화면엔 안 보임)
    console.log("%c AgentGuard %c © 2026 DONGHUN LEE · built solo. ",
      "background:#1E5BFF;color:#fff;font-weight:800;border-radius:4px 0 0 4px;padding:2px 6px",
      "background:#0E1116;color:#9AD0FF;border-radius:0 4px 4px 0;padding:2px 6px");
  } catch (e) {}

  // 기존 레이아웃을 밀어내지 않도록 상단 여백만 확보
  var cur = parseInt(getComputedStyle(document.body).paddingTop) || 0;
  document.body.style.paddingTop = cur + 58 + "px";
})();
