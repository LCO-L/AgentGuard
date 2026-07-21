# © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
"""1층 룰 카탈로그 — 데이터로 분리(코드 안 늘림).

룰은 포맷이 아니라 Capability.kind에 붙는다.
각 룰: (rule_id, cap_kind, matcher_key, severity, i18n_key, what)
matcher는 analyzer.py의 MATCHERS에서 이름으로 결합.
"""
from __future__ import annotations

# ── exec ──────────────────────────────────────────────
EXEC_RULES = [
    ("EXEC-AUTORUN-01", "autorun", "red", "autorun", "자동실행 트리거 존재"),
    ("EXEC-MACRO-02", "macro", "red", "macro", "매크로·스크립트 본문 존재"),
    ("EXEC-SHELL-03", "shell", "red", "shell_cmd", "쉘 명령·인터프리터 호출 문자열"),
    ("EXEC-DROP-04", "drop", "red", "dropper", "실행파일 작성·드롭 흔적"),
    ("EXEC-DDE-05", "dde", "red", "dde", "DDE 자동 외부명령 실행(RTF/문서)"),
    ("EXEC-SVG-06", "svg_script", "red", "svg_script", "SVG 내부 스크립트·이벤트 핸들러"),
]

# ── network ───────────────────────────────────────────
NETWORK_RULES = [
    ("NET-URL-01", "ext_url", "yellow", "ext_url", "외부 URL·다운로드 주소"),
    ("NET-EXFIL-02", "exfil", "red", "exfil", "민감 경로+URL 결합(수집 정황)"),
    ("NET-SSRF-03", "ssrf", "yellow", "ssrf", "날부망 대역·localhost 접근"),
]

# ── hidden_instruction (프롬프트 인젝션·툴포이즈닝) ─────
HID_RULES = [
    ("HID-IGNORE-01", "ignore_prev", "red", "ignore_prev", "이전 지시 무시 지시"),
    ("HID-SECRET-02", "secret_read", "red", "secret_read", "비밀 경로 선행 열기 요구"),
    ("HID-OVERRIDE-03", "tool_hijack", "red", "tool_hijack", "도구 가로채기·은폐 지시"),
    ("HID-OBFS-04", "obfuscated", "yellow", "obfuscated", "base64·hex 난독 조립"),
    ("HID-TAG-05", "fake_system", "red", "fake_system", "위조 시스템 태그 삽입"),
    ("HID-PERSONA-06", "persona", "yellow", "persona", "역할 재정의 시도"),
    ("HID-DATAEXFIL-07", "data_exfil", "red", "data_exfil", "대화·환경 데이터 외부 전송 유도"),
    # 은닉 채널(스테가노)은 analyzer 의 텍스트 스캐너가 직접 발화 → 카탈로그 표기용
    ("STEG-ZWSP-01", "zero_width_stego", "red", "zero_width", "제로위드 문자로 명령 은닉"),
    ("STEG-TAG-02", "tag_smuggle", "red", "tag_smuggle", "유니코드 태그문자로 ASCII 밀수"),
    ("STEG-BIDI-03", "bidi_trick", "yellow", "bidi", "양방향 제어문자로 표기 위장"),
    ("HID-HOMO-08", "homoglyph_kw", "red", "homoglyph", "닮은꼴 문자로 명령어 위장"),
]

# ── embed / permission / identity ─────────────────────
EMB_RULES = [
    ("EMB-BADOLE-01", "bad_magic", "red", "bad_ole", "임베드 객체가 실행파일(PE)"),
    ("EMB-ENTROPY-02", "high_entropy", "yellow", "high_entropy", "고엔트로피 blob + 확장자 불일치"),
    ("EMB-FILE-03", "embed_file", "yellow", "embed_file", "첨부/임베드 파일 존재"),
    ("EMB-ZIPSLIP-04", "zip_slip", "red", "zip_slip", "압축 해제 경로 탈출(zip-slip)"),
]

PERM_RULES = [
    ("PERM-EXCESS-01", "excess_perm", "yellow", "excess_perm", "과도한 권한 요구"),
    ("PERM-SCOPE-02", "scope_mismatch", "yellow", "scope_mismatch", "권한-설명 불일치"),
    ("PERM-ENC-03", "encrypted", "yellow", "encrypted", "검사회피용 암호화"),
    ("PERM-DBLEXT-04", "double_ext", "yellow", "double_ext", "이중 확장자로 파일종류 위장"),
]

ID_RULES = [
    ("ID-UNKNOWN-01", "unknown_author", "yellow", "unknown_author", "서명/작성자/등록자 불명"),
]

# (rule_id, cap_kind, matcher_key, severity, i18n_key, what) 통합 테이블
RULES: list[dict] = [
    {"rule_id": rid, "cap_kind": cap, "matcher": m, "severity": sev,
     "i18n_key": key, "what": what}
    for cap, table in (
        ("exec", EXEC_RULES),
        ("network", NETWORK_RULES),
        ("hidden_instruction", HID_RULES),
        ("embed", EMB_RULES),
        ("permission", PERM_RULES),
        ("identity", ID_RULES),
    )
    for rid, m, sev, key, what in table
]
