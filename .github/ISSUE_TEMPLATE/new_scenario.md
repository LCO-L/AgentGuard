---
name: "🧩 새 탐지 시나리오 제안"
about: "이런 공격/유출 패턴도 잡아야 해요 — 데이터 한 줄이면 추가됩니다"
title: "[시나리오] "
labels: ["scenario", "good first issue"]
---

> 🇰🇷 **한국어** | [🇺🇸 English](new_scenario.en.md)

## 어떤 위험인가요?

<!-- 예: AI에게 '감사 모드'라고 속여 시스템 프롬프트를 빼내는 문구 -->

## 탐지돼야 하는 입력 예시

```text
(실제 페이로드 말고, 탐지 '신호'가 드러나는 예시 문구)
```

## 심각도 제안

- [ ] critical (즉시 차단해야 함)
- [ ] high
- [ ] medium
- [ ] low

## 참고

`core/rulepacks/scenarios_data.py` 에 `Scenario(...)` 한 줄을 추가하면
인스펙션·에디터·익스텐션·통역이 자동으로 함께 잡습니다. 직접 PR 주시면 더 좋아요!
