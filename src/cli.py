"""운영자용 CLI입니다. / Operator-facing CLI."""

from __future__ import annotations

import asyncio
import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path

import typer

from .config import AppConfig, load_app_config
from .reporting.markdown import build_report
from .risk.thresholds import VesselProfile
from .schedule.engine import (
    VoyageAssessment,
    VoyagePlan,
    assess_voyage,
    select_departure_snapshot,
)
from .weather.models import WeatherSnapshot
from .weather.providers import WeatherProvider, WeatherService, create_provider

app = typer.Typer(help="Weather Vessel CLI")


def _resolve_when(argument: str) -> str:
    """when 값을 ISO로 변환합니다. / Resolve when to ISO string."""

    base = datetime.now(timezone.utc).replace(microsecond=0)
    if argument == "now":
        return base.isoformat()
    if argument.startswith("+"):
        hours = int(argument[1:])
        return (base + timedelta(hours=hours)).isoformat()
    return argument


def _build_service(config: AppConfig) -> WeatherService:
    """서비스를 생성합니다. / Build weather service."""

    providers: list[WeatherProvider] = []
    for name in config.provider_order:
        provider_settings = config.provider_by_name(name)
        providers.append(create_provider(provider_settings))
    return WeatherService(providers)


def _print_snapshot(snapshot: WeatherSnapshot) -> None:
    """스냅샷을 출력합니다. / Print snapshot."""

    marine = snapshot.observation.marine
    lines = [
        (
            "Provider | Temp (°C) | Wind (kn) | Gust (kn) | "
            "Wave (m) | Visibility (nm)"
        ),
        "---------|------------|-----------|-----------|----------|-----------------",
        (
            f"{snapshot.observation.provenance} | "
            f"{snapshot.observation.temperature_c:.2f} | "
            f"{marine.wind_speed_knots:.2f} | {marine.wind_gust_knots:.2f} | "
            f"{marine.wave_height_m:.2f} | {marine.visibility_nm:.2f}"
        ),
    ]
    typer.echo("\n".join(lines))


@app.command("fetch-weather")
def fetch_weather(
    lat: float,
    lon: float,
    when: str = typer.Option("now"),
) -> None:
    """날씨를 조회합니다. / Fetch weather data."""

    config = load_app_config()
    service = _build_service(config)

    async def _run() -> WeatherSnapshot:
        return await service.fetch(lat, lon, _resolve_when(when))

    snapshot = asyncio.run(_run())
    _print_snapshot(snapshot)


def _ensure_outputs() -> None:
    """출력 디렉터리를 확인합니다. / Ensure output directories."""

    Path("outputs").mkdir(parents=True, exist_ok=True)


def _append_csv(assessment: VoyageAssessment) -> None:
    """CSV를 갱신합니다. / Append CSV summary."""

    _ensure_outputs()
    csv_path = Path("outputs/voyage_summary.csv")
    headers = [
        "origin",
        "destination",
        "planned_departure",
        "etd_allowed",
        "etd_reason",
        "p50_eta",
        "p90_eta",
        "provider",
    ]
    row = [
        assessment.plan.origin,
        assessment.plan.destination,
        assessment.plan.planned_departure.isoformat(),
        "YES" if assessment.etd_allowed else "NO",
        assessment.etd_reason,
        assessment.window.arrival_window_start.isoformat(),
        assessment.window.arrival_window_end.isoformat(),
        assessment.provider_provenance,
    ]
    write_header = not csv_path.exists()
    with csv_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        if write_header:
            writer.writerow(headers)
        writer.writerow(row)


@app.command("plan-voyage")
def plan_voyage(
    origin: str = typer.Option(..., "--from", help="Origin code"),
    destination: str = typer.Option(..., "--to", help="Destination code"),
    departure: datetime = typer.Option(..., help="Departure ISO timestamp"),
    distance_nm: float = typer.Option(480.0, help="Distance in nautical miles"),
    lat: float = typer.Option(0.0, help="Latitude for weather lookup"),
    lon: float = typer.Option(0.0, help="Longitude for weather lookup"),
) -> None:
    """항해를 계획합니다. / Plan voyage and assess risk."""

    config = load_app_config()
    service = _build_service(config)

    async def _run() -> WeatherSnapshot:
        iso_when = departure.astimezone(timezone.utc).isoformat()
        return await service.fetch(lat, lon, iso_when)

    snapshot = asyncio.run(_run())
    adjusted_snapshot = select_departure_snapshot(
        snapshot, snapshot.forecast, departure
    )
    vessel = VesselProfile(
        name="Default Vessel",
        service_speed_knots=18.0,
        weather_caps=config.marine_thresholds,
    )
    plan = VoyagePlan(
        origin=origin,
        destination=destination,
        planned_departure=departure,
        distance_nm=distance_nm,
    )
    assessment = assess_voyage(plan, vessel, adjusted_snapshot)
    _print_snapshot(adjusted_snapshot)
    etd_text = "YES" if assessment.etd_allowed else "NO"
    typer.echo("\nETD Allowed: " + etd_text)
    for flag in assessment.risk_flags:
        status = "PASS" if flag.passed else "FAIL"
        typer.echo(f"- {flag.code}: {status} ({flag.reason})")
    report = build_report(assessment, config, Path("reports"))
    typer.echo(f"\nReport saved to {report.path}")
    _append_csv(assessment)


def main() -> None:
    """CLI 엔트리 포인트입니다. / CLI entry point."""

    app()


if __name__ == "__main__":  # pragma: no cover - CLI guard
    main()
