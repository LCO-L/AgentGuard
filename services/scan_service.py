# © 2026 이동훈 (DONGHUN LEE) · AgentGuard · MIT License.
"""파일 스캔 오케스트레이션 — ①정규화 → ②1층 → ③2층(AI) → ④3층(러그풀) → ⑤통역.

원본은 로컬 임시파일에만 머물고 처리 후 즉시 삭제(비저장 원칙).
AIConfig(provider/키)는 요청에서 주입 → 각 층으로 흘려보낸다(서버 비저장).
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import asdict

from adapters.registry import pick
from core.ai import backend
from core.ai.backend import AIConfig
from core.ai.interpret import interpret
from core.ai.intent import analyze_intent
from core.ai.rugpull import check_rugpull
from core.analyzer import run_layer1
from core.model import Finding, Verdict
from core.scorer import overall, score
from services import history_service


def scan_bytes(data: bytes, filename: str, cfg: AIConfig | None = None,
               client: str = "") -> Verdict:
    """업로드 바이트 → Verdict. API·CLI·배치 어디서든 호출 가능."""
    # basename만 사용 — 업로드 파일명에 경로 구분자가 섞여도 임시 디렉토리를 벗어나지 않게
    suffix = "_" + os.path.basename(filename or "upload.bin")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        return scan_path(path, filename or os.path.basename(path), cfg, client)
    finally:
        try:
            os.remove(path)  # 원본 즉시 삭제
        except OSError:
            pass


def scan_path(path: str, filename: str, cfg: AIConfig | None = None,
              client: str = "") -> Verdict:
    cfg = cfg or backend.resolve_config()

    # ① 정규화
    adapter = pick(path, filename)
    surface = adapter.to_surface(path, filename)

    # ② 1층: 결정적 룰
    findings = run_layer1(surface)

    # ③ 2층: AI 의도 분석 (LLM 우선, 오프라인 폴백)
    for res in analyze_intent(surface, cfg):
        if res.get("malicious"):
            findings.append(Finding(
                layer=2, rule_id="AI-INTENT-01", cap_kind="hidden_instruction",
                severity="red", where=res.get("where", ""),
                what=f"AI 의도 판정: {res.get('pattern', 'hidden intent')}",
                evidence=res.get("reason", ""), i18n_key="secret_read",
                confidence=float(res.get("confidence", 0.85))))

    # ④ 3층: 러그풀 지문 비교
    rug = check_rugpull(surface.name, surface.fingerprint, client)
    if rug["changed"]:
        findings.append(Finding(
            layer=3, rule_id="RUG-CHANGE-01", cap_kind="identity",
            severity="red", where="fingerprint",
            what="승인 후 변조 감지", evidence=rug["msg"], i18n_key="rugpull"))

    # 종합 점수·등급 (score 가 Finding.weight 를 채운다)
    sev = overall(findings)
    sc = score(findings)

    # ⑤ 통역 (LLM 우선, 폴백 보장)
    card = interpret(findings, sev, cfg)
    verdict = Verdict(surface_kind=surface.kind, overall=sev, score=sc,
                      findings=findings, card=card,
                      engine=card.source if card else "fallback")

    # 이력 저장(원본 X, 메타만)
    verdict.scan_id = history_service.save(
        surface.kind, surface.name, verdict, surface.fingerprint, client)
    return verdict


def verdict_to_dict(v: Verdict) -> dict:
    return asdict(v)


def scan_batch(files: list[tuple[bytes, str]], cfg: AIConfig | None = None,
               client: str = "") -> list[dict]:
    """여러 파일 일괄 스캔 — 기업 대시보드/CI용."""
    results = []
    for data, filename in files:
        try:
            results.append({"filename": filename, "ok": True,
                            "verdict": verdict_to_dict(scan_bytes(data, filename, cfg, client))})
        except Exception as e:
            results.append({"filename": filename, "ok": False, "error": str(e)})
    return results
