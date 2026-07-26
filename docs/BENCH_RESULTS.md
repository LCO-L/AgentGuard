# 📊 벤치마크 기록 (Benchmark Results)

> `scripts/bench_scenarios.py` 실행 기록 — 실행할 때마다 아래에 자동 append 됩니다.
> Auto-appended on every run. README 상단 3숫자의 근거(영수증)입니다.

| 일시 (UTC) | 엔진 | 케이스 | 탐지율 | 오탐률 | 평균 | p95 | 미탐 | 오탐 |
|---|---|---|---|---|---|---|---|---|
| 2026-07-26 15:58 | offline rules (provider=off) | 59 (악성 36·정상 23) | 100.0% | 4.3% | 0.2ms | 0.8ms | 0 | 1 |
> - 오탐 `inspect:cur.execute("SELECT * FROM users WHERE i`
| 2026-07-26 16:04 | rules + AI intent (provider=ollama) | 59 (악성 36·정상 23) | 100.0% | 4.3% | 4712.5ms | 9344.6ms | 0 | 1 |
> - 오탐 `inspect:cur.execute("SELECT * FROM users WHERE i`
