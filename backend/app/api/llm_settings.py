from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_agent
from app.core.crypto import EncryptionNotConfigured
from app.db.session import get_db
from app.models import User
from app.schemas.user_llm_settings import (
    DEFAULT_MODEL_BY_PROVIDER,
    ModelListRequest,
    ModelListResponse,
    UserLLMSettingsRead,
    UserLLMSettingsUpdate,
)
from app.services import llm_model_catalog, user_llm_settings_service

# Every Support Agent/Admin manages their own personal LLM provider/key —
# there is no cross-user access here, only the caller's own row.
router = APIRouter(prefix="/api/me/llm-settings", tags=["llm-settings"], dependencies=[Depends(require_agent)])


@router.get("", response_model=UserLLMSettingsRead)
def get_llm_settings(agent: User = Depends(require_agent), db: Session = Depends(get_db)) -> UserLLMSettingsRead:
    return user_llm_settings_service.get_my_llm_settings(db, agent)


@router.put("", response_model=UserLLMSettingsRead)
def update_llm_settings(
    payload: UserLLMSettingsUpdate, agent: User = Depends(require_agent), db: Session = Depends(get_db)
) -> UserLLMSettingsRead:
    return user_llm_settings_service.save_my_llm_settings(db, agent, payload)


@router.get("/defaults", response_model=dict[str, str])
def get_default_models() -> dict[str, str]:
    """Suggested model name per provider, so the frontend doesn't hardcode
    these separately from app/core/config.py's own defaults."""
    return dict(DEFAULT_MODEL_BY_PROVIDER)


@router.post("/models", response_model=ModelListResponse)
def list_available_models(
    payload: ModelListRequest, agent: User = Depends(require_agent), db: Session = Depends(get_db)
) -> ModelListResponse:
    """Live model list straight from the provider's own API — validates the
    key against a real call in the process. Never returns a hardcoded model
    name. Errors come back as a 200 with `error` set so the UI can show an
    inline message instead of a thrown exception."""
    try:
        api_key = payload.api_key or user_llm_settings_service.get_my_saved_api_key(db, agent)
    except EncryptionNotConfigured as exc:
        return ModelListResponse(models=[], error=str(exc))
    if not api_key:
        return ModelListResponse(models=[], error="Enter an API key first.")
    return llm_model_catalog.fetch_models(payload.provider, api_key)
