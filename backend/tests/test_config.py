"""Tests for app.core.config.Settings — in particular the LLM/embedding
provider settings that routing_service and embedding_service dispatch on.
"""

from app.core.config import Settings, settings


def test_default_llm_provider_is_mock():
    assert settings.llm_provider == "mock"


def test_default_openai_llm_model():
    assert settings.openai_llm_model == "gpt-5-mini"


def test_openai_api_key_setting_is_shared_between_llm_and_embeddings():
    # One field backs both LLM_PROVIDER=openai and EMBEDDING_PROVIDER=openai —
    # both call the same OpenAI account, so there's only one key to configure.
    assert hasattr(settings, "openai_api_key")


def test_llm_provider_can_be_set_to_openai_via_env(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_LLM_MODEL", "gpt-5-mini")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-not-real")

    fresh_settings = Settings()

    assert fresh_settings.llm_provider == "openai"
    assert fresh_settings.openai_llm_model == "gpt-5-mini"
    assert fresh_settings.openai_api_key == "test-key-not-real"


def test_llm_provider_can_be_set_to_anthropic_via_env(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    fresh_settings = Settings()
    assert fresh_settings.llm_provider == "anthropic"


def test_llm_provider_can_be_set_to_mock_via_env(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    fresh_settings = Settings()
    assert fresh_settings.llm_provider == "mock"
