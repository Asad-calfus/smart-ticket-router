"""Fetches the live list of chat-capable models from a provider's own API,
keyed off the API key the user is actually configuring — never a hardcoded
model-name list, so this can't go stale or contain a typo.

Results are cached in-process for LLM_MODEL_CACHE_TTL_SECONDS, keyed by
(provider, sha256(api_key)), so re-rendering the settings page doesn't
re-hit the provider on every request.
"""

import hashlib
import time

import anthropic
import openai

from app.schemas.user_llm_settings import LLMProviderName, ModelInfo, ModelListResponse, reasoning_levels_for_model

LLM_MODEL_CACHE_TTL_SECONDS = 3600

# id substrings that mean "not a chat/completions model" for OpenAI-shaped
# /models responses (OpenAI and Groq both use this response shape) — these
# would otherwise show up in the list and be unusable for ticket routing.
_NON_CHAT_MARKERS = (
    "embedding",
    "whisper",
    "tts",
    "dall-e",
    "moderation",
    "transcribe",
    "audio",
    "image",
    "davinci-002",
    "babbage-002",
)

_cache: dict[tuple[str, str], tuple[float, ModelListResponse]] = {}


def _cache_key(provider: str, api_key: str) -> tuple[str, str]:
    return provider, hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def _cached(provider: str, api_key: str) -> ModelListResponse | None:
    entry = _cache.get(_cache_key(provider, api_key))
    if entry is None:
        return None
    cached_at, response = entry
    if time.time() - cached_at > LLM_MODEL_CACHE_TTL_SECONDS:
        return None
    return response


def _store(provider: str, api_key: str, response: ModelListResponse) -> None:
    _cache[_cache_key(provider, api_key)] = (time.time(), response)


def _openai_shaped_models(client: openai.OpenAI) -> list[ModelInfo]:
    models = []
    for model in client.models.list():
        model_id = model.id
        if any(marker in model_id for marker in _NON_CHAT_MARKERS):
            continue
        models.append(ModelInfo(id=model_id, reasoning_levels=reasoning_levels_for_model(model_id)))
    return sorted(models, key=lambda m: m.id)


def fetch_models(provider: LLMProviderName, api_key: str, *, force_refresh: bool = False) -> ModelListResponse:
    if provider == "mock":
        return ModelListResponse(models=[])

    if not force_refresh:
        cached = _cached(provider, api_key)
        if cached is not None:
            return cached

    try:
        if provider == "openai":
            models = _openai_shaped_models(openai.OpenAI(api_key=api_key))
        elif provider == "groq":
            models = _openai_shaped_models(openai.OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1"))
        elif provider == "anthropic":
            client = anthropic.Anthropic(api_key=api_key)
            models = [
                ModelInfo(id=model.id, reasoning_levels=reasoning_levels_for_model(model.id))
                for model in client.models.list()
            ]
        else:
            return ModelListResponse(models=[], error=f"Unsupported provider: {provider}")
    except (openai.AuthenticationError, anthropic.AuthenticationError):
        return ModelListResponse(models=[], error="That API key was rejected by the provider. Double-check it.")
    except (openai.APIConnectionError, anthropic.APIConnectionError):
        return ModelListResponse(models=[], error="Couldn't reach the provider's API. Check your connection and try again.")
    except (openai.APIError, anthropic.APIError) as exc:
        return ModelListResponse(models=[], error=f"Provider returned an error: {exc.message if hasattr(exc, 'message') else exc}")

    if not models:
        return ModelListResponse(models=[], error="This key is valid but the provider returned no usable models.")

    response = ModelListResponse(models=models)
    _store(provider, api_key, response)
    return response
