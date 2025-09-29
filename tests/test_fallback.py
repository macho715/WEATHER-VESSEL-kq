"""폴백 체인 테스트입니다. / Fallback chain tests."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
import respx

from src.config import CacheSettings, ProviderSettings, RateLimitSettings
from src.weather.providers import (
    ProviderAAdapter,
    ProviderBAdapter,
    WeatherProviderError,
    WeatherService,
)


@pytest.mark.asyncio
async def test_fallback_uses_secondary_provider() -> None:
    """2차 제공자를 사용합니다. / Falls back to secondary provider."""

    settings_a = ProviderSettings(
        name="ProviderA",
        adapter="provider_a",
        base_url="https://fail.test",
        timeout_seconds=1.0,
        retries=1,
        cache=CacheSettings(ttl_seconds=0),
        rate_limit=RateLimitSettings(requests_per_minute=5),
        units="metric",
    )
    settings_b = ProviderSettings(
        name="ProviderB",
        adapter="provider_b",
        base_url="https://ok.test",
        timeout_seconds=1.0,
        retries=1,
        cache=CacheSettings(ttl_seconds=0),
        rate_limit=RateLimitSettings(requests_per_minute=5),
        units="metric",
    )
    provider_a = ProviderAAdapter(settings_a)
    provider_b = ProviderBAdapter(settings_b)
    service = WeatherService([provider_a, provider_b])
    now = datetime.now(timezone.utc)
    good_payload = {
        "current_timestamp": now.isoformat(),
        "current_temp_c": 21.0,
        "marine_current": {
            "wind_kts": 8.0,
            "gust_kts": 12.0,
            "wave_m": 1.2,
            "visibility_nm": 6.0,
        },
        "forecast_generated": now.isoformat(),
        "forecast_hours": 24,
        "forecast_periods": [
            {
                "ts": now.isoformat(),
                "temp_c": 21.0,
                "wind": {"kts": 8.0, "gust_kts": 12.0},
                "sea": {"wave_m": 1.2, "visibility_nm": 6.0},
            }
        ],
    }
    with respx.mock() as mock:
        mock.get("https://fail.test/weather").respond(status_code=500)
        mock.get("https://ok.test/v1/weather").respond(json=good_payload)
        snapshot = await service.fetch(0.0, 0.0, now.isoformat())
    assert snapshot.observation.provenance == "ProviderB"


@pytest.mark.asyncio
async def test_fallback_raises_when_all_fail() -> None:
    """모든 제공자 실패 시 예외입니다. / Raises when all providers fail."""

    settings = ProviderSettings(
        name="ProviderA",
        adapter="provider_a",
        base_url="https://fail-again.test",
        timeout_seconds=1.0,
        retries=0,
        cache=CacheSettings(ttl_seconds=0),
        rate_limit=RateLimitSettings(requests_per_minute=5),
        units="metric",
    )
    provider = ProviderAAdapter(settings)
    service = WeatherService([provider])
    now = datetime.now(timezone.utc)
    with respx.mock() as mock:
        mock.get("https://fail-again.test/weather").respond(status_code=500)
        with pytest.raises(WeatherProviderError):
            await service.fetch(0.0, 0.0, now.isoformat())
