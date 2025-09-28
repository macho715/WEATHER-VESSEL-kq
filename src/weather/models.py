"""정규화된 날씨 모델입니다. / Normalized weather models."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from pydantic import Field

from ..base import LogiBaseModel


class MarineConditions(LogiBaseModel):
    """해상 조건 메트릭입니다. / Marine condition metrics."""

    wind_speed_knots: float = Field(ge=0)
    wind_gust_knots: float = Field(ge=0)
    wave_height_m: float = Field(ge=0)
    visibility_nm: float = Field(ge=0)


class WeatherObservation(LogiBaseModel):
    """현재 관측 데이터입니다. / Current weather observation."""

    timestamp: datetime
    temperature_c: float
    marine: MarineConditions
    provenance: str


class ForecastEntry(LogiBaseModel):
    """개별 예보 항목입니다. / Individual forecast entry."""

    timestamp: datetime
    temperature_c: float
    marine: MarineConditions


class ForecastBundle(LogiBaseModel):
    """예보 묶음 데이터입니다. / Forecast bundle data."""

    generated_at: datetime
    horizon: timedelta
    entries: List[ForecastEntry]
    provenance: str

    def find_window(self, start: datetime, end: datetime) -> List[ForecastEntry]:
        """시간 구간 예보를 찾습니다. / Find forecast within interval."""

        return [entry for entry in self.entries if start <= entry.timestamp <= end]


class WeatherSnapshot(LogiBaseModel):
    """단일 스냅샷 결과입니다. / Single weather snapshot result."""

    observation: WeatherObservation
    forecast: ForecastBundle


class VoyageWeatherContext(LogiBaseModel):
    """항해 관련 날씨 문맥입니다. / Voyage weather context."""

    location_name: Optional[str] = None
    snapshots: List[WeatherSnapshot]
