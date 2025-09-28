"""날씨 제공자 단위 테스트입니다. / Weather provider unit tests."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
import respx

from src.config import CacheSettings, ProviderSettings, RateLimitSettings
from src.weather.providers import (
    CircuitBreakerOpenError,
    ProviderAAdapter,
    RateLimitExceededError,
)


def _sample_provider_settings(
    name: str, adapter: str, base_url: str
) -> ProviderSettings:
    """샘플 제공자 설정입니다. / Build sample provider settings."""

    return ProviderSettings(
        name=name,
        adapter=adapter,
        base_url=base_url,
        timeout_seconds=1.0,
        retries=1,
        cache=CacheSettings(ttl_seconds=60),
        rate_limit=RateLimitSettings(requests_per_minute=5),
        units="metric",
    )


@pytest.mark.asyncio
async def test_provider_a_parses_payload() -> None:
    """제공자 A 파싱을 검증합니다. / Validate provider A parsing."""

    settings = _sample_provider_settings("ProviderA", "provider_a", "https://a.test")
    provider = ProviderAAdapter(settings)
    now = datetime(2025, 9, 29, 12, 0, tzinfo=timezone.utc)
    payload = {
        "current": {
            "timestamp": now.isoformat(),
            "temperature_c": 25.5,
            "marine": {
                "wind_speed_knots": 12.4,
                "wind_gust_knots": 18.0,
                "wave_height_m": 2.1,
                "visibility_nm": 6.0,
            },
        },
        "forecast_generated_at": now.isoformat(),
        "forecast_horizon_hours": 24,
        "forecast": [
            {
                "timestamp": (now.replace(hour=15)).isoformat(),
                "temperature_c": 24.1,
                "marine": {
                    "wind_speed_knots": 10.0,
                    "wind_gust_knots": 15.0,
                    "wave_height_m": 1.5,
                    "visibility_nm": 7.0,
                },
            }
        ],
    }
    with respx.mock(base_url=settings.base_url) as mock:
        mock.get("/weather").respond(json=payload)
        snapshot = await provider.fetch_weather(25.0, 55.0, now.isoformat())
    assert snapshot.observation.temperature_c == pytest.approx(25.5)
    assert snapshot.observation.marine.wind_speed_knots == pytest.approx(12.4)
    assert snapshot.forecast.entries[0].marine.visibility_nm == pytest.approx(7.0)
    assert snapshot.observation.provenance == "ProviderA"


@pytest.mark.asyncio
async def test_caching_skips_second_call() -> None:
    """캐시가 두 번째 호출을 생략합니다. / Cache avoids second request."""

    settings = _sample_provider_settings(
        "ProviderA", "provider_a", "https://cache.test"
    )
    provider = ProviderAAdapter(settings)
    now = datetime.now(timezone.utc)
    payload = {
        "current": {
            "timestamp": now.isoformat(),
            "temperature_c": 20.0,
            "marine": {
                "wind_speed_knots": 5.0,
                "wind_gust_knots": 10.0,
                "wave_height_m": 1.0,
                "visibility_nm": 5.0,
            },
        },
        "forecast_generated_at": now.isoformat(),
        "forecast_horizon_hours": 12,
        "forecast": [],
    }
    with respx.mock(base_url=settings.base_url) as mock:
        route = mock.get("/weather").respond(json=payload)
        await provider.fetch_weather(10.0, 20.0, now.isoformat())
        await provider.fetch_weather(10.0, 20.0, now.isoformat())
    assert route.call_count == 1


@pytest.mark.asyncio
async def test_rate_limit_guard() -> None:
    """레이트 리밋이 적용됩니다. / Rate limit is enforced."""

    settings = ProviderSettings(
        name="ProviderA",
        adapter="provider_a",
        base_url="https://limit.test",
        timeout_seconds=1.0,
        retries=0,
        cache=CacheSettings(ttl_seconds=0),
        rate_limit=RateLimitSettings(requests_per_minute=1),
        units="metric",
    )
    provider = ProviderAAdapter(settings)
    now = datetime.now(timezone.utc)
    payload = {
        "current": {
            "timestamp": now.isoformat(),
            "temperature_c": 20.0,
            "marine": {
                "wind_speed_knots": 5.0,
                "wind_gust_knots": 10.0,
                "wave_height_m": 1.0,
                "visibility_nm": 5.0,
            },
        },
        "forecast_generated_at": now.isoformat(),
        "forecast_horizon_hours": 12,
        "forecast": [],
    }
    with respx.mock(base_url=settings.base_url) as mock:
        mock.get("/weather").respond(json=payload)
        await provider.fetch_weather(0.0, 0.0, now.isoformat())
        with pytest.raises(RateLimitExceededError):
            await provider.fetch_weather(0.0, 0.0, now.isoformat())


def test_circuit_breaker_cycle() -> None:
    """서킷 브레이커 사이클을 확인합니다. / Validate circuit breaker cycle."""

    settings = ProviderSettings(
        name="ProviderA",
        adapter="provider_a",
        base_url="https://cb.test",
        timeout_seconds=1.0,
        retries=0,
        cache=CacheSettings(ttl_seconds=0),
        rate_limit=RateLimitSettings(requests_per_minute=5),
        units="metric",
    )
    provider = ProviderAAdapter(settings)
    breaker = provider.circuit_breaker
    breaker.failure_threshold = 1
    breaker.record_failure()
    with pytest.raises(CircuitBreakerOpenError):
        breaker.ensure_closed()
    assert breaker.opened_at is not None
    breaker.opened_at -= breaker.reset_seconds + 1.0
    breaker.ensure_closed()
