"""리포팅 테스트입니다. / Reporting tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from src.config import AppConfig, MarineThresholds
from src.reporting.markdown import build_report, format_markdown
from src.risk.thresholds import VesselProfile
from src.schedule.engine import VoyagePlan, assess_voyage
from src.weather.models import (
    ForecastBundle,
    ForecastEntry,
    MarineConditions,
    WeatherObservation,
    WeatherSnapshot,
)


def _assessment() -> tuple:
    """리포트용 평가를 생성합니다. / Build assessment for reporting."""

    plan = VoyagePlan(
        origin="MW4",
        destination="AGI",
        planned_departure=datetime(2025, 9, 29, 12, 0, tzinfo=timezone.utc),
        distance_nm=360.0,
    )
    thresholds = MarineThresholds(
        max_wind_speed=22.0,
        max_gust=28.0,
        max_wave_height=4.0,
        min_visibility=4.0,
    )
    vessel = VesselProfile(
        name="Demo Vessel",
        service_speed_knots=18.0,
        weather_caps=thresholds,
    )
    observation = WeatherObservation(
        timestamp=plan.planned_departure,
        temperature_c=24.0,
        marine=MarineConditions(
            wind_speed_knots=10.0,
            wind_gust_knots=15.0,
            wave_height_m=2.0,
            visibility_nm=6.0,
        ),
        provenance="ProviderA",
    )
    forecast = ForecastBundle(
        generated_at=plan.planned_departure,
        horizon=timedelta(hours=24),
        entries=[
            ForecastEntry(
                timestamp=plan.planned_departure,
                temperature_c=24.0,
                marine=observation.marine,
            )
        ],
        provenance="ProviderA",
    )
    snapshot = WeatherSnapshot(observation=observation, forecast=forecast)
    assessment = assess_voyage(plan, vessel, snapshot)
    config = AppConfig(
        providers=[],
        provider_order=[],
        marine_thresholds=thresholds,
        provenance_enabled=True,
    )
    return assessment, config


def test_markdown_matches_golden(tmp_path: Path) -> None:
    """마크다운 골든과 일치합니다. / Markdown matches golden file."""

    assessment, config = _assessment()
    content = format_markdown(assessment, config)
    golden = Path("tests/fixtures/expected_report.md").read_text(encoding="utf-8")
    assert content == golden
    report = build_report(assessment, config, tmp_path)
    assert report.path.exists()
    assert report.content == content
