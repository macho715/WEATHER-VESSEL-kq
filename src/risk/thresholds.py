"""위험 임계치 관리입니다. / Risk threshold management."""

from __future__ import annotations

from typing import Dict

from pydantic import Field

from ..base import LogiBaseModel
from ..config import MarineThresholds
from ..weather.models import MarineConditions


class VesselProfile(LogiBaseModel):
    """선박 프로필 모델입니다. / Vessel profile model."""

    name: str
    service_speed_knots: float = Field(gt=0)
    weather_caps: MarineThresholds = Field(default_factory=MarineThresholds)


class ThresholdEvaluator(LogiBaseModel):
    """임계치 평가기입니다. / Threshold evaluator."""

    thresholds: MarineThresholds

    def evaluate(self, marine: MarineConditions) -> Dict[str, bool]:
        """임계치를 검증합니다. / Evaluate thresholds."""

        return {
            "wind_speed": (marine.wind_speed_knots <= self.thresholds.max_wind_speed),
            "gust": marine.wind_gust_knots <= self.thresholds.max_gust,
            "wave": marine.wave_height_m <= self.thresholds.max_wave_height,
            "visibility": (marine.visibility_nm >= self.thresholds.min_visibility),
        }

    def reasons(self, marine: MarineConditions) -> Dict[str, str]:
        """판단 사유를 생성합니다. / Produce evaluation reasons."""

        evaluation = self.evaluate(marine)
        messages: Dict[str, str] = {}
        for key, passed in evaluation.items():
            limit = getattr(
                self.thresholds,
                {
                    "wind_speed": "max_wind_speed",
                    "gust": "max_gust",
                    "wave": "max_wave_height",
                    "visibility": "min_visibility",
                }[key],
            )
            actual = getattr(
                marine,
                {
                    "wind_speed": "wind_speed_knots",
                    "gust": "wind_gust_knots",
                    "wave": "wave_height_m",
                    "visibility": "visibility_nm",
                }[key],
            )
            comparator = "<=" if key != "visibility" else ">="
            messages[key] = (
                f"{actual:.2f} {comparator} {limit:.2f}"
                if passed
                else f"{actual:.2f} !{comparator} {limit:.2f}"
            )
        return messages
