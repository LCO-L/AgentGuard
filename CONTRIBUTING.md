# AgentGuard에 기여하기

환영합니다! 이 프로젝트는 **MIT 라이선스** 오픈소스이며, 만든 사람
**이동훈 (DONGHUN LEE)** 의 저작권 고지를 모든 사본에서 유지합니다.

## 가장 쉬운 기여 — 탐지 시나리오 한 줄

새 공격/유출 패턴은 코드 수정 없이 **데이터 한 줄**로 추가됩니다.

1. `core/rulepacks/scenarios_data.py` 를 연다
2. `SCENARIOS` 리스트에 `Scenario(...)` 한 줄을 추가한다
3. 테스트를 돌린다 — 인스펙션·에디터·익스텐션·통역이 자동으로 함께 잡는지 확인

```bash
AG_AI_PROVIDER=off python -m unittest discover -s tests -v
```

## 개발 환경

```bash
uv sync                                   # 또는: pip install -r requirements.txt
python samples/make_samples.py            # 데모 샘플 생성
python app.py                             # http://localhost:8000
```

## 규칙 (PR이 통과하려면)

- **CI 필수**: 모든 PR은 GitHub Actions CI(테스트·CLI 게이트·JS 문법·API 스모크)를
  통과해야 머지됩니다. main 직접 push는 브랜치 보호로 막혀 있습니다.
- **리뷰 필수**: CODEOWNERS(소유자) 승인 없이는 머지되지 않습니다.
- **비저장 원칙**: 원문·비밀값·마스킹 매핑을 서버에 저장하는 코드는 받지 않습니다.
- **실페이로드 금지**: 샘플·테스트에는 실제 악성 코드가 아니라 **탐지 신호만** 담습니다.
- **저작권 고지 유지**: 파일 헤더의 `© 이동훈 (DONGHUN LEE) · MIT License` 를 지우지 마세요.
  (MIT 라이선스 자체가 고지 보존을 요구합니다)

## 커밋·PR 컨벤션

- PR 템플릿의 모든 항목을 채워주세요 — **모든 변경 이유가 기록에 남는 것**이 원칙입니다.
- 커밋 메시지는 "무엇을 왜"가 드러나게: `inject: 조부모 탈옥 시나리오 추가 (#12)`
- 이슈 없이 온 큰 PR보다, 이슈로 먼저 논의된 작은 PR이 빨리 머지됩니다.

## 보안 취약점을 찾았다면

공개 이슈 대신 [SECURITY.md](SECURITY.md) 의 비공개 채널로 알려주세요.
