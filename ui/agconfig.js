/* © 2026 DONGHUN LEE · AgentGuard · MIT License. */
/* AGConfig — AI provider 설정 공유 모듈(대시보드·위젯·설정 페이지 공용).
 *
 * 단일 진실원천: localStorage["ag_cfg"]. 설정 페이지에서 정하면 같은 origin 의
 * 대시보드·위젯이 그대로 따른다. 온디바이스 원칙상 키는 브라우저에만 저장.
 *
 * provider 는 항상 세 갈래 + 자동/끄기:
 *   ollama(온디바이스) · claude · openrouter · auto · off
 * provider 별로 키/모델을 따로 보관하고, 선택된 provider 에 맞는 헤더만 전송한다.
 */
(function () {
  "use strict";
  var KEY = "ag_cfg";
  var DEF = {
    provider: "ollama",   // 기본 = 온디바이스(내 컴퓨터). 없으면 자동으로 오프라인 규칙 폴백
    ollamaUrl: "", ollamaModel: "",
    claudeKey: "", claudeModel: "",
    openrouterKey: "", openrouterModel: "",
    blockMode: false,     // 기업 정책: 위험 시 전송 차단
    orgTerms: ""          // 회사 전용 민감어(줄바꿈 구분) → 탐지·마스킹
  };

  function load() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return Object.assign({}, DEF); }
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, DEF, c))); } catch (e) { }
  }
  function set(patch) { var c = load(); Object.assign(c, patch); save(c); return c; }

  // 브라우저별 익명 ID — 러그풀 지문·검사 이력을 이 브라우저 단위로 격리(서버가 X-AG-Client로 인식)
  var CID_KEY = "ag_client_id";
  function clientId() {
    try {
      var id = localStorage.getItem(CID_KEY);
      if (!id) {
        id = (self.crypto && crypto.randomUUID)
          ? crypto.randomUUID().replace(/-/g, "")
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(CID_KEY, id);
      }
      return id;
    } catch (e) { return ""; }
  }

  // 선택된 provider 에 맞는 요청 헤더(키는 그 provider 것만)
  function headers(c) {
    c = c || load();
    var h = {};
    var cid = clientId();
    if (cid) h["X-AG-Client"] = cid;
    if (c.provider) h["X-AI-Provider"] = c.provider;
    if (c.provider === "claude") {
      if (c.claudeKey) h["X-AI-Key"] = c.claudeKey;
      if (c.claudeModel) h["X-AI-Model"] = c.claudeModel;
    } else if (c.provider === "openrouter") {
      if (c.openrouterKey) h["X-AI-Key"] = c.openrouterKey;
      if (c.openrouterModel) h["X-AI-Model"] = c.openrouterModel;
    } else if (c.provider === "ollama") {
      if (c.ollamaModel) h["X-AI-Model"] = c.ollamaModel;
    }
    if (c.ollamaUrl) h["X-Ollama-Url"] = c.ollamaUrl;
    if (c.orgTerms && c.orgTerms.trim()) h["X-AG-Org-Terms"] = encodeURIComponent(c.orgTerms.trim());
    return h;
  }

  // 사람이 읽는 현재 엔진 라벨
  function label(c) {
    c = c || load();
    return ({ ollama: "🖥️ 온디바이스", claude: "☁️ Claude", openrouter: "☁️ OpenRouter",
      auto: "✨ 자동", off: "⚙️ 오프라인 규칙" })[c.provider] || "✨ 자동";
  }

  window.AGConfig = { KEY: KEY, DEF: DEF, load: load, save: save, set: set, headers: headers, label: label, clientId: clientId };
})();
