/* AGScan — 온디바이스 경량 위험 스캐너(브라우저·Node 공용, 백엔드 불필요).
 *
 * 파이썬 core/textnorm.py 의 JS 이식본. 페이지·텍스트에서 숨은 명령을 즉시 찾는다:
 *   - 제로위드 스테가노 실디코딩(0/1 → ASCII 복원)
 *   - 유니코드 태그문자 밀수 복원
 *   - 양방향 제어(BiDi) 위장 탐지
 *   - homoglyph(키릴·그리스) 라틴 정규화 후 위험어 재매칭
 *   - 프롬프트 인젝션/비밀경로/은폐 지시 정규식
 *
 * 위젯(인라인 하이라이트)과 크롬 익스텐션(content script)이 공유한다.
 * UMD: node 는 module.exports, 브라우저는 window.AGScan.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AGScan = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ZW = /[​‌‍⁠﻿᠎‎‏]/;
  var TAGCH = /[\u{E0000}-\u{E007F}]/u;
  var BIDI = /[‪-‮⁦-⁩]/;
  var HOMO = { "а":"a","е":"e","о":"o","р":"p","с":"c","х":"x","у":"y","і":"i","ѕ":"s","ԁ":"d","һ":"h","ј":"j","в":"b","к":"k","м":"m","н":"h","п":"n","т":"t","ο":"o","α":"a","ν":"v","ρ":"p","ε":"e","ι":"i","κ":"k","μ":"u","τ":"t","υ":"u","χ":"x" };
  var HOMO_RE = new RegExp("[" + Object.keys(HOMO).join("") + "]", "g");

  var RISK = [
    { re: /ignore\s+(all\s+|the\s+)?(previous|prior|above)\s+(instructions?|prompts?|messages?)/i, sev: "red", label: "숨은 지시", msg: "AI에게 이전 지시를 무시하라고 시켜요." },
    { re: /(disregard|forget)\s+(all|everything|previous|above)/i, sev: "red", label: "숨은 지시", msg: "기존 규칙을 잊게 만들려 해요." },
    { re: /(id_rsa|id_ed25519|\.ssh\b|\.env\b|\.aws\/credentials|\.netrc|credentials\.json|api[_-]?key)/i, sev: "red", label: "비밀 파일", msg: "비밀 키·설정 파일을 노려요." },
    { re: /(do\s+not\s+(tell|inform|notify|mention)\s+the\s+user|사용자에게\s*(말하지|알리지|보고하지)\s*마)/i, sev: "red", label: "은폐 지시", msg: "사용자에게 숨기라고 지시해요." },
    { re: /(you\s+are\s+now|from\s+now\s+on\s+you\s+are|지금부터\s*너는|개발자\s*모드|developer\s+mode|\bDAN\b|jailbreak)/i, sev: "yellow", label: "역할 조작", msg: "AI 역할을 바꾸려 해요." },
    { re: /(<\s*important\s*>|\[SYSTEM\]|<<SYS>>)/i, sev: "red", label: "위조 태그", msg: "관리자인 척하는 가짜 태그예요." }
  ];

  function decodeZeroWidth(s) {
    var seq = "", i;
    for (i = 0; i < s.length; i++) { var c = s[i]; if (c === "​" || c === "‌" || c === "‍") seq += c; }
    if (seq.length < 8) return "";
    var maps = [["​", "‌"], ["‌", "‍"]];
    for (var m = 0; m < maps.length; m++) {
      var zero = maps[m][0], one = maps[m][1], bits = "", j;
      for (j = 0; j < seq.length; j++) { if (seq[j] === zero) bits += "0"; else if (seq[j] === one) bits += "1"; }
      if (bits.length < 8) continue;
      var out = "", ok = true, k;
      for (k = 0; k + 8 <= bits.length; k += 8) {
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

  // 텍스트 1개 → 발견 목록 [{severity,label,msg,decoded?}]
  function scanText(t) {
    var found = [];
    if (!t) return found;
    if (ZW.test(t)) { var d = decodeZeroWidth(t); found.push({ severity: "red", label: "보이지 않는 글자", msg: d ? "글자 사이에 숨긴 명령을 찾았어요." : "눈에 안 보이는 특수문자가 섞여 있어요.", decoded: d }); }
    if (TAGCH.test(t)) { var dt = decodeTagChars(t); found.push({ severity: "red", label: "밀수된 명령", msg: "특수 유니코드로 숨긴 명령이에요.", decoded: dt }); }
    if (BIDI.test(t)) found.push({ severity: "yellow", label: "방향 뒤집기", msg: "글자 방향을 뒤집어 위장했어요." });
    var norm = t.replace(HOMO_RE, function (x) { return HOMO[x]; });
    var homoHit = norm !== t;
    if (homoHit) {
      for (var r0 = 0; r0 < RISK.length; r0++) if (RISK[r0].re.test(norm)) { found.push({ severity: "red", label: "닮은꼴 위장", msg: "비슷하게 생긴 문자로 명령을 숨겼어요: " + RISK[r0].label }); break; }
    }
    for (var r = 0; r < RISK.length; r++) if (RISK[r].re.test(t) || RISK[r].re.test(norm)) found.push({ severity: RISK[r].sev, label: RISK[r].label, msg: RISK[r].msg });
    // 중복 라벨 정리
    var seen = {}, uniq = [];
    for (var q = 0; q < found.length; q++) { var key = found[q].label; if (!seen[key]) { seen[key] = 1; uniq.push(found[q]); } }
    return uniq;
  }

  function worst(list) {
    var s = "green";
    for (var i = 0; i < list.length; i++) { if (list[i].severity === "red") return "red"; if (list[i].severity === "yellow") s = "yellow"; }
    return s;
  }

  // ── PII·시크릿 span 탐지 + 로컬 복원 가능 마스킹(백엔드 불필요) ──
  var SECRET_PAT = [
    ["OpenAI API 키", "critical", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
    ["Anthropic API 키", "critical", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
    ["AWS 액세스 키", "critical", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
    ["GitHub 토큰", "critical", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g],
    ["Google API 키", "critical", /\bAIza[0-9A-Za-z_-]{35}\b/g],
    ["JWT 토큰", "critical", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g]
  ];
  var PII_PAT = [
    ["주민등록번호", "high", /\b\d{6}-[1-4]\d{6}\b/g],
    ["휴대폰 번호", "medium", /\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/g],
    ["이메일 주소", "medium", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
    ["신용카드 번호", "high", /\b(?:\d[ -]?){13,16}\b/g]
  ];
  var SLUG = { "주민등록번호": "RRN", "휴대폰 번호": "PHONE", "이메일 주소": "EMAIL", "신용카드 번호": "CARD" };

  function luhn(s) {
    var d = (s.match(/\d/g) || []); if (d.length < 13 || d.length > 16) return false;
    var sum = 0, alt = false;
    for (var i = d.length - 1; i >= 0; i--) { var n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
    return sum % 10 === 0;
  }
  function _overlaps(list, s, e) { for (var i = 0; i < list.length; i++) { if (!(e <= list[i].start || s >= list[i].end)) return true; } return false; }

  function scanPII(t) {
    var out = [];
    if (!t) return out;
    SECRET_PAT.forEach(function (p) { var re = p[2]; re.lastIndex = 0; var m; while ((m = re.exec(t))) { if (!_overlaps(out, m.index, m.index + m[0].length)) out.push({ start: m.index, end: m.index + m[0].length, label: p[0], severity: p[1], category: "secret", text: m[0] }); } });
    PII_PAT.forEach(function (p) { var re = p[2]; re.lastIndex = 0; var m; while ((m = re.exec(t))) { if (p[0] === "신용카드 번호" && !luhn(m[0])) continue; if (_overlaps(out, m.index, m.index + m[0].length)) continue; out.push({ start: m.index, end: m.index + m[0].length, label: p[0], severity: p[1], category: "pii", text: m[0] }); } });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  function redact(t, spans) {
    spans = spans || scanPII(t);
    if (!spans.length) return { masked: t, mapping: {}, count: 0 };
    var mapping = {}, v2t = {}, cnt = {};
    spans.forEach(function (s) {
      var orig = s.text || t.slice(s.start, s.end);
      if (v2t[orig]) { s.token = v2t[orig]; return; }
      var slug = s.category === "secret" ? "SECRET" : (SLUG[s.label] || "PII");
      cnt[slug] = (cnt[slug] || 0) + 1;
      var tok = "[" + slug + "_" + cnt[slug] + "]";
      v2t[orig] = tok; mapping[tok] = orig; s.token = tok;
    });
    var masked = t;
    spans.slice().sort(function (a, b) { return b.start - a.start; }).forEach(function (s) { masked = masked.slice(0, s.start) + s.token + masked.slice(s.end); });
    return { masked: masked, mapping: mapping, count: spans.length };
  }

  return { scanText: scanText, scanPII: scanPII, redact: redact, decodeZeroWidth: decodeZeroWidth, decodeTagChars: decodeTagChars, worst: worst, RISK: RISK };
});
