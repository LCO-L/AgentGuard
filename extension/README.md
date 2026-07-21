# 🛡️ AgentGuard 크롬 익스텐션

링크·파일·페이지에 숨은 명령과 프롬프트 인젝션을 **우클릭 한 번**으로 즉시 검사합니다.
Grammarly가 문법 오류에 밑줄을 긋듯, AgentGuard는 **보이지 않는 명령·닮은꼴 문자**에
빨간 밑줄을 긋고 호버하면 "여기 숨은 명령: send id_rsa" 처럼 꺼내 보여줍니다.

## 기능

| 기능 | 설명 |
|---|---|
| **우클릭 검사** | 링크·이미지·선택 텍스트·페이지를 우클릭 → 즉시 통역 카드 |
| **인라인 하이라이트** | 페이지의 숨은 위험을 자동으로 형광펜 표시(온디바이스, 백엔드 불필요) |
| **AI 입력창 가드** | ChatGPT·Claude 등에 보내기 전, 입력창의 시크릿·PII·인젝션을 감지하고 **Enter 전송을 가로채** 확인 모달(마스킹 후 전송) |
| **다운로드 가로채기** | 파일 내려받기 시 URL을 미리 검사해 위험하면 알림 |
| **3-엔진 선택** | 온디바이스(Ollama) · Claude · OpenRouter — 팝업에서 전환 |

### AI 입력창 가드 (Grammarly for Security)

`chatgpt.com`, `claude.ai`, `gemini.google.com` 등에서 입력창에 글을 쓰면(500ms 디바운스):
- `sk-...` API 키, 주민번호, 카드번호, 이메일 등 **민감정보**와 "이전 지시 무시" 같은
  **프롬프트 인젝션**을 로컬(백엔드 없이)에서 즉시 감지해 입력창 옆 배지로 표시.
- **Enter 전송을 가로채** 확인 모달을 띄우고, `[마스킹 후 전송]`을 누르면 `sk-...`가
  `[SECRET_1]`로 치환된 뒤 전송됩니다. 원문은 어디로도 나가지 않습니다.

## 설치 (개발자 모드)

1. 백엔드를 먼저 실행:
   ```bash
   cd agentguard && uv run python app.py   # http://localhost:8000
   ```
2. 크롬 → `chrome://extensions` → 우상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → 이 `extension/` 폴더 선택
4. 툴바의 🛡️ 아이콘 클릭 → 판단 엔진(온디바이스/Claude/OpenRouter)과 서버 주소 설정

## 온디바이스 원칙

- 페이지 인라인 하이라이트는 **백엔드 없이** 브라우저 안에서 즉시 동작(`agscan.js`).
- 파일/링크 상세 검사는 로컬 백엔드로 보내고, 백엔드는 원본을 저장하지 않습니다.
- API 키는 `chrome.storage.local`(이 브라우저)에만 저장됩니다.

## 구성

```
manifest.json   MV3 선언(contextMenus·downloads·storage)
background.js   우클릭 메뉴·다운로드 가로채기·백엔드 호출
content.js      인라인 하이라이트 + 결과 오버레이 카드(Shadow DOM)
inputguard.js   AI 입력창 감시 + 전송 인터셉트 + 마스킹(Grammarly for Security)
agscan.js       온디바이스 경량 스캐너(textnorm+pii 의 JS 이식)
popup.html/js   3-엔진 설정 + 상태·연결 테스트
```
