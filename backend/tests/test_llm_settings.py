"""Tests for per-user LLM settings: encryption round-trip, config resolution
(personal override vs. global fallback), and the /api/me/llm-settings API."""

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.core.crypto import EncryptionNotConfigured, decrypt_api_key, encrypt_api_key
from app.main import app
from app.models import User, UserLLMSettings
from app.services import routing_service


def _agent_user(db_session) -> User:
    return db_session.execute(select(User).where(User.email == "agent@example.com")).scalar_one()


def test_encrypt_decrypt_round_trip(monkeypatch):
    monkeypatch.setattr(settings, "llm_key_encryption_secret", Fernet.generate_key().decode())
    encrypted = encrypt_api_key("sk-super-secret-key")
    assert encrypted != "sk-super-secret-key"
    assert decrypt_api_key(encrypted) == "sk-super-secret-key"


def test_encrypt_raises_when_secret_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "llm_key_encryption_secret", "")
    try:
        encrypt_api_key("sk-super-secret-key")
        assert False, "expected EncryptionNotConfigured"
    except EncryptionNotConfigured:
        pass


def test_decrypt_fails_gracefully_with_wrong_secret(monkeypatch):
    monkeypatch.setattr(settings, "llm_key_encryption_secret", Fernet.generate_key().decode())
    encrypted = encrypt_api_key("sk-super-secret-key")

    monkeypatch.setattr(settings, "llm_key_encryption_secret", Fernet.generate_key().decode())
    try:
        decrypt_api_key(encrypted)
        assert False, "expected EncryptionNotConfigured"
    except EncryptionNotConfigured:
        pass


def test_resolve_llm_config_falls_back_to_global_with_no_user(db_session, monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "global-key")
    monkeypatch.setattr(settings, "groq_llm_model", "global-model")

    config = routing_service._resolve_llm_config(db_session, None)

    assert config == routing_service.LLMConfig("groq", "global-key", "global-model")


def test_resolve_llm_config_falls_back_to_global_when_user_has_no_personal_settings(db_session, monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "mock")
    user = _agent_user(db_session)

    config = routing_service._resolve_llm_config(db_session, user)

    assert config == routing_service.LLMConfig("mock", "", "")


def test_resolve_llm_config_uses_personal_settings_when_present(db_session, monkeypatch):
    monkeypatch.setattr(settings, "llm_key_encryption_secret", Fernet.generate_key().decode())
    user = _agent_user(db_session)
    row = UserLLMSettings(
        user_id=user.id,
        provider="openai",
        model_name="gpt-5-mini",
        encrypted_api_key=encrypt_api_key("sk-personal-key"),
        key_last4="-key",
    )
    db_session.add(row)
    db_session.flush()

    config = routing_service._resolve_llm_config(db_session, user)

    assert config == routing_service.LLMConfig("openai", "sk-personal-key", "gpt-5-mini")


def test_resolve_llm_config_falls_back_when_decrypt_fails(db_session, monkeypatch):
    monkeypatch.setattr(settings, "llm_key_encryption_secret", Fernet.generate_key().decode())
    user = _agent_user(db_session)
    row = UserLLMSettings(
        user_id=user.id,
        provider="openai",
        model_name="gpt-5-mini",
        encrypted_api_key=encrypt_api_key("sk-personal-key"),
        key_last4="-key",
    )
    db_session.add(row)
    db_session.flush()

    # Simulate a secret rotation that leaves the stored ciphertext undecryptable.
    monkeypatch.setattr(settings, "llm_key_encryption_secret", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "llm_provider", "mock")

    config = routing_service._resolve_llm_config(db_session, user)

    assert config == routing_service.LLMConfig("mock", "", "")


def test_llm_settings_api_round_trip(agent_client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "llm_key_encryption_secret", Fernet.generate_key().decode())
    # agent_client is session-scoped (shared demo agent) — leave the row fully
    # absent afterward so other tests relying on the global provider fallback
    # aren't affected by this test having run, regardless of ordering.
    agent = _agent_user(db_session)

    def _delete_row():
        row = db_session.execute(
            select(UserLLMSettings).where(UserLLMSettings.user_id == agent.id)
        ).scalar_one_or_none()
        if row is not None:
            db_session.delete(row)
            db_session.commit()

    _delete_row()  # in case a prior failed run left a row behind
    try:
        get_before = agent_client.get("/api/me/llm-settings")
        assert get_before.status_code == 200
        assert get_before.json() == {
            "provider": "mock",
            "model_name": "",
            "has_api_key": False,
            "key_last4": None,
            "reasoning_effort": None,
        }

        put_response = agent_client.put(
            "/api/me/llm-settings",
            json={"provider": "openai", "model_name": "gpt-5-mini", "api_key": "sk-test-1234"},
        )
        assert put_response.status_code == 200
        body = put_response.json()
        assert body["provider"] == "openai"
        assert body["model_name"] == "gpt-5-mini"
        assert body["has_api_key"] is True
        assert body["key_last4"] == "1234"
        assert "api_key" not in body
        assert "sk-test-1234" not in put_response.text

        get_after = agent_client.get("/api/me/llm-settings")
        assert get_after.json() == body

        # Omitting api_key keeps the previously stored key.
        keep_response = agent_client.put(
            "/api/me/llm-settings", json={"provider": "openai", "model_name": "gpt-5-turbo"}
        )
        assert keep_response.json()["has_api_key"] is True
        assert keep_response.json()["key_last4"] == "1234"
        assert keep_response.json()["model_name"] == "gpt-5-turbo"

        # Explicit empty string clears the key.
        clear_response = agent_client.put(
            "/api/me/llm-settings", json={"provider": "mock", "model_name": "", "api_key": ""}
        )
        assert clear_response.json() == {
            "provider": "mock",
            "model_name": "",
            "has_api_key": False,
            "key_last4": None,
            "reasoning_effort": None,
        }
    finally:
        _delete_row()


def test_llm_settings_requires_authentication():
    client = TestClient(app)
    response = client.get("/api/me/llm-settings")
    assert response.status_code == 401
