"""Adapter 추상클스 — 모든 어댑터의 계약.

어댑터는 "포맷을 열어 Capability 목록으로 환원"만 한다.
판정·통역은 공용 엔진(core) 몫.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from core.surface import RiskSurface


class Adapter(ABC):
    kind: str = "unknown"

    @abstractmethod
    def detect(self, head: bytes, filename: str) -> bool:
        """매직바이트/확장자로 내 담당인지 판별."""

    @abstractmethod
    def to_surface(self, path: str, name: str = "") -> RiskSurface:
        """파일을 열어 RiskSurface로 정규화."""
