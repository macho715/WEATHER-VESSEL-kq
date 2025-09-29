"""마크다운 리포트 빌더입니다. / Markdown report builder."""

from __future__ import annotations

from pathlib import Path

from ..base import LogiBaseModel
from ..config import AppConfig
from ..schedule.engine import VoyageAssessment


class MarkdownReport(LogiBaseModel):
    """마크다운 리포트 데이터입니다. / Markdown report data."""

    content: str
    path: Path


def format_markdown(assessment: VoyageAssessment, config: AppConfig) -> str:
    """마크다운 문자열을 만듭니다. / Build markdown string."""

    plan = assessment.plan
    vessel = assessment.vessel
    etd_flag = "YES" if assessment.etd_allowed else "NO"
    lines = [
        f"# Voyage Report: {plan.origin} → {plan.destination}",
        "",
        "## Inputs",
        f"- Planned Departure: {plan.planned_departure.isoformat()}",
        f"- Distance (NM): {plan.distance_nm:.2f}",
        (
            f"- Vessel: {vessel.name} "
            f"(Service Speed {vessel.service_speed_knots:.2f} kn)"
        ),
        "",
        "## Weather & Risk",
        f"- Provider: {assessment.provider_provenance}",
        f"- ETD Allowed: {etd_flag}",
        f"- ETD Reason: {assessment.etd_reason}",
        "",
        "### Risk Flags",
    ]
    for flag in assessment.risk_flags:
        status = "✅" if flag.passed else "⚠️"
        lines.append(f"- {status} {flag.code}: {flag.reason}")
    lines.extend(
        [
            "",
            "## Arrival Window",
            f"- P50 ETA: {assessment.window.arrival_window_start.isoformat()}",
            f"- P90 ETA: {assessment.window.arrival_window_end.isoformat()}",
            "",
            "## Thresholds",
            (f"- Max Wind Speed: " f"{config.marine_thresholds.max_wind_speed:.2f} kn"),
            f"- Max Gust: {config.marine_thresholds.max_gust:.2f} kn",
            (
                f"- Max Wave Height: "
                f"{config.marine_thresholds.max_wave_height:.2f} m"
            ),
            (f"- Min Visibility: " f"{config.marine_thresholds.min_visibility:.2f} nm"),
        ]
    )
    return "\n".join(lines).strip() + "\n"


def build_report(
    assessment: VoyageAssessment, config: AppConfig, directory: Path
) -> MarkdownReport:
    """리포트를 생성합니다. / Build markdown report file."""

    directory.mkdir(parents=True, exist_ok=True)
    voyage_id = (
        f"{assessment.plan.origin}_{assessment.plan.destination}_"
        f"{assessment.plan.planned_departure:%Y%m%dT%H%M}"
    )
    path = directory / f"{voyage_id}.md"
    content = format_markdown(assessment, config)
    path.write_text(content, encoding="utf-8")
    return MarkdownReport(content=content, path=path)
