"""Symmetric encryption for personal LLM API keys at rest.

Nothing else in the app needs reversible encryption (session/reset/invite
tokens are only ever one-way hashed, see app/core/security.py) — this is a
narrowly-scoped helper for app/services/user_llm_settings_service.py.
"""

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class EncryptionNotConfigured(RuntimeError):
    pass


def _fernet() -> Fernet:
    if not settings.llm_key_encryption_secret:
        raise EncryptionNotConfigured(
            "LLM_KEY_ENCRYPTION_SECRET is not set. Generate one with: "
            'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" '
            "and add it to .env before saving a personal LLM API key."
        )
    try:
        return Fernet(settings.llm_key_encryption_secret.encode("utf-8"))
    except ValueError as exc:
        raise EncryptionNotConfigured("LLM_KEY_ENCRYPTION_SECRET is not a valid Fernet key.") from exc


def encrypt_api_key(raw_api_key: str) -> str:
    return _fernet().encrypt(raw_api_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_api_key: str) -> str:
    try:
        return _fernet().decrypt(encrypted_api_key.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise EncryptionNotConfigured("Stored API key could not be decrypted with the current secret.") from exc
