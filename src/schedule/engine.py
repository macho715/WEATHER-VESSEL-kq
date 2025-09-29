"""항해 일정 엔진입니다. / Voyage scheduling engine."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Tuple

from ..base import LogiBaseModel
from ..risk.thresholds import ThresholdEvaluator, VesselProfile
from ..weather.models import ForecastBundle, WeatherSnapshot


class VoyageWindow(LogiBaseModel):
    """항해 시간 창입니다. / Voyage time window."""

    departure: datetime
    arrival_window_start: datetime
    arrival_window_end: datetime


class VoyagePlan(LogiBaseModel):
    """항해 계획 모델입니다. / Voyage plan model."""

    origin: str
    destination: str
    planned_departure: datetime
    distance_nm: float


class RiskFlag(LogiBaseModel):
    """위험 플래그 정보입니다. / Risk flag information."""

    code: str
    passed: bool
    reason: str


class VoyageAssessment(LogiBaseModel):
    """항해 평가 결과입니다. / Voyage assessment result."""

    plan: VoyagePlan
    vessel: VesselProfile
    window: VoyageWindow
    risk_flags: List[RiskFlag]
    etd_allowed: bool
    etd_reason: str
    provider_provenance: str


def _project_eta_range(
    distance_nm: float, speed_knots: float
) -> Tuple[timedelta, timedelta]:
    """ETA 범위를 계산합니다. / Compute ETA range."""

    base_hours = distance_nm / speed_knots
    p50 = timedelta(hours=base_hours)
    p90 = timedelta(hours=base_hours * 1.2)
    return p50, p90


def _build_window(plan: VoyagePlan, p50: timedelta, p90: timedelta) -> VoyageWindow:
    """도착 창을 구성합니다. / Build arrival window."""

    return VoyageWindow(
        departure=plan.planned_departure,
        arrival_window_start=plan.planned_departure + p50,
        arrival_window_end=plan.planned_departure + p90,
    )


def assess_voyage(
    plan: VoyagePlan,
    vessel: VesselProfile,
    snapshot: WeatherSnapshot,
) -> VoyageAssessment:
    """항해를 평가합니다. / Assess voyage feasibility."""

    evaluator = ThresholdEvaluator(thresholds=vessel.weather_caps)
    risk_map = evaluator.evaluate(snapshot.observation.marine)
    reason_map = evaluator.reasons(snapshot.observation.marine)
    risk_flags = [
        RiskFlag(code=code, passed=passed, reason=reason_map[code])
        for code, passed in risk_map.items()
    ]
    etd_allowed = all(flag.passed for flag in risk_flags)
    etd_reason = (
        "All thresholds satisfied"
        if etd_allowed
        else "; ".join(flag.reason for flag in risk_flags if not flag.passed)
    )
    p50, p90 = _project_eta_range(plan.distance_nm, vessel.service_speed_knots)
    window = _build_window(plan, p50, p90)
    return VoyageAssessment(
        plan=plan,
        vessel=vessel,
        window=window,
        risk_flags=risk_flags,
        etd_allowed=etd_allowed,
        etd_reason=etd_reason,
        provider_provenance=snapshot.observation.provenance,
    )


def select_departure_snapshot(
    snapshot: WeatherSnapshot,
    forecast: ForecastBundle,
    departure: datetime,
) -> WeatherSnapshot:
    """출항 시점 스냅샷을 선택합니다. / Select departure snapshot."""

    relevant_entries = [
        entry for entry in forecast.entries if entry.timestamp >= departure
    ]
    if relevant_entries:
        marine = relevant_entries[0].marine
        derived_snapshot = WeatherSnapshot(
            observation=snapshot.observation.model_copy(
                update={"marine": marine, "timestamp": departure}
            ),
            forecast=forecast,
        )
        return derived_snapshot
    return snapshot
