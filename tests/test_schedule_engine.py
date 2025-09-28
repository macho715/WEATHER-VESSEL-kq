"""일정 엔진 테스트입니다. / Schedule engine tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import given
from hypothesis import strategies as st

from src.config import MarineThresholds
from src.risk.thresholds import ThresholdEvaluator, VesselProfile
from src.schedule.engine import VoyagePlan, assess_voyage, select_departure_snapshot
from src.weather.models import (
    ForecastBundle,
    ForecastEntry,
    MarineConditions,
    WeatherObservation,
    WeatherSnapshot,
)


def _base_snapshot(provenance: str) -> WeatherSnapshot:
    """기본 스냅샷을 생성합니다. / Build base snapshot."""

    now = datetime(2025, 9, 29, 12, 0, tzinfo=timezone.utc)
    marine = MarineConditions(
        wind_speed_knots=10.0,
        wind_gust_knots=15.0,
        wave_height_m=2.0,
        visibility_nm=6.0,
    )
    observation = WeatherObservation(
        timestamp=now,
        temperature_c=24.0,
        marine=marine,
        provenance=provenance,
    )
    forecast = ForecastBundle(
        generated_at=now,
        horizon=timedelta(hours=24),
        entries=[
            ForecastEntry(
                timestamp=now + timedelta(hours=3),
                temperature_c=23.0,
                marine=MarineConditions(
                    wind_speed_knots=11.0,
                    wind_gust_knots=16.0,
                    wave_height_m=2.5,
                    visibility_nm=5.0,
                ),
            )
        ],
        provenance=provenance,
    )
    return WeatherSnapshot(observation=observation, forecast=forecast)


def test_assess_voyage_generates_flags() -> None:
    """항해 평가가 플래그를 생성합니다. / Assessment creates flags."""

    snapshot = _base_snapshot("ProviderA")
    vessel = VesselProfile(
        name="Test Vessel",
        service_speed_knots=18.0,
        weather_caps=MarineThresholds(),
    )
    plan = VoyagePlan(
        origin="MW4",
        destination="AGI",
        planned_departure=snapshot.observation.timestamp,
        distance_nm=360.0,
    )
    assessment = assess_voyage(plan, vessel, snapshot)
    assert assessment.provider_provenance == "ProviderA"
    assert assessment.window.arrival_window_start > plan.planned_departure
    assert len(assessment.risk_flags) == 4


def test_select_departure_snapshot_prefers_forecast() -> None:
    """출항 선택이 예보를 사용합니다. / Departure selection uses forecast."""

    snapshot = _base_snapshot("ProviderA")
    departure = snapshot.observation.timestamp + timedelta(hours=3)
    derived = select_departure_snapshot(snapshot, snapshot.forecast, departure)
    assert derived.observation.timestamp == departure
    assert derived.observation.marine.wave_height_m == pytest.approx(2.5)


@given(
    wind=st.floats(min_value=0.0, max_value=50.0),
    gust=st.floats(min_value=0.0, max_value=60.0),
    wave=st.floats(min_value=0.0, max_value=10.0),
    visibility=st.floats(min_value=0.0, max_value=20.0),
)
def test_threshold_reasons_align(
    wind: float, gust: float, wave: float, visibility: float
) -> None:
    """임계치 사유가 일관됩니다. / Threshold reasons align."""

    thresholds = MarineThresholds(
        max_wind_speed=25.0,
        max_gust=35.0,
        max_wave_height=5.0,
        min_visibility=5.0,
    )
    marine = MarineConditions(
        wind_speed_knots=wind,
        wind_gust_knots=gust,
        wave_height_m=wave,
        visibility_nm=visibility,
    )
    evaluator = ThresholdEvaluator(thresholds=thresholds)
    results = evaluator.evaluate(marine)
    reasons = evaluator.reasons(marine)
    for key, passed in results.items():
        reason = reasons[key]
        if passed:
            assert "!" not in reason
        else:
            assert "!" in reason
