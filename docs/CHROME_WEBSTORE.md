# 🛒 크롬 웹스토어 등록 가이드 (AgentGuard 확장)

> 준비 완료 상태(2026-07-27): PNG 아이콘 4종(`extension/icons/`) + manifest 등록 완료,
> 개인정보처리방침 페이지(`/privacy`) 서빙 완료. 아래 절차만 따라가면 된다.

---

## 0. 준비물 체크리스트

- [x] Manifest V3 (`extension/manifest.json`)
- [x] 아이콘 PNG 16/32/48/128 (`extension/icons/` — `scripts/make_icons.py`로 재생성 가능)
- [x] 개인정보처리방침 공개 URL → **https://agentguard.maeum.ai/privacy** (배포 후 접속 확인!)
- [ ] 구글 개발자 계정 (1회 등록비 **$5**, 2단계 인증 필수)
- [ ] 스크린샷 **1280×800** 1~5장 (아래 5장 추천 목록 참고)
- [ ] (선택) 프로모 타일 440×280 · 마퀴 1400×560

## 1. 개발자 계정 만들기

1. https://chrome.google.com/webstore/devconsole 접속 → 구글 계정 로그인
2. 개발자 등록($5, 카드 결제) + 계정 2단계 인증 켜기
3. 게시자 이름 설정 (예: `DONGHUN LEE` 또는 `AgentGuard`)

## 2. 패키징 (zip — CRX 아님!)

스토어에는 **zip**을 올린다 (CRX는 자가 배포용).

```bash
cd agentguard && python scripts/pack_extension.py
# → dist/agentguard-extension.zip  (icons/ 포함, __pycache__ 제외)
```

수동으로 하려면: `extension/` 폴더 안 내용물을 zip (폴더째가 아니라 **내용물**을 —
zip 루트에 manifest.json이 바로 보여야 한다).

## 3. 항목 만들기 + 스토어 등록정보

개발자 콘솔 → **새 항목** → zip 업로드 → 탭별로 입력:

**스토어 등록정보 탭**
- 이름: `AgentGuard — 온디바이스 보안 도우미` (영어 로케일 추가 시: `AgentGuard — On-device Security Assistant`)
- 요약(132자): `링크·파일·페이지 속 숨은 명령과 프롬프트 인젝션을 우클릭 한 번으로 검사하고, 사람의 말로 설명해 드려요.`
- 자세한 설명: `extension/README.md` 기능 표를 풀어서 사용 (영문은 README.en.md)
- 카테고리: **도구(Tools)** (또는 생산성)
- 언어: 한국어 (영어 리스팅도 추가 권장 — i18n 작업 완료했으니 셀링 포인트)
- 아이콘: `extension/icons/icon128.png` 업로드
- 스크린샷 추천 5장 (1280×800):
  1. 우클릭 → "AgentGuard로 검사" 메뉴 + 결과 카드
  2. ChatGPT 입력창에서 Enter 인터셉트 모달 ("API 키 감지 — 마스킹 후 전송?")
  3. 페이지 인라인 빨간 밑줄 + 호버 툴팁 (숨은 명령: send id_rsa)
  4. 대시보드 통역 카드 (위험 100점 예시)
  5. 팝업의 3-엔진 설정 (온디바이스 강조)

**개인정보 보호 탭 (심사의 핵심 — 아래 그대로 붙여넣기)**

- 단일 목적(Single purpose) 설명:
  ```
  Scans links, files, page text, and AI-chat input for hidden malicious instructions
  (prompt injection) and sensitive-data leaks, then explains the risk in plain language
  before the user opens or sends anything.
  ```
- 권한 정당화(Permission justifications):
  ```
  contextMenus — Adds "Scan with AgentGuard" to the right-click menu for links, images,
    selected text, and pages, which is the primary way users request a scan.
  downloads — Pre-checks the URL of a file the user starts downloading so we can warn
    before they open something dangerous.
  storage — Stores the user's own settings locally: backend address, chosen AI engine,
    and their own (BYOK) API key. Nothing is synced or sent to us.
  notifications — Shows a warning notification when a risky download is detected.
  activeTab + scripting — Reads the current page's text only when the user explicitly
    requests a page scan.
  Host permission <all_urls> — The content script provides on-device inline highlighting
    of hidden prompt-injection text (zero-width characters, homoglyphs) on pages the user
    reads, and guards AI chat input boxes (chatgpt.com, claude.ai, gemini.google.com).
    This analysis runs locally in the browser (agscan.js); content is transmitted only
    when the user explicitly requests a detailed scan, and only to the backend the user
    configured. Nothing is stored server-side (see privacy policy).
  ```
- 원격 코드(Remote code): **사용 안 함** 선택 (백엔드는 데이터 API일 뿐, 코드를 내려받아 실행하지 않음)
- 데이터 사용(Data usage) 공개:
  - 수집 항목: **"웹사이트 콘텐츠"** (사용자가 검사를 요청한 텍스트·링크·파일) — 체크
  - 용도: **앱 기능(App functionality)** 만 체크
  - "판매하지 않음 / 승인된 용도 외 사용·양도 없음 / 신용도 판단에 사용 없음" 3개 인증 체크박스 모두 체크
- 개인정보처리방침 URL: `https://agentguard.maeum.ai/privacy`

**배포 탭**
- 공개 범위: 전체 공개(Public) / 비공개 테스트면 "비공개" + 테스터 이메일
- 지역: 전체

## 4. 제출 → 심사

- 제출하면 심사 대기. 보통 **1~3일**, 단 `<all_urls>` 호스트 권한이라 **심층 심사로 몇 주까지** 갈 수 있다.
- 심사 중 수정하고 싶으면 제출 취소 가능.

### 흔한 반려 사유와 대응
| 반려 사유 | 대응 |
|---|---|
| "광범위한 호스트 권한" | 위 정당화 문구 + 개인정보처리방침으로 대부분 통과. 반려가 반복되면 content_scripts를 AI 사이트(chatgpt/claude/gemini)로 좁히고 나머지는 activeTab으로 전환하는 옵션 검토 |
| "단일 목적 불명확" | 위 single purpose 문구 사용 — "보안 검사"라는 하나의 목적으로 기능을 묶어 설명 |
| 메타데이터 불일치 | 설명·스크린샷이 실제 기능과 일치해야 함. 과장 문구 금지 |
| 개인정보처리방침 접속 불가 | 배포(Railway) 먼저 → `/privacy` 200 확인 후 제출 |

## 5. 업데이트 배포

1. `manifest.json`의 `"version"` 올리기 (예: 1.0.0 → 1.0.1)
2. 다시 zip → 콘솔에서 "패키지" 탭 → 새 zip 업로드 → 제출
3. 사용자에게는 몇 시간~하루 내 자동 업데이트

## 6. 제출 전 마지막 점검 (로컬)

```bash
# zip에 icons/가 들어갔는지
python scripts/pack_extension.py && unzip -l dist/agentguard-extension.zip | grep icons
# 확장 로드 테스트: chrome://extensions → 개발자 모드 → 압축해제 로드 → 아이콘·우클릭·팝업 확인
```

> ⚠️ `dist/extension-key.pem`(CRX 서명키)은 절대 커밋·업로드 금지 — 스토어 제출과 무관.
