"""설정 로딩 테스트입니다. / Configuration loading tests."""

from __future__ import annotations

from src.config import AppConfig, load_app_config


def test_load_app_config_includes_secrets(tmp_path, monkeypatch) -> None:
    """환경 시크릿을 포함합니다. / Includes env secrets."""

    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        """
providers:
  - name: ProviderA
    adapter: provider_a
    base_url: https://test
    secret_suffix: A
provider_order:
  - ProviderA
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv("WEATHER_API_KEY_A", "secret-a")
    config = load_app_config(config_path)
    assert isinstance(config, AppConfig)
    assert config.providers[0].api_key == "secret-a"
    assert config.provider_by_name("ProviderA").name == "ProviderA"
