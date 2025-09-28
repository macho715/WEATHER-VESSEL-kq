"""날씨 제공자 어댑터입니다. / Weather provider adapters."""

from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Deque, Dict, List, Optional

import httpx
from pydantic import ConfigDict
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..base import LogiBaseModel
from ..config import ProviderSettings
from .models import (
    ForecastBundle,
    ForecastEntry,
    MarineConditions,
    WeatherObservation,
    WeatherSnapshot,
)

LOGGER = logging.getLogger("weather.providers")


class WeatherProviderError(Exception):
    """날씨 제공자 오류입니다. / Weather provider error."""


class RateLimitExceededError(WeatherProviderError):
    """레이트 리밋 초과 오류입니다. / Rate limit exceeded error."""


class CircuitBreakerOpenError(WeatherProviderError):
    """서킷 브레이커 오픈 오류입니다. / Circuit breaker open error."""


@dataclass
class CacheEntry:
    """캐시 엔트리 구조입니다. / Cache entry structure."""

    value: WeatherSnapshot
    expires_at: float


class TTLCache:
    """TTL 캐시 컨테이너입니다. / TTL cache container."""

    def __init__(self) -> None:
        self._store: Dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[WeatherSnapshot]:
        """캐시에서 값을 가져옵니다. / Retrieve value from cache."""

        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            if entry.expires_at < time.monotonic():
                self._store.pop(key, None)
                return None
            return entry.value

    async def set(
        self,
        key: str,
        value: WeatherSnapshot,
        ttl_seconds: int,
    ) -> None:
        """캐시에 값을 저장합니다. / Store value in cache."""

        async with self._lock:
            expires_at = time.monotonic() + ttl_seconds
            self._store[key] = CacheEntry(value=value, expires_at=expires_at)


class RateLimiter:
    """레이트 리밋 가드입니다. / Rate limit guard."""

    def __init__(self, capacity: int, period_seconds: float) -> None:
        self.capacity = capacity
        self.period_seconds = period_seconds
        self._events: Deque[float] = deque()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """레이트 리밋 토큰을 획득합니다. / Acquire rate limit token."""

        async with self._lock:
            now = time.monotonic()
            while self._events and now - self._events[0] > self.period_seconds:
                self._events.popleft()
            if len(self._events) >= self.capacity:
                raise RateLimitExceededError("Rate limit exceeded")
            self._events.append(now)


class CircuitBreaker(LogiBaseModel):
    """서킷 브레이커 상태입니다. / Circuit breaker state."""

    model_config = ConfigDict(
        frozen=False,
        populate_by_name=True,
        use_enum_values=True,
        validate_assignment=True,
    )
    failure_threshold: int
    reset_seconds: float
    failure_count: int = 0
    opened_at: Optional[float] = None

    def check(self) -> None:
        """서킷 상태를 확인합니다. / Check breaker state."""

        if self.opened_at is None:
            return
        if time.monotonic() - self.opened_at >= self.reset_seconds:
            self.failure_count = 0
            self.opened_at = None

    def record_failure(self) -> None:
        """실패를 기록합니다. / Record failure event."""

        self.failure_count += 1
        if self.failure_count >= self.failure_threshold:
            self.opened_at = time.monotonic()

    def record_success(self) -> None:
        """성공을 기록합니다. / Record success event."""

        self.failure_count = 0
        self.opened_at = None

    def ensure_closed(self) -> None:
        """브레이커가 닫혔는지 확인합니다. / Ensure breaker closed."""

        self.check()
        if self.opened_at is not None:
            raise CircuitBreakerOpenError("Circuit breaker is open")


class WeatherProvider(ABC):
    """날씨 제공자 인터페이스입니다. / Weather provider interface."""

    def __init__(self, settings: ProviderSettings) -> None:
        self.settings = settings
        self.cache = TTLCache()
        self.rate_limiter = RateLimiter(
            capacity=settings.rate_limit.requests_per_minute,
            period_seconds=60.0,
        )
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=settings.circuit_breaker_failures,
            reset_seconds=60.0,
        )

    @property
    def name(self) -> str:
        """제공자 이름을 돌려줍니다. / Return provider name."""

        return self.settings.name

    async def fetch_weather(
        self,
        lat: float,
        lon: float,
        when: str,
    ) -> WeatherSnapshot:
        """날씨 데이터를 조회합니다. / Fetch weather data."""

        cache_key = f"{self.name}:{lat:.4f}:{lon:.4f}:{when}"
        cached = await self.cache.get(cache_key)
        if cached:
            return cached
        self.circuit_breaker.ensure_closed()
        await self.rate_limiter.acquire()
        try:
            result = await self._request_with_retry(lat, lon, when)
        except RateLimitExceededError:
            raise
        except Exception as exc:  # pragma: no cover - defensive
            self.circuit_breaker.record_failure()
            LOGGER.exception(
                "provider_error",
                extra={"provider": self.name, "error": str(exc)},
            )
            raise WeatherProviderError(str(exc)) from exc
        else:
            self.circuit_breaker.record_success()
        await self.cache.set(
            cache_key,
            result,
            self.settings.cache.ttl_seconds,
        )
        return result

    async def _request_with_retry(
        self,
        lat: float,
        lon: float,
        when: str,
    ) -> WeatherSnapshot:
        """리트라이 포함 요청입니다. / Perform request with retry."""

        retryer = AsyncRetrying(
            wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
            stop=stop_after_attempt(self.settings.retries),
            retry=retry_if_exception_type(httpx.HTTPError),
            reraise=True,
        )
        try:
            snapshot: WeatherSnapshot | None = None
            async for attempt in retryer:
                with attempt:
                    snapshot = await self._fetch_remote(lat, lon, when)
                    break
        except RetryError as exc:
            raise WeatherProviderError(str(exc)) from exc
        if snapshot is None:  # pragma: no cover - safety net
            raise WeatherProviderError("Retry loop produced no result")
        return snapshot

    @abstractmethod
    async def _fetch_remote(
        self,
        lat: float,
        lon: float,
        when: str,
    ) -> WeatherSnapshot:
        """원격 데이터를 가져옵니다. / Fetch remote data."""


class BaseHttpProvider(WeatherProvider):
    """HTTP 기반 제공자입니다. / HTTP based provider."""

    path: str = "/weather"

    async def _fetch_remote(
        self,
        lat: float,
        lon: float,
        when: str,
    ) -> WeatherSnapshot:
        """HTTP 호출을 실행합니다. / Execute HTTP call."""

        params = self.build_params(lat, lon, when)
        timeout = httpx.Timeout(self.settings.timeout_seconds)
        headers = self.build_headers()
        async with httpx.AsyncClient(
            base_url=self.settings.base_url,
            timeout=timeout,
        ) as client:
            response = await client.get(
                self.path,
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            payload = response.json()
        return self.parse_payload(payload)

    @abstractmethod
    def build_params(self, lat: float, lon: float, when: str) -> Dict[str, Any]:
        """요청 파라미터를 구성합니다. / Build request parameters."""

    @abstractmethod
    def parse_payload(self, payload: Dict[str, Any]) -> WeatherSnapshot:
        """응답 페이로드를 파싱합니다. / Parse response payload."""

    def build_headers(self) -> Dict[str, str]:
        """요청 헤더를 작성합니다. / Build request headers."""

        headers: Dict[str, str] = {"accept": "application/json"}
        if self.settings.api_key:
            headers["authorization"] = f"Bearer {self.settings.api_key}"
        return headers


class ProviderAAdapter(BaseHttpProvider):
    """제공자 A 어댑터입니다. / Provider A adapter."""

    def build_params(self, lat: float, lon: float, when: str) -> Dict[str, Any]:
        """제공자 A 파라미터입니다. / Provider A parameters."""

        return {
            "lat": f"{lat:.4f}",
            "lon": f"{lon:.4f}",
            "time": when,
            "units": self.settings.units,
        }

    def parse_payload(self, payload: Dict[str, Any]) -> WeatherSnapshot:
        """제공자 A 응답을 변환합니다. / Transform provider A response."""

        observation_payload = payload["current"]
        marine_payload = observation_payload["marine"]
        marine = MarineConditions(
            wind_speed_knots=float(marine_payload["wind_speed_knots"]),
            wind_gust_knots=float(marine_payload["wind_gust_knots"]),
            wave_height_m=float(marine_payload["wave_height_m"]),
            visibility_nm=float(marine_payload["visibility_nm"]),
        )
        observation = WeatherObservation(
            timestamp=_parse_timestamp(observation_payload["timestamp"]),
            temperature_c=float(observation_payload["temperature_c"]),
            marine=marine,
            provenance=self.name,
        )
        forecast_entries = [
            ForecastEntry(
                timestamp=_parse_timestamp(item["timestamp"]),
                temperature_c=float(item["temperature_c"]),
                marine=MarineConditions(
                    wind_speed_knots=float(item["marine"]["wind_speed_knots"]),
                    wind_gust_knots=float(item["marine"]["wind_gust_knots"]),
                    wave_height_m=float(item["marine"]["wave_height_m"]),
                    visibility_nm=float(item["marine"]["visibility_nm"]),
                ),
            )
            for item in payload["forecast"]
        ]
        bundle = ForecastBundle(
            generated_at=_parse_timestamp(payload["forecast_generated_at"]),
            horizon=_parse_horizon(payload["forecast_horizon_hours"]),
            entries=forecast_entries,
            provenance=self.name,
        )
        return WeatherSnapshot(observation=observation, forecast=bundle)


class ProviderBAdapter(BaseHttpProvider):
    """제공자 B 어댑터입니다. / Provider B adapter."""

    path = "/v1/weather"

    def build_params(self, lat: float, lon: float, when: str) -> Dict[str, Any]:
        """제공자 B 파라미터입니다. / Provider B parameters."""

        return {
            "latitude": lat,
            "longitude": lon,
            "when": when,
        }

    def parse_payload(self, payload: Dict[str, Any]) -> WeatherSnapshot:
        """제공자 B 응답을 변환합니다. / Transform provider B response."""

        marine_payload = payload["marine_current"]
        marine = MarineConditions(
            wind_speed_knots=float(marine_payload["wind_kts"]),
            wind_gust_knots=float(marine_payload["gust_kts"]),
            wave_height_m=float(marine_payload["wave_m"]),
            visibility_nm=float(marine_payload["visibility_nm"]),
        )
        observation = WeatherObservation(
            timestamp=_parse_timestamp(payload["current_timestamp"]),
            temperature_c=float(payload["current_temp_c"]),
            marine=marine,
            provenance=self.name,
        )
        entries = [
            _build_provider_b_entry(item) for item in payload["forecast_periods"]
        ]
        bundle = ForecastBundle(
            generated_at=_parse_timestamp(payload["forecast_generated"]),
            horizon=_parse_horizon(payload["forecast_hours"]),
            entries=entries,
            provenance=self.name,
        )
        return WeatherSnapshot(observation=observation, forecast=bundle)


def _build_provider_b_entry(item: Dict[str, Any]) -> ForecastEntry:
    """제공자 B 예보 엔트리입니다. / Build provider B forecast entry."""

    wind_block = item["wind"]
    sea_block = item["sea"]
    return ForecastEntry(
        timestamp=_parse_timestamp(item["ts"]),
        temperature_c=float(item["temp_c"]),
        marine=MarineConditions(
            wind_speed_knots=float(wind_block["kts"]),
            wind_gust_knots=float(wind_block["gust_kts"]),
            wave_height_m=float(sea_block["wave_m"]),
            visibility_nm=float(sea_block["visibility_nm"]),
        ),
    )


ADAPTER_REGISTRY: Dict[str, type[WeatherProvider]] = {
    "provider_a": ProviderAAdapter,
    "provider_b": ProviderBAdapter,
}


class WeatherService:
    """날씨 서비스 파사드입니다. / Weather service facade."""

    def __init__(self, providers: List[WeatherProvider]) -> None:
        self.providers = providers

    async def fetch(self, lat: float, lon: float, when: str) -> WeatherSnapshot:
        """폴백 체인을 수행합니다. / Perform fallback chain."""

        errors: List[str] = []
        for provider in self.providers:
            try:
                LOGGER.info("provider_attempt", extra={"provider": provider.name})
                return await provider.fetch_weather(lat, lon, when)
            except WeatherProviderError as exc:
                LOGGER.warning(
                    "provider_failed",
                    extra={"provider": provider.name, "error": str(exc)},
                )
                errors.append(f"{provider.name}: {exc}")
                continue
        raise WeatherProviderError("; ".join(errors) or "All providers failed")


def _parse_timestamp(value: str) -> datetime:
    """타임스탬프를 파싱합니다. / Parse timestamp value."""

    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _parse_horizon(hours: float | int) -> timedelta:
    """예보 지평을 계산합니다. / Compute forecast horizon."""

    return timedelta(hours=float(hours))


def create_provider(settings: ProviderSettings) -> WeatherProvider:
    """설정으로 제공자를 만듭니다. / Build provider from settings."""

    try:
        adapter_cls = ADAPTER_REGISTRY[settings.adapter]
    except KeyError as exc:  # pragma: no cover - defensive
        raise ValueError(f"Unknown adapter: {settings.adapter}") from exc
    return adapter_cls(settings)
