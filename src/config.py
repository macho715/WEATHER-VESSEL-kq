"""환경 및 설정 로더입니다. / Environment and configuration loader."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List

import yaml
from pydantic import Field, SecretStr, ValidationError

from .base import LogiBaseModel


class CacheSettings(LogiBaseModel):
    """캐시 관련 설정입니다. / Cache settings definition."""

    ttl_seconds: int = Field(default=300, ge=0)


class RateLimitSettings(LogiBaseModel):
    """레이트 리밋 설정입니다. / Rate limit settings definition."""

    requests_per_minute: int = Field(default=60, ge=1)


class ProviderSettings(LogiBaseModel):
    """개별 제공자 설정입니다. / Individual provider settings."""

    name: str
    base_url: str
    adapter: str
    timeout_seconds: float = Field(default=5.0, gt=0)
    retries: int = Field(default=3, ge=0)
    circuit_breaker_failures: int = Field(default=5, ge=1)
    cache: CacheSettings = Field(default_factory=CacheSettings)
    rate_limit: RateLimitSettings = Field(default_factory=RateLimitSettings)
    units: str = Field(default="metric")
    api_key: str | None = None
    secret_suffix: str | None = Field(default=None, exclude=True)


class MarineThresholds(LogiBaseModel):
    """선박 해양 한계치입니다. / Marine threshold settings."""

    max_wind_speed: float = Field(default=20.0, ge=0)
    max_wave_height: float = Field(default=3.0, ge=0)
    max_gust: float = Field(default=25.0, ge=0)
    min_visibility: float = Field(default=5.0, ge=0)


class ProviderSecret(LogiBaseModel):
    """제공자 시크릿 래퍼입니다. / Provider secret wrapper."""

    api_key: SecretStr | None = None


class AppConfig(LogiBaseModel):
    """애플리케이션 전체 설정입니다. / Application wide configuration."""

    providers: List[ProviderSettings]
    provider_order: List[str]
    marine_thresholds: MarineThresholds = Field(
        default_factory=MarineThresholds,
    )
    provenance_enabled: bool = True

    def provider_by_name(self, name: str) -> ProviderSettings:
        """이름으로 제공자를 찾습니다. / Find provider by name."""

        for provider in self.providers:
            if provider.name == name:
                return provider
        raise KeyError(f"Unknown provider: {name}")


def load_yaml_config(path: Path) -> Dict[str, Any]:
    """YAML 설정을 읽습니다. / Load YAML configuration."""

    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError("Config root must be a mapping")
    return data


def load_secrets_from_env() -> Dict[str, ProviderSecret]:
    """환경 변수에서 시크릿을 적재합니다. / Load secrets from environment."""

    mapping: Dict[str, ProviderSecret] = {}
    for suffix in ("A", "B"):
        env_key = f"WEATHER_API_KEY_{suffix}"
        raw_value = os.getenv(env_key)
        secret = SecretStr(raw_value) if raw_value else None
        mapping[suffix] = ProviderSecret(api_key=secret)
    return mapping


def merge_config(
    raw: Dict[str, Any], secrets: Dict[str, ProviderSecret]
) -> Dict[str, Any]:
    """환경과 파일 설정을 병합합니다. / Merge file config with secrets."""

    providers = raw.get("providers", [])
    for provider in providers:
        suffix = provider.get("secret_suffix")
        if suffix and suffix in secrets:
            secret_value = secrets[suffix].api_key
            if secret_value:
                provider["api_key"] = secret_value.get_secret_value()
    return raw


def load_app_config(path: Path | None = None) -> AppConfig:
    """최종 앱 설정을 반환합니다. / Return final app configuration."""

    config_path = path or Path("config.yaml")
    raw = load_yaml_config(config_path)
    secrets = load_secrets_from_env()
    merged = merge_config(raw, secrets)
    try:
        return AppConfig.model_validate(merged)
    except ValidationError as exc:  # pragma: no cover - defensive
        raise ValueError(f"Invalid configuration: {exc}") from exc
