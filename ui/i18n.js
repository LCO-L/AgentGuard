/* © 2026 DONGHUN LEE · AgentGuard · MIT License. */
/* AGLang — 순수 HTML UI의 한/영 전환(i18n) 엔진.
 *
 * 방식: 마크업 무수정 "사전 기반 런타임 번역".
 *  - 원문(한국어)이 소스 오브 트루스. lang=en 이면 텍스트 노드·속성(placeholder/title/aria-label)을
 *    사전으로 치환하고, MutationObserver 로 동적 렌더(카드·코치·토스트·위젯 Shadow DOM)까지 따라간다.
 *  - 언어 상태: localStorage["ag_lang"] · URL ?lang=en|ko · 미설정 시 브라우저 언어 자동.
 *  - 규칙 기반 통역 카드(FALLBACK)의 문장도 사전에 포함 → 오프라인 데모가 영어로 나온다.
 *  - 사전에 없는 문자열(LLM 생성문·시나리오 데이터 등)은 원문 그대로 둔다(우아한 부분 번역).
 */
(function () {
  "use strict";
  var KEY = "ag_lang";

  function detect() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (q === "en" || q === "ko") { try { localStorage.setItem(KEY, q); } catch (e) {} return q; }
    } catch (e) {}
    try { var s = localStorage.getItem(KEY); if (s === "en" || s === "ko") return s; } catch (e) {}
    var n = (navigator.language || "ko").toLowerCase();
    return n.indexOf("ko") === 0 ? "ko" : "en";
  }
  var LANG = detect();

  window.AGLang = {
    get: function () { return LANG; },
    set: function (l) { try { localStorage.setItem(KEY, l); } catch (e) {} location.reload(); },
    toggle: function () { window.AGLang.set(LANG === "ko" ? "en" : "ko"); }
  };

  if (LANG !== "en") return; // 한국어 = 원문 그대로
  try { document.documentElement.lang = "en"; } catch (e) {}

  // ── 사전(정확 일치, 공백 정규화 키) ──────────────────────────
  var D = {
    // 공용/네비(nav.js)
    "검사": "Scan", "에디터": "Editor", "비교": "Compare", "시나리오": "Scenarios",
    "감사": "Audit", "설정": "Settings", "확장 설치": "Get Extension",
    "크롬 확장 프로그램(zip) 다운로드 → 압축해제 후 로드": "Download the Chrome extension (zip) → unzip → load unpacked",
    "사용법 보기": "Show me around",
    // 엔진 라벨(agconfig)
    "🖥️ 온디바이스": "🖥️ On-device", "✨ 자동": "✨ Auto", "⚙️ 오프라인 규칙": "⚙️ Offline rules",
    "온디바이스": "On-device", "오프라인 규칙": "Offline rules", "온디바이스 Ollama": "On-device Ollama",
    "온디바이스 AI": "on-device AI", "자동": "Auto",
    // 판정
    "위험": "Danger", "주의": "Caution", "안전": "Safe",

    // ── 대시보드 ──
    "AgentGuard — 온디바이스 보안 검사": "AgentGuard — On-device Security Scan",
    "숨은 위험을, 사람의 말로.": "Hidden risks, in human words.",
    "파일·링크·프롬프트 속 보이지 않는 명령과 유출을 기기 안에서 찾아냅니다.":
      "Finds invisible commands and leaks in files, links, and prompts — on your device.",
    "AI 엔진 설정": "AI engine settings",
    "파일": "File", "텍스트": "Text", "링크": "Link",
    "파일을 여기에 놓으세요": "Drop a file here",
    "HWP · DOCX · PDF · MCP · 확장 · SKILL.md · SVG · ZIP — 무엇이든": "HWP · DOCX · PDF · MCP · extension · SKILL.md · SVG · ZIP — anything",
    "검사할 텍스트를 붙여넣으세요. 보이지 않는 명령·프롬프트 인젝션까지 찾아냅니다.":
      "Paste text to scan. Catches invisible commands and prompt injection too.",
    "이 텍스트 검사": "Scan this text",
    "악성 MCP 도구": "Malicious MCP tool", "숨은 글자(스테가노)": "Hidden characters (stegano)",
    "닮은꼴 위장": "Lookalike disguise", "악성 SKILL.md": "Malicious SKILL.md", "정상 텍스트": "Clean text",
    "여기에 놓으면 바로 검사해요": "Drop it here to scan instantly",
    "HWP · DOCX · PDF · MCP · SVG · ZIP — 무엇이든": "HWP · DOCX · PDF · MCP · SVG · ZIP — anything",
    "원본은 기기 안에서만 검사합니다. AI에는 위험 요약만 전달돼요.":
      "Originals are scanned only on your device. The AI receives a risk summary only.",
    "판단 엔진은": "Pick the reasoning engine in",
    "에서 온디바이스·Claude·OpenRouter 중 고를 수 있어요.": "— on-device, Claude, or OpenRouter.",
    "검사한 것 ·": "Scanned ·",
    "무엇이 숨어 있나": "What's hiding", "어떻게 작동하나": "How it works", "내 기기에 무슨 피해": "What it can do to my device",
    "무엇이 숨어있나": "What's hiding",
    "기기 안에서 검사했어요 · 판단:": "Scanned on your device · judged by:",
    "검사 중…": "Scanning…",
    "보이지 않는 명령까지 살펴보는 중이에요": "Looking for invisible commands too",
    "를 기기 안에서 살펴보는 중이에요": "is being inspected on your device",
    "링크 분석 중…": "Analyzing the link…",
    "목적지·리다이렉트·위장 신호를 확인해요": "Checking destination, redirects, and disguise signals",
    "검사에 실패했어요": "The scan failed",
    "서버에 연결할 수 없어요": "Can't reach the server",
    "백엔드가 실행 중인지 확인한 뒤 다시 시도해 주세요.": "Make sure the backend is running, then try again.",

    // ── 에디터 ──
    "AgentGuard — 보안 에디터 (AI 전송 전 검사)": "AgentGuard — Secure Editor (pre-send scan)",
    "보안 에디터": "Secure Editor",
    "AI에 보내기 전, 위험한 부분에 밑줄을 긋고 고쳐드려요": "Before you send to an AI, risky parts get underlined and fixed",
    "프롬프트": "Prompt", "코드": "Code", "설정/문서": "Config/Doc",
    "예시": "Examples",
    "키·개인정보 붙여넣기": "Paste keys & PII", "취약한 코드": "Vulnerable code",
    "위험한 에이전트 명령": "Dangerous agent commands", "숨은 명령이 섞인 문서": "Doc with hidden commands",
    "AI에게 보낼 프롬프트·코드·설정을 여기에 붙여넣으세요. 입력을 멈추면 위험한 부분에 밑줄이 그어지고, 오른쪽에 이유와 수정안이 떠요.":
      "Paste the prompt, code, or config you're about to send to an AI. When you stop typing, risky spans get underlined, with reasons and fixes on the right.",
    "여기에 위험 요소와 수정안이": "Risks and suggested fixes will appear",
    "실시간으로 나타납니다.": "here in real time.",
    "검사 대기 중": "Waiting to scan",
    "✓ 위험 요소 없음": "✓ No risks found",
    "지금은 위험 신호가 없어요.": "No risk signals right now.",
    "안전하게 전송": "Send safely", "정리 후 전송": "Clean up & send", "위험 확인 후 전송": "Review risks & send",
    "비밀값": "Secret", "개인정보": "PII", "회사기밀": "Org secret", "취약코드": "Vulnerable code",
    "과잉권한": "Over-permission", "인젝션": "Injection", "은닉": "Concealment",
    "마스킹": "Mask", "제거": "Remove", "위치로": "Go to", "이번만 허용": "Allow once",
    "백엔드에 연결할 수 없어요": "Can't reach the backend",
    "정리할 민감정보·위험 지시가 없어요": "Nothing sensitive or risky to clean up",
    "정리 실패": "Cleanup failed",
    "검사할 내용이 없어요": "Nothing to scan",
    "검사·정화된 내용을 클립보드에 복사했어요": "Scanned & sanitized content copied to the clipboard",
    "클립보드 복사는 브라우저 권한이 필요해요": "Clipboard copy needs browser permission",

    // ── 설정 ──
    "AgentGuard — AI 엔진 설정": "AgentGuard — AI Engine Settings",
    "← 대시보드": "← Dashboard",
    "(기본)와": "(default) or", "둘 중 하나예요.": "— one of the two.",
    "는 인터넷 없이 내 컴퓨터에서,": "runs on your computer with no internet;",
    "는 Claude·OpenRouter 키로 클라우드에서 돕습니다. Ollama가 없어도 자동으로 오프라인 규칙으로 항상 작동해요.":
      "assists from the cloud with your Claude/OpenRouter key. Even without Ollama, offline rules always keep everything working.",
    "온디바이스 실행": "Run on-device",
    "버튼 하나면 Ollama가 켜지고 4bit 양자화 소형 모델(Qwen3 4B · unsloth)이 자동으로 준비돼요":
      "One button starts Ollama and auto-prepares a small 4-bit model (Qwen3 4B · unsloth)",
    "실행": "Run", "다시 실행": "Run again", "준비 중…": "Preparing…",
    "Ollama 설치하기 →": "Install Ollama →",
    "온디바이스가 어려운 환경 같아요.": "This environment seems unable to run on-device.",
    "클라우드 API": "cloud API", "로 대신 검사할까요?": "instead?",
    "API로 전환하기 →": "Switch to API →",
    "내 컴퓨터 · 기본": "Your computer · default",
    "온디바이스 (Ollama)": "On-device (Ollama)",
    "내 컴퓨터에서 실행 · 파일이 밖으로 안 나감": "Runs on your computer · files never leave",
    "확인 중…": "Checking…", "선택": "Select",
    "Ollama 주소": "Ollama address", "모델": "Model",
    "기본(Qwen3 4B · unsloth 4bit)": "Default (Qwen3 4B · unsloth 4bit)",
    "설치된 모델": "Installed models", "연결 테스트": "Test connection",
    "키 필요": "Key needed",
    "Anthropic API · 가장 정교한 통역": "Anthropic API · the most refined interpretation",
    "API 키 (브라우저에만 저장)": "API key (stored in this browser only)",
    "불러오기": "Load",
    "수백 개 모델을 한 키로 · qwen/gpt/llama 등": "Hundreds of models with one key · qwen/gpt/llama and more",
    "기본(qwen/qwen3-8b)": "Default (qwen/qwen3-8b)", "목록": "List",
    "기업 정책": "Company policy",
    "차단 모드 · 회사 전용 민감어": "Block mode · company-specific sensitive terms",
    "차단 모드": "Block mode",
    "— 위험(Critical·High)이 남으면 AI 전송을 막아요": "— blocks sending to AI while Critical/High risks remain",
    "회사 전용 민감어 (줄바꿈으로 여러 개)": "Company-specific sensitive terms (one per line)",
    "여기 적은 단어는 AI로 보내기 전에 자동으로": "Words listed here are automatically masked like",
    "처럼 마스킹돼요.": "before being sent to AI.",
    "설정은 이 브라우저에만 저장됩니다. 대시보드와 보안 위젯이 이 설정을 함께 사용해요.":
      "Settings are stored only in this browser. The dashboard and the security widget share them.",
    "기본은": "The default is",
    "예요. Ollama가 준비돼 있지 않으면 자동으로 오프라인 규칙으로 답합니다.":
      ". If Ollama isn't ready, offline rules answer automatically.",
    "저장됐어요 ✓": "Saved ✓",
    "● 연결됨": "● Connected", "○ 오프라인": "○ Offline",
    "● 키 확인됨": "● Key verified", "○ 키 필요": "○ Key needed", "○ 서버 없음": "○ No server",
    "온디바이스(Ollama)": "On-device (Ollama)",
    "가 감지됐어요. 인터넷 없이 가장 안전해요.": "detected — the safest option, no internet needed.",
    "이걸로 설정": "Use this",
    "테스트 중…": "Testing…",
    "✗ 연결 실패 (키·주소·모델 확인)": "✗ Connection failed (check key, address, model)",
    "✗ 서버에 연결할 수 없어요": "✗ Can't reach the server",
    "모델을 불러오지 못했어요": "Couldn't load models",
    "백엔드에 연결할 수 없어요": "Can't reach the backend",

    // ── 비교 ──
    "AgentGuard — 같은 위험, 다른 이해": "AgentGuard — Same Risk, Different Understanding",
    "같은 위험, 다른 이해": "Same risk, different understanding",
    "같은 것을 검사해도 기존 백신은": "Scanning the same thing, legacy antivirus returns",
    "암호 같은 이름": "a cryptic name",
    "을, AgentGuard는": "— AgentGuard returns",
    "사람의 말": "human words",
    "을 돌려줍니다.": ".",
    "검사할 파일을 여기에 놓으세요": "Drop a file to scan here",
    "HWP · DOCX · PDF · MCP · 확장 manifest — 원본은 기기 안에서만 검사해요":
      "HWP · DOCX · PDF · MCP · extension manifest — originals stay on your device",
    "파일이 없다면 데모로:": "No file handy? Try a demo:",
    "기존 백신의 말": "What legacy antivirus says",
    "AgentGuard의 말": "What AgentGuard says",
    "파일이나 데모를 넣으면 여기에 백신식 경고가 떠요": "Drop a file or run a demo to see the antivirus-style warning here",
    "파일이나 데모를 넣으면 여기에 쉬운 말 통역이 떠요": "Drop a file or run a demo to see the plain-language interpretation here",
    "…그래서 이 파일이 뭘 한다는 걸까요?": "…so what does this file actually do?",
    "기기 안에서 살펴보는 중이에요…": "Inspecting on your device…",
    "검사 실패": "Scan failed", "검사 완료": "Scan complete",

    // ── 시나리오 ──
    "AgentGuard — 탐지 시나리오": "AgentGuard — Detection Scenarios",
    "탐지 시나리오": "Detection scenarios",
    "지금 잡을 수 있는 보안 시나리오 전부입니다. 새 공격 유형은": "Every security scenario we catch today. A new attack type is",
    "데이터 한 줄": "one line of data",
    "이면 추가돼요 — 코드 수정 없이 인스펙션·에디터·익스텐션·통역이 함께 잡습니다.":
      "away — inspection, the editor, the extension, and interpretation all catch it with zero code changes.",
    "시나리오 검색 — 이름·ID·설명 (예: rm -rf, 주민번호, DAN)": "Search scenarios — name, ID, description (e.g. rm -rf, RRN, DAN)",
    "심각도": "Severity", "전체": "All", "분류": "Category",
    "＋ 확장성": "＋ Extensibility",
    "에 Scenario(...) 한 줄을 추가하면 즉시 탐지됩니다.": "— add one Scenario(...) line and it's detected immediately.",
    "불러오는 중…": "Loading…",
    "조건에 맞는 시나리오가 없어요": "No scenarios match",
    "검색어나 필터를 바꿔보세요.": "Try a different search or filter.",
    "✓ 수정안 제공": "✓ Fix provided",
    "백엔드에 연결할 수 없어요": "Can't reach the backend",
    "서버가 실행 중인지 확인해 주세요.": "Make sure the server is running.",

    // ── 감사 ──
    "AgentGuard — 감사 로그": "AgentGuard — Audit Log",
    "감사 로그": "Audit log",
    "조직의 검사 이력을 한눈에 — 언제·무엇을·어떤 위험으로 판정했는지.":
      "Your organization's scan history at a glance — when, what, and how it was judged.",
    "원문은 저장하지 않습니다.": "Originals are never stored.",
    "CSV 내보내기": "Export CSV", "새로고침": "Refresh",
    "현재 필터 기준으로 CSV 내려받기": "Download CSV with the current filter",
    "총 검사": "Total scans",
    "최근 검사 타임라인": "Recent scan timeline",
    "아직 검사 기록이 없어요. 검사를 실행하면 여기에 쌓입니다.": "No scan records yet. Run a scan and they'll pile up here.",
    "이 등급의 기록이 없어요.": "No records with this grade.",
    "서버에 연결할 수 없어요.": "Can't reach the server.",
    "시각": "Time", "유형": "Type", "등급": "Grade", "발견": "Findings", "주요 항목": "Top item",
    "위험 신호 없음": "No risk signals",
    "방금": "just now",
    "이 대시보드는 검사": "This dashboard shows only scan",
    "메타데이터": "metadata",
    "(시각·유형·등급·발견 수)만 보여줍니다. 원문·비밀값은 서버에 남지 않습니다.":
      "(time, type, grade, finding count). Originals and secrets never stay on the server.",

    // ── 위젯 ──
    "온디바이스 보안 도우미": "On-device security assistant",
    "안녕하세요! 저는 AgentGuard 보안 도우미예요. 링크·파일·문구가 안전한지 검사하고 쉬운 말로 설명해 드려요. 무엇을 확인해 드릴까요?":
      "Hi! I'm the AgentGuard security assistant. I check whether links, files, and text are safe, and explain it in plain words. What shall I check?",
    "안녕하세요! 여기 클라우드파일이네요 🛡️ 내려받기 전에 파일·링크가 안전한지 검사해 드릴게요. 링크를 붙여넣거나 '이 페이지 검사'를 눌러보세요.":
      "Hi! This is CloudFile 🛡️ Before you download, I can check whether files and links are safe. Paste a link or press 'Scan this page'.",
    "왜 위험해요?": "Why is it dangerous?", "어떻게 대응해요?": "What should I do?",
    "이 페이지 검사": "Scan this page", "이 페이지 검사해줘": "Scan this page please",
    "링크·문구를 붙여넣거나 질문하세요": "Paste a link or text, or ask a question",
    "🔒 원본은 기기 안에서만 검사 · 위험 요약만 AI로": "🔒 Originals scanned on-device only · AI sees a risk summary",
    "살펴보는 중…": "Looking into it…",
    "닫기": "Close", "파일 검사": "Scan a file", "보내기": "Send",
    "왜 이렇게 판단했는지, 어떻게 대응해야 하는지 물어보세요.": "Ask why it was judged this way and what to do about it.",
    "이 페이지에서 읽을 텍스트를 찾지 못했어요.": "Couldn't find readable text on this page.",
    "🔍 이 페이지 검사": "🔍 Scan this page",
    "🖥️ 온디바이스 Ollama": "🖥️ On-device Ollama",
    "판단:": "Judged by:",
    "클릭하면 자세히 물어볼 수 있어요.": "Click to ask for details.",
    "숨은 지시": "Hidden instruction", "비밀 파일": "Secret file", "은폐 지시": "Concealment order",
    "역할 조작": "Role manipulation", "위조 태그": "Forged tag", "보이지 않는 글자": "Invisible characters",
    "밀수된 명령": "Smuggled command", "방향 뒤집기": "Direction flip",
    "AI에게 이전 지시를 무시하라고 시켜요.": "Tells the AI to ignore its previous instructions.",
    "기존 규칙을 잊게 만들려 해요.": "Tries to make it forget existing rules.",
    "비밀 키·설정 파일을 노려요.": "Targets secret keys and config files.",
    "사용자에게 숨기라고 지시해요.": "Orders it to hide this from the user.",
    "AI 역할을 바꾸려 해요.": "Tries to change the AI's role.",
    "관리자인 척하는 가짜 태그예요.": "A fake tag pretending to be an admin.",
    "글자 사이에 숨긴 명령을 찾았어요.": "Found a command hidden between the letters.",
    "눈에 안 보이는 특수문자가 섞여 있어요.": "Invisible special characters are mixed in.",
    "특수 유니코드로 숨긴 명령이에요.": "A command hidden with special Unicode.",
    "글자 방향을 뒤집어 위장했어요.": "Disguised by flipping text direction.",

    // ── 임베드 데모(가짜 사이트) ──
    "클라우드파일 — 무료 문서 변환": "CloudFile — Free Document Conversion",
    "☁️ 클라우드파일": "☁️ CloudFile",
    "변환": "Convert", "요금제": "Pricing", "고객지원": "Support",
    "무료로 문서를 변환하세요": "Convert documents for free",
    "아래 예시 파일을 내려받아 보세요.": "Try downloading the sample files below.",
    "다운로드 링크를 우클릭": "Right-click a download link",
    "하거나, 오른쪽 아래 🛡️ 보안 도우미에게": "or ask the 🛡️ security assistant at the bottom right",
    "라고 물어보세요.": "",
    "\"이거 안전해?\"": "\"is this safe?\"",
    "다운로드": "Download", "설치하기": "Install",
    "이 페이지는 AgentGuard 위젯 임베드 데모입니다. 실제 악성 파일은 없고, 위험 신호만 흉내 냈어요.":
      "This page is an AgentGuard widget embed demo. There are no real malicious files — only imitated risk signals.",
    "실제 서비스라면 이": "On a real service, this single",
    "한 줄이 방문자를 다운로드 전에 지켜줍니다.": "line protects visitors before they download.",

    // ── 온보딩 ──
    "AgentGuard에 오신 걸 환영해요": "Welcome to AgentGuard",
    "파일·링크·AI 프롬프트 속": "It finds the",
    "숨은 위험": "hidden risks",
    "을 찾아 누구나 아는 말로 알려드려요.": "in files, links, and AI prompts, and explains them in words anyone knows.",
    "30초만 함께 둘러볼까요?": "Shall we take a 30-second tour?",
    "① 무엇이든 검사해요": "① Scan anything",
    "파일을 끌어다 놓거나, 텍스트·링크를 붙여넣으면 바로 검사해요.": "Drag a file in, or paste text/links to scan instantly.",
    "② 처음이면 데모부터": "② New? Start with demos",
    "이 버튼들을 눌러보세요.": "Try these buttons.",
    "‘숨은 글자’": "The 'hidden characters'",
    "데모는 눈에 안 보이는 명령을 꺼내서 보여줘요!": "demo pulls out commands your eyes can't see!",
    "③ AI에 보내기 ‘전’ 검사": "③ Scan *before* sending to AI",
    "보안 에디터는 주민번호·API키를": "The secure editor",
    "가려주고": "masks IDs and API keys",
    ", 위험한 코드에 밑줄을 그어 수정안을 알려줘요.": ", underlines risky code, and suggests fixes.",
    "④ 브라우저에 설치하기": "④ Install in your browser",
    "확장을 설치하면": "With the extension installed,",
    "어느 사이트에서든 우클릭": "right-click on any site",
    "으로 바로 검사할 수 있어요.": "to scan instantly.",
    "핵심 — 진짜 ‘온디바이스’ AI": "The core — genuinely on-device AI",
    "AgentGuard는": "AgentGuard judges",
    "당신의 기기 안에서": "inside your own device",
    "Ollama로 직접 판단해요. 서버로 원문을 보내지 않아요.": "with Ollama. Originals are never sent to a server.",
    "지금 한 번만 켜보세요": "Turn it on once now",
    "— 이게 진짜 온디바이스예요.": "— this is what on-device really means.",
    "준비 끝!": "All set!",
    "이제 무엇이든 검사해보세요.": "Now scan anything you like.",
    "이 안내는 상단": "You can reopen this guide anytime with the",
    "버튼으로 언제든 다시 볼 수 있어요.": "button.",
    "건너뛰기": "Skip", "다음": "Next", "시작하기": "Get started",
    "아래": "Press", "확장 다운로드": "Download extension", "를 눌러 zip을 받아요": "below to get the zip",
    "받은 zip의": "Unzip the", "압축을 풀어요": "downloaded file",
    "주소창에": "Open", "열고 우측 위": "and turn on", "개발자 모드": "Developer mode", "켜기": "(top right)",
    "‘압축해제된 확장 프로그램 폴더를 로드’": "'Load unpacked'",
    "→ 압축 푼 폴더 선택": "→ select the unzipped folder",
    "버튼 하나로 Ollama가": "One button prepares Ollama",
    "내 컴퓨터에": "on your computer",
    "준비돼요(4bit 소형 모델)": "(small 4-bit model)",
    "검사·판단이": "Scanning and judgment happen",
    "인터넷 없이": "with no internet,",
    "기기 안에서 이뤄져요": "inside the device",
    "원문·비밀값이": "Originals and secrets",
    "기기 밖으로 안 나가요": "never leave the device",
    "온디바이스 실행 켜기 →": "Turn on on-device →",

    // ── 통역 카드(오프라인 폴백, interpret.py) ──
    "특별한 위험을 찾지 못했어요.": "We found no particular risk.",
    "숨은 위험이 보이지 않아요.": "No hidden risks in sight.",
    "정상적인 구조예요.": "The structure looks normal.",
    "기기에 해를 끼칠 요소를 발견하지 못했어요.": "Nothing that could harm your device was found.",
    "그래도 출처가 의심스러우면 열지 마세요.": "Still, don't open it if the source is suspicious.",
    "위험한 숨은 명령이 발견됐어요.": "A dangerous hidden command was found.",
    "주의가 필요한 요소가 있어요.": "There's something that needs caution.",
    "파일·화면 정보가 외부로 넘어가거나, 원치 않는 프로그램이 설치될 수 있어요.":
      "Files or on-screen data could be sent outside, or unwanted programs could be installed.",
    "확인이 필요해요.": "Needs checking.",
    "열자마자 자동으로 실행되는 명령이 들어 있어요.": "It contains a command that runs automatically the moment it opens.",
    "열지 마세요. 삭제하세요.": "Don't open it. Delete it.",
    "문서 안에 자동으로 실행되는 매크로가 숨어 있어요.": "A macro that runs automatically hides inside the document.",
    "컴퓨터에 직접 명령을 내리는 코드가 있어요.": "There's code that gives commands directly to your computer.",
    "실행하지 마세요.": "Don't run it.",
    "다른 프로그램을 몰래 내려받아 설치하려 해요.": "It tries to quietly download and install another program.",
    "문서가 열릴 때 외부 명령을 자동 실행하도록 짜여 있어요.": "It's wired to auto-run external commands when the document opens.",
    "그림 파일(SVG) 안에 실행되는 스크립트가 숨어 있어요.": "A runnable script hides inside the image file (SVG).",
    "열지 마세요.": "Don't open it.",
    "낯선 인터넷 주소와 연결되어 있어요.": "It connects to an unfamiliar internet address.",
    "주소를 열지 마세요.": "Don't open the address.",
    "중요한 파일을 외부로 빼낼 정황이 있어요.": "There are signs it exfiltrates important files.",
    "즉시 삭제하세요.": "Delete it immediately.",
    "내부 네트워크를 엿보는 주소가 있어요.": "There's an address that peeks into internal networks.",
    "대화 내용이나 기기 정보를 밖으로 보내려는 지시가 있어요.": "There are instructions to send conversations or device info outside.",
    "설치·실행하지 마세요.": "Don't install or run it.",
    "숨은 명령이 AI에게 '원래 규칙을 무시하라'고 시켜요.": "A hidden command tells the AI to ignore its original rules.",
    "설치·열기를 하지 마세요.": "Don't install or open it.",
    "설명서 안에 '먼저 비밀 파일을 읽어라'는 숨은 명령이 있어요.": "The manual hides a command: 'read the secret files first.'",
    "설치하지 마세요.": "Don't install it.",
    "다른 도구를 가로채거나 사용자에게 숨기라는 지시가 있어요.": "There are instructions to hijack other tools or hide things from the user.",
    "내용을 알아보기 어렵게 일부러 꼬아 놓았어요.": "The content is deliberately obfuscated.",
    "주의가 필요해요.": "Caution needed.",
    "관리자인 척하는 가짜 명령 태그가 숨겨져 있어요.": "A fake command tag pretending to be an admin is hidden.",
    "AI에게 다른 역할을 강요하는 문구가 있어요.": "There's wording that forces a different role on the AI.",
    "눈에 보이지 않는 글자로 명령을 숨겨 놓았어요.": "Commands are hidden in invisible characters.",
    "특수 유니코드 문자로 숨긴 명령이 들어 있어요.": "It contains commands hidden with special Unicode characters.",
    "글자 방향을 뒤집어 파일 이름·내용을 위장했어요.": "File names/content are disguised by flipping text direction.",
    "비슷하게 생긴 다른 문자로 명령어를 위장했어요.": "Commands are disguised with lookalike characters.",
    "문서 안에 실행 가능한 프로그램 조각이 숨겨져 있어요.": "An executable program fragment hides inside the document.",
    "삭제하세요.": "Delete it.",
    "암호화되거나 꽉 압축된 의심스러운 덩어리가 있어요.": "There's a suspicious encrypted or tightly packed blob.",
    "문서 안에 다른 파일이 내장되어 있어요.": "Another file is embedded inside the document.",
    "압축을 풀면 엉뚱한 시스템 폴더에 파일을 심으려 해요.": "When unzipped, it tries to plant files in the wrong system folders.",
    "필요 이상으로 많은 권한을 요구해요.": "It demands more permissions than it needs.",
    "권한을 확인하세요.": "Check the permissions.",
    "설명과 실제 권한이 달라요.": "The description and the actual permissions differ.",
    "검사를 피하려고 암호로 잠겨 있어요.": "It's password-locked to evade scanning.",
    "파일 종류를 속이는 이중 확장자를 썼어요.": "It uses a double extension to fake the file type.",
    "출처를 확인하세요.": "Check the source.",
    "만든 사람이 누군지 확인할 수 없어요.": "The author can't be verified.",
    "승인한 뒤 내용이 몰래 바뀌었어요.": "The content was quietly changed after you approved it.",
    "승인을 취소하고 다시 확인하세요.": "Revoke approval and check again."
  };

  // ── 패턴 규칙(수치·조합 문자열) ──────────────────────────────
  function dl(s) { var v = D[s]; return v == null ? s : v; } // dict-or-원문
  var R = [
    [/^위험 점수 (\d+) \/ 100$/, function (m) { return "Risk score " + m[1] + " / 100"; }],
    [/^([\d,]+)자$/, function (m) { return m[1] + " chars"; }],
    [/^(\d+)건$/, function (m) { return m[1] + " items"; }],
    [/^(\d+)분 전$/, function (m) { return m[1] + " min ago"; }],
    [/^(\d+)시간 전$/, function (m) { return m[1] + " hr ago"; }],
    [/^총 (\d+)개 시나리오$/, function (m) { return m[1] + " scenarios total"; }],
    [/^(\d+) \/ (\d+)개$/, function (m) { return m[1] + " / " + m[2]; }],
    [/^✓ 연결됨 · ([\s\S]+)$/, function (m) { return "✓ Connected · " + m[1]; }],
    [/^숨은 내용: ([\s\S]+)$/, function (m) { return "Hidden content: " + m[1]; }],
    [/^판단: ([\s\S]+)$/, function (m) { return "Judged by: " + dl(m[1]); }],
    [/^기기 안에서 검사 · 판단: ([\s\S]+)$/, function (m) { return "Scanned on-device · judged by: " + dl(m[1]); }],
    [/^([\s\S]+) · (위험|주의|안전)$/, function (m) { return dl(m[1]) + " · " + dl(m[2]); }],
    [/^검사에 실패했어요: ([\s\S]+)$/, function (m) { return "Scan failed: " + dl(m[1]); }],
    [/^링크 검사에 실패했어요: ([\s\S]+)$/, function (m) { return "Link scan failed: " + dl(m[1]); }],
    [/^답변 생성에 실패했어요: ([\s\S]+)$/, function (m) { return "Couldn't generate a reply: " + dl(m[1]); }],
    [/^🚫 차단 모드: 위험 (\d+)건이 남아 전송이 차단됐어요$/, function (m) { return "🚫 Block mode: sending blocked — " + m[1] + " risk(s) remain"; }],
    [/^(?:민감정보 (\d+)건 마스킹)?(?: · )?(?:위험 지시 (\d+)건 제거)? 완료$/, function (m) {
      var p = [];
      if (m[1]) p.push("masked " + m[1] + " sensitive item(s)");
      if (m[2]) p.push("removed " + m[2] + " risky instruction(s)");
      return p.length ? (p.join(" · ") + " — done") : null;
    }],
    [/^• ([\s\S]+?) — ([\s\S]+)$/, function (m) { return "• " + dl(m[1]) + " — " + dl(m[2]); }],
    [/^비슷하게 생긴 문자로 명령을 숨겼어요: ([\s\S]+)$/, function (m) { return "Commands hidden with lookalike characters: " + dl(m[1]); }],
    [/^이 부분에서 '([\s\S]+?)'을\(를\) 발견했어요\. ([\s\S]+)$/, function (m) {
      return "Found '" + dl(m[1]) + "' here. " + dl(m[2]);
    }],
    [/^⚠️ 이 페이지에서 숨은 위험 신호 (\d+)곳을 발견해 표시해 뒀어요\. 빨간 밑줄에 마우스를 올려 보세요\.$/, function (m) {
      return "⚠️ Found and marked " + m[1] + " hidden risk signal(s) on this page. Hover over the red underlines.";
    }]
  ];

  function trCore(core) {
    if (D[core] != null) return D[core];
    for (var i = 0; i < R.length; i++) {
      var m = core.match(R[i][0]);
      if (m) { var out = R[i][1](m); if (out != null) return out; }
    }
    // 문장 결합(통역 카드 hidden/how 는 여러 문장을 공백으로 이어붙임) → 문장별 사전 시도
    if (core.indexOf(". ") > 0) {
      var parts = core.split(". ");
      if (parts.length > 1) {
        var ok = true, outp = [];
        for (var j = 0; j < parts.length; j++) {
          var key = parts[j];
          if (j < parts.length - 1) key += "."; // split 이 떼어낸 마침표 복원
          var t = D[key];
          if (t == null) { ok = false; break; }
          outp.push(t);
        }
        if (ok) return outp.join(" ");
      }
    }
    return null;
  }

  function tr(s) {
    if (!s) return null;
    var m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var core = m[2].replace(/\s+/g, " ");
    if (!core || !/[가-힣]/.test(core)) return null;
    var out = trCore(core);
    if (out == null) return null;
    return m[1] + out + m[3];
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1 };
  var ATTRS = ["placeholder", "title", "aria-label"];

  function trAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (el.hasAttribute && el.hasAttribute(a)) {
        var v = tr(el.getAttribute(a));
        if (v != null) el.setAttribute(a, v);
      }
    }
  }

  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) { var v = tr(node.nodeValue); if (v != null) node.nodeValue = v; return; }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) {
      if (SKIP[node.nodeName]) { trAttrs(node); return; }
      trAttrs(node);
    }
    var c = node.firstChild;
    while (c) { var next = c.nextSibling; walk(c); c = next; }
  }

  var observed = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  function observe(root) {
    if (observed) { if (observed.has(root)) return; observed.add(root); }
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === "characterData") { var v = tr(mu.target.nodeValue); if (v != null) mu.target.nodeValue = v; }
        else if (mu.type === "childList") {
          for (var j = 0; j < mu.addedNodes.length; j++) {
            var n = mu.addedNodes[j];
            walk(n);
            hookShadow(n);
          }
        } else if (mu.type === "attributes") { trAttrs(mu.target); }
      }
    }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // 위젯(Shadow DOM) 안까지 — open 모드라 shadowRoot 접근 가능
  function hookShadow(n) {
    if (n && n.nodeType === 1 && n.id === "agentguard-widget-host" && n.shadowRoot) {
      walk(n.shadowRoot); observe(n.shadowRoot);
    }
  }

  function boot() {
    walk(document.documentElement);
    observe(document.documentElement);
    var w = document.getElementById("agentguard-widget-host");
    if (w) hookShadow(w);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
