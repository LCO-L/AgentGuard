"""OpenRouter 파이프라인 검증 — mock 기반(네트워크 불요).

커버: 정상 응답 파싱 · reasoning 폴 백 · HTTP 오류 표면화 · provider 폴 백 체인 ·
연결 테스트 오류 메시지 · 모델 목록.
"""
from __future__ import annotations

import io
import json
import unittest
from unittest.mock import patch

from core.ai import backend
from core.ai.backend import AIConfig


def _resp(payload: dict, status: int = 200):
    body = io.BytesIO(json.dumps(payload).encode())
    body.status = status  # type: ignore[attr-defined]

    class Ctx:
        def __enter__(self):
            return body

        def __exit__(self, *a):
            return False

    return Ctx()


def _http_error(status: int, msg: str):
    import urllib.error
    body = json.dumps({"error": {"message": msg}}).encode()
    return urllib.error.HTTPError(
        "https://openrouter.ai/api/v1/chat/completions", status, msg, {}, io.BytesIO(body))


class OpenRouterCallTest(unittest.TestCase):
    def setUp(self):
        backend._ERRORS.clear()
        self.cfg = AIConfig(provider="openrouter", api_key="sk-or-test")

    def test_success_parses_content(self):
        data = {"choices": [{"message": {"content": "안녕하세요"}}]}
        with patch("urllib.request.urlopen", return_value=_resp(data)):
            out = backend._call_openrouter("sys", "user", self.cfg, 100)
        self.assertEqual(out, "안녕하세요")

    def test_reasoning_fallback(self):
        """qwen3 계열: content 비고 reasoning 에만 담는 케이스."""
        data = {"choices": [{"message": {"content": "", "reasoning": "추론 답변"}}]}
        with patch("urllib.request.urlopen", return_value=_resp(data)):
            out = backend._call_openrouter("sys", "user", self.cfg, 100)
        self.assertEqual(out, "추론 답변")

    def test_http_error_recorded(self):
        with patch("urllib.request.urlopen", side_effect=_http_error(401, "User not found.")):
            out = backend._call_openrouter("sys", "user", self.cfg, 100)
        self.assertIsNone(out)
        self.assertIn("401", backend.last_error("openrouter.ai"))
        self.assertIn("User not found", backend.last_error("openrouter.ai"))

    def test_content_none_no_crash(self):
        """운영 500 재현 케이스: content=null → 예외 없이 None/폴 백."""
        data = {"choices": [{"message": {"content": None}}]}
        with patch("urllib.request.urlopen", return_value=_resp(data)):
            out = backend._call_openrouter("sys", "user", self.cfg, 100)
        self.assertIsNone(out)
        # complete() 경유 시에도 500이 아니라 graceful
        with patch("urllib.request.urlopen", return_value=_resp(data)):
            res = backend.test_connection(self.cfg)
        self.assertFalse(res["ok"])
        self.assertIn("error", res)

    def test_provider_exception_never_500(self):
        """provider 호출이 예외로 죽어도 complete()는 (None, 'off') 반환."""
        def boom(*a, **kw):
            raise RuntimeError("boom")
        with patch.dict(backend._DISPATCH, {"openrouter": boom, "claude": boom,
                                            "ollama": boom}):
            out, engine = backend.complete("s", "u", self.cfg)
        self.assertIsNone(out)
        self.assertEqual(engine, "off")

    def test_no_key_returns_none(self):
        cfg = AIConfig(provider="openrouter", api_key="")
        self.assertIsNone(backend._call_openrouter("s", "u", cfg, 10))

    def test_complete_fallback_chain(self):
        """명시 provider(claude) 실패 시 openrouter 로 자동 폴 백."""
        cfg = AIConfig(provider="claude", api_key="sk-or-test")
        data = {"choices": [{"message": {"content": "폴 백 성공"}}]}

        def fake_urlopen(req, timeout=None):
            url = req.full_url
            if "anthropic" in url:
                raise _http_error(401, "invalid x-api-key")
            return _resp(data)

        with patch("urllib.request.urlopen", side_effect=fake_urlopen):
            out, engine = backend.complete("sys", "user", cfg, 100)
        self.assertEqual(out, "폴 백 성공")
        self.assertEqual(engine, "openrouter")

    def test_test_connection_surfaces_error(self):
        cfg = AIConfig(provider="openrouter", api_key="bad-key")
        with patch("urllib.request.urlopen",
                   side_effect=_http_error(403, "Invalid API key")):
            res = backend.test_connection(cfg)
        self.assertFalse(res["ok"])
        self.assertIn("403", res.get("error", ""))
        self.assertIn("Invalid API key", res.get("error", ""))

    def test_test_connection_ok(self):
        cfg = AIConfig(provider="openrouter", api_key="sk-or-test")
        data = {"choices": [{"message": {"content": "ok"}}]}
        with patch("urllib.request.urlopen", return_value=_resp(data)):
            res = backend.test_connection(cfg)
        self.assertTrue(res["ok"])
        self.assertEqual(res["engine"], "openrouter")
        self.assertEqual(res["model"], "qwen/qwen3-8b")  # 기본 모델

    def test_list_models(self):
        cfg = AIConfig(provider="openrouter", api_key="sk-or-test")
        data = {"data": [{"id": "qwen/qwen3-8b"}, {"id": "openai/gpt-4o-mini"}]}
        with patch("urllib.request.urlopen", return_value=_resp(data)):
            models = backend.list_models("openrouter", cfg)
        self.assertIn("qwen/qwen3-8b", models)
        self.assertIn("openai/gpt-4o-mini", models)

    def test_off_provider_no_network(self):
        cfg = AIConfig(provider="off")
        with patch("urllib.request.urlopen",
                   side_effect=AssertionError("네트워크 호출 금지")):
            out, engine = backend.complete("s", "u", cfg)
        self.assertIsNone(out)
        self.assertEqual(engine, "off")


if __name__ == "__main__":
    unittest.main()
