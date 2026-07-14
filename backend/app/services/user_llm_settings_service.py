from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_api_key, encrypt_api_key
from app.models import User, UserLLMSettings
from app.schemas.user_llm_settings import UserLLMSettingsRead, UserLLMSettingsUpdate

_NO_PERSONAL_SETTINGS = UserLLMSettingsRead(
    provider="mock", model_name="", has_api_key=False, key_last4=None, reasoning_effort=None
)


def _get_row(db: Session, user: User) -> UserLLMSettings | None:
    return db.execute(select(UserLLMSettings).where(UserLLMSettings.user_id == user.id)).scalar_one_or_none()


def get_my_llm_settings(db: Session, user: User) -> UserLLMSettingsRead:
    row = _get_row(db, user)
    if row is None:
        return _NO_PERSONAL_SETTINGS
    return UserLLMSettingsRead(
        provider=row.provider,
        model_name=row.model_name,
        has_api_key=bool(row.encrypted_api_key),
        key_last4=row.key_last4,
        reasoning_effort=row.reasoning_effort,
    )


def save_my_llm_settings(db: Session, user: User, payload: UserLLMSettingsUpdate) -> UserLLMSettingsRead:
    row = _get_row(db, user)
    if row is None:
        row = UserLLMSettings(user_id=user.id, provider=payload.provider, model_name=payload.model_name)
        db.add(row)
    else:
        row.provider = payload.provider
        row.model_name = payload.model_name

    row.reasoning_effort = payload.reasoning_effort

    if payload.api_key is not None:
        if payload.api_key == "":
            row.encrypted_api_key = None
            row.key_last4 = None
        else:
            row.encrypted_api_key = encrypt_api_key(payload.api_key)
            row.key_last4 = payload.api_key[-4:]

    db.commit()
    db.refresh(row)
    return get_my_llm_settings(db, user)


def get_my_saved_api_key(db: Session, user: User) -> str | None:
    """Decrypted key for the caller's own stored row, or None if they haven't
    saved one yet — used so "refresh models" doesn't require retyping a key
    that's already on file."""
    row = _get_row(db, user)
    if row is None or not row.encrypted_api_key:
        return None
    return decrypt_api_key(row.encrypted_api_key)
