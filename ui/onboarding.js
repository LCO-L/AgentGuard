/* AgentGuard 온보딩 투어 — 처음 온 사용자를 말풍선으로 자연스럽게 이끈다.
 *
 * 스포트라이트(대상만 밝게 + 펄스) + 말풍선(설명·다음) 으로 단계 안내.
 * 특히 '확장 프로그램 설치' 과정을 친절한 4단계 카드로.
 * 첫 방문 시 자동 시작(localStorage), 상단 '?' 버튼으로 언제든 다시 보기.
 */
(function () {
  "use strict";
  var KEY = "ag_onboarded_v1";
  var BLUE = "#2563EB";

  var STEPS = [
    { center: true, icon: "🛡️", title: "AgentGuard에 오신 걸 환영해요",
      body: "파일·링크·AI 프롬프트 속 <b>숨은 위험</b>을 찾아 누구나 아는 말로 알려드려요.<br>30초만 함께 둘러볼까요?" },
    { sel: ".tabs", title: "① 무엇이든 검사해요",
      body: "파일을 끌어다 놓거나, 텍스트·링크를 붙여넣으면 바로 검사해요." },
    { sel: ".demos", title: "② 처음이면 데모부터 ✨", pulse: true,
      body: "이 버튼들을 눌러보세요. <b>‘숨은 글자’</b> 데모는 눈에 안 보이는 명령을 꺼내서 보여줘요!" },
    { sel: '#ag-topnav a[href="/editor"]', title: "③ AI에 보내기 ‘전’ 검사",
      body: "보안 에디터는 주민번호·API키를 <b>가려주고</b>, 위험한 코드에 밑줄을 그어 수정안을 알려줘요." },
    { sel: "#ag-topnav .agx", title: "④ 브라우저에 설치하기 🧩", pulse: true, ext: true,
      body: "확장을 설치하면 <b>어느 사이트에서든 우클릭</b>으로 바로 검사할 수 있어요." },
    { center: true, icon: "🖥️", title: "핵심 — 진짜 ‘온디바이스’ AI", ondevice: true, pulse: true,
      body: "AgentGuard는 <b>당신의 기기 안에서</b> Ollama로 직접 판단해요. 서버로 원문을 보내지 않아요.<br><b>지금 한 번만 켜보세요</b> — 이게 진짜 온디바이스예요." },
    { center: true, icon: "🎉", title: "준비 끝!",
      body: "이제 무엇이든 검사해보세요.<br>이 안내는 상단 <b>?</b> 버튼으로 언제든 다시 볼 수 있어요." },
  ];

  // ── DOM ──
  var host = document.createElement("div");
  host.id = "ag-onboard";
  host.innerHTML =
    '<style>' +
    '#ag-onboard{position:fixed;inset:0;z-index:2147483200;display:none;font-family:-apple-system,BlinkMacSystemFont,"Malgun Gothic",system-ui,sans-serif}' +
    '#ag-onboard.on{display:block}' +
    '#ag-onboard .veil{position:fixed;inset:0;background:transparent;transition:background .3s, backdrop-filter .3s}' +
    '#ag-onboard .veil.blur{background:rgba(12,16,30,.42);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}' +
    '#ag-onboard .spot{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(12,16,30,.62);transition:all .3s cubic-bezier(.2,.7,.2,1);pointer-events:none;border:2.5px solid ' + BLUE + '}' +
    '#ag-onboard .spot.pulse{animation:agpulse 1.6s ease-out infinite}' +
    '@keyframes agpulse{0%{box-shadow:0 0 0 9999px rgba(12,16,30,.62),0 0 0 0 rgba(37,99,235,.5)}70%{box-shadow:0 0 0 9999px rgba(12,16,30,.62),0 0 0 14px rgba(37,99,235,0)}100%{box-shadow:0 0 0 9999px rgba(12,16,30,.62),0 0 0 0 rgba(37,99,235,0)}}' +
    '#ag-onboard .bub{position:fixed;max-width:320px;background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.32);padding:16px 17px;opacity:0;transform:translateY(6px);transition:.22s}' +
    '#ag-onboard .bub.show{opacity:1;transform:none}' +
    '#ag-onboard .bub .ic{font-size:26px;line-height:1}' +
    '#ag-onboard .bub h4{font-size:16px;font-weight:800;margin:6px 0 4px;color:#16181D}' +
    '#ag-onboard .bub p{font-size:13.5px;line-height:1.6;color:#3A3D46;word-break:keep-all}' +
    '#ag-onboard .bub b{color:' + BLUE + '}' +
    '#ag-onboard .steps{margin-top:11px;background:#F4F6FB;border-radius:10px;padding:10px 12px}' +
    '#ag-onboard .steps ol{margin:0;padding-left:18px} #ag-onboard .steps li{font-size:12px;color:#3A3D46;margin:3px 0;line-height:1.5}' +
    '#ag-onboard .dl{display:inline-flex;align-items:center;gap:6px;margin-top:9px;background:' + BLUE + ';color:#fff;border-radius:9px;padding:8px 13px;font-size:12.5px;font-weight:800;text-decoration:none}' +
    '#ag-onboard .foot{display:flex;align-items:center;justify-content:space-between;margin-top:13px}' +
    '#ag-onboard .dots{display:flex;gap:5px} #ag-onboard .dots i{width:6px;height:6px;border-radius:50%;background:#D3D9E6;display:block} #ag-onboard .dots i.on{background:' + BLUE + ';width:16px;border-radius:99px}' +
    '#ag-onboard .btns{display:flex;gap:7px}' +
    '#ag-onboard .btns button{border:0;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}' +
    '#ag-onboard .skip{background:transparent;color:#9AA0AA} #ag-onboard .next{background:#16181D;color:#fff}' +
    '</style>' +
    '<div class="veil"></div><div class="spot"></div>' +
    '<div class="bub"><div class="ic"></div><h4></h4><p></p><div class="extra"></div>' +
    '<div class="foot"><div class="dots"></div><div class="btns">' +
    '<button class="skip">건너뛰기</button><button class="next">다음</button></div></div></div>';
  document.documentElement.appendChild(host);

  var $ = function (s) { return host.querySelector(s); };
  var spot = $(".spot"), bub = $(".bub"), veil = $(".veil");
  var idx = 0;

  function extHTML() {
    return '<div class="steps"><ol>' +
      '<li>아래 <b>확장 다운로드</b>를 눌러 zip을 받아요</li>' +
      '<li>받은 zip의 <b>압축을 풀어요</b></li>' +
      '<li>주소창에 <b>chrome://extensions</b> 열고 우측 위 <b>개발자 모드</b> 켜기</li>' +
      '<li><b>‘압축해제된 확장 프로그램을 로드’</b> → 압축 푼 폴더 선택</li>' +
      '</ol></div><a class="dl" href="/extension.zip" download>⬇️ 확장 다운로드</a>';
  }

  function ondeviceHTML() {
    return '<div class="steps"><ol>' +
      '<li>버튼 하나로 Ollama가 <b>내 컴퓨터에</b> 준비돼요(4bit 소형 모델)</li>' +
      '<li>검사·판단이 <b>인터넷 없이</b> 기기 안에서 이뤄져요</li>' +
      '<li>원문·비밀값이 <b>기기 밖으로 안 나가요</b> 🔒</li>' +
      '</ol></div><a class="dl" href="/settings?ondevice=1">🖥️ 온디바이스 실행 켜기 →</a>';
  }

  function place(step) {
    var el = step.sel ? document.querySelector(step.sel) : null;
    bub.classList.remove("show");
    if (step.center || !el) {
      veil.classList.add("blur");   // 중앙(환영) 카드: 배경 딤+블러
      spot.style.width = "0"; spot.style.height = "0";
      spot.style.left = "50%"; spot.style.top = "-9999px";
      // 중앙 말풍선
      bub.style.left = "50%"; bub.style.top = "50%";
      bub.style.transform = "translate(-50%,-50%)";
      requestAnimationFrame(function () { bub.classList.add("show"); });
      return;
    }
    veil.classList.remove("blur");   // 스포트라이트 단계: 대상은 선명, 주변만 딤(box-shadow)
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(function () {
      var r = el.getBoundingClientRect();
      var pad = 6;
      spot.style.left = (r.left - pad) + "px";
      spot.style.top = (r.top - pad) + "px";
      spot.style.width = (r.width + pad * 2) + "px";
      spot.style.height = (r.height + pad * 2) + "px";
      spot.className = "spot" + (step.pulse ? " pulse" : "");
      // 말풍선: 대상 아래(공간 없으면 위)
      var bw = 320, below = r.bottom + 14;
      var left = Math.min(Math.max(12, r.left), window.innerWidth - bw - 12);
      bub.style.transform = "none";
      bub.style.left = left + "px";
      if (below + 200 < window.innerHeight) { bub.style.top = below + "px"; }
      else { bub.style.top = Math.max(12, r.top - bub.offsetHeight - 14) + "px"; }
      requestAnimationFrame(function () { bub.classList.add("show"); });
    }, 260);
  }

  function render() {
    var s = STEPS[idx];
    $(".ic").textContent = s.icon || "";
    $(".ic").style.display = s.icon ? "block" : "none";
    $(".bub h4").textContent = s.title;
    $(".bub p").innerHTML = s.body;
    $(".extra").innerHTML = s.ext ? extHTML() : (s.ondevice ? ondeviceHTML() : "");
    $(".dots").innerHTML = STEPS.map(function (_, i) {
      return '<i class="' + (i === idx ? "on" : "") + '"></i>';
    }).join("");
    $(".next").textContent = idx === STEPS.length - 1 ? "시작하기" : "다음";
    place(s);
  }

  function next() { if (idx < STEPS.length - 1) { idx++; render(); } else done(); }
  function done() {
    host.classList.remove("on");
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
  }

  $(".next").onclick = next;
  $(".skip").onclick = done;
  veil.onclick = function () { /* 배경 클릭은 무시(실수 방지) */ };
  window.addEventListener("resize", function () { if (host.classList.contains("on")) render(); });
  document.addEventListener("keydown", function (e) {
    if (!host.classList.contains("on")) return;
    if (e.key === "Escape") done();
    if (e.key === "Enter" || e.key === "ArrowRight") next();
  });

  function start() { idx = 0; host.classList.add("on"); render(); }
  window.AGOnboard = { start: start, reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} } };

  // 시작 조건: 진입할 때마다 항상 온보딩(공유 시트 자동검사 때만 제외). ?tour=1도 항상.
  var p = location.pathname.replace(/\/+$/, "") || "/";
  if ((location.search || "").indexOf("tour=1") >= 0) {
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    setTimeout(start, 500);
  } else if (p === "/" && !/[?&](url|text|title)=/.test(location.search || "")) {
    setTimeout(start, 700);
  }
})();
