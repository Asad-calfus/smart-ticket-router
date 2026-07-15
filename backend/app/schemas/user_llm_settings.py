from typing import Literal

from pydantic import BaseModel

LLMProviderName = Literal["mock", "anthropic", "openai", "groq"]

# Sensible starting model per provider, shown as a placeholder/default in the
# settings form — mirrors app/core/config.py's own defaults.
DEFAULT_MODEL_BY_PROVIDER: dict[LLMProviderName, str] = {
    "mock": "",
    "anthropic": "claude-sonnet-5",
    "openai": "gpt-4o-mini",
    "groq": "openai/gpt-oss-120b",
}

# Which reasoning/thinking-effort levels a model family supports, matched by
# id prefix (checked longest-prefix-first). Empty/absent = no reasoning
# control shown for that model. THIS IS THE ONE PLACE TO UPDATE WHEN A NEW
# MODEL FAMILY WITH A DIFFERENT REASONING API SHIPS — model *names* themselves
# are never hardcoded, only these family-level capability groupings.
REASONING_LEVELS_BY_PREFIX: dict[str, list[str]] = {
    "gpt-5": ["minimal", "low", "medium", "high"],
    "o3": ["low", "medium", "high"],
    "o4": ["low", "medium", "high"],
    "claude-opus-4": ["low", "medium", "high"],
    "claude-sonnet-4": ["low", "medium", "high"],
    "claude-sonnet-5": ["low", "medium", "high"],
    "gpt-oss": ["low", "medium", "high"],
}


def reasoning_levels_for_model(model_id: str) -> list[str]:
    best_match = ""
    for prefix in REASONING_LEVELS_BY_PREFIX:
        if model_id.startswith(prefix) and len(prefix) > len(best_match):
            best_match = prefix
    return REASONING_LEVELS_BY_PREFIX.get(best_match, [])


class UserLLMSettingsRead(BaseModel):
    provider: LLMProviderName
    model_name: str
    has_api_key: bool
    key_last4: str | None = None
    reasoning_effort: str | None = None


class UserLLMSettingsUpdate(BaseModel):
    provider: LLMProviderName
    model_name: str
    # None/omitted = keep the existing stored key. "" = explicitly clear it.
    api_key: str | None = None
    reasoning_effort: str | None = None


class ModelInfo(BaseModel):
    id: str
    reasoning_levels: list[str] = []


class ModelListRequest(BaseModel):
    provider: LLMProviderName
    # None = reuse the caller's already-saved (decrypted) key instead of
    # re-submitting it, so "refresh models" doesn't require retyping.
    api_key: str | None = None


class ModelListResponse(BaseModel):
    models: list[ModelInfo] = []
    error: str | None = None
