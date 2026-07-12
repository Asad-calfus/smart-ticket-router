"""Tests for LLM provider selection/dispatch in routing_service: proving
LLM_PROVIDER=openai is wired up correctly, that malformed OpenAI output still
triggers the existing retry+fallback path, that backend safety rules apply
regardless of which provider produced the raw result, and that mock mode
keeps working. No real network calls are made — _call_openai_llm itself is
monkeypatched, the same pattern the existing Anthropic/mock tests use.
"""

import json

from app.core.config import settings
from app.services import routing_service


def _openai_response(**overrides) -> str:
    payload = {
        "category": "Billing",
        "priority": "Medium",
        "assigned_team": "Billing Operations",
        "reasoning": "test reasoning",
        "confidence": 0.8,
        "needs_human_review": False,
        "clarification_questions": [],
    }
    payload.update(overrides)
    return json.dumps(payload)


def test_get_raw_result_dict_selects_openai_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "test-key-not-real")

    captured_prompt = {}

    def fake_call_openai(prompt):
        captured_prompt["value"] = prompt
        return _openai_response()

    monkeypatch.setattr(routing_service, "_call_openai_llm", fake_call_openai)

    result = routing_service._get_raw_result_dict("test message", "test prompt")

    assert captured_prompt["value"] == "test prompt"
    assert result["category"] == "Billing"


def test_get_raw_result_dict_ignores_openai_provider_without_api_key(monkeypatch):
    # LLM_PROVIDER=openai but no key configured -> falls back to mock, not an error.
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "")

    result = routing_service._get_raw_result_dict("broken", "unused prompt")

    assert result["category"] == "Needs Clarification"


def test_openai_provider_selected_end_to_end(agent_client, monkeypatch):
    """LLM_PROVIDER=openai selects OpenAI and the result flows through the
    full routing pipeline (schema validation, backend safeguards, evidence)."""
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "test-key-not-real")

    def fake_call_openai(prompt):
        return _openai_response(
            category="Product Query",
            priority="Low",
            assigned_team="Product Support",
            reasoning="Routine product question.",
            confidence=0.7,
        )

    monkeypatch.setattr(routing_service, "_call_openai_llm", fake_call_openai)

    response = agent_client.post(
        "/api/tickets/route",
        json={"customer_id": 7, "message": "Does Analytics Suite support scheduled weekly report exports?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["category"] == "Product Query"
    assert body["assigned_team"] == "Product Support"


def test_invalid_openai_output_triggers_retry_then_fallback(agent_client, monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "test-key-not-real")

    calls = {"count": 0}

    def fake_call_openai_malformed(prompt):
        calls["count"] += 1
        return "this is not valid json at all"

    monkeypatch.setattr(routing_service, "_call_openai_llm", fake_call_openai_malformed)

    response = agent_client.post(
        "/api/tickets/route",
        json={"customer_id": 1, "message": "My dashboard is broken somehow today."},
    )

    assert response.status_code == 200
    assert calls["count"] == routing_service.LLM_MAX_ATTEMPTS  # one attempt + one controlled retry
    body = response.json()
    assert body["assigned_team"] == "General Support"
    assert body["needs_human_review"] is True


def test_openai_output_missing_required_fields_triggers_fallback(agent_client, monkeypatch):
    """Syntactically valid JSON that doesn't match RoutingResult's schema
    (e.g. an invalid category) must be rejected by Pydantic validation, not
    silently accepted."""
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "test-key-not-real")

    def fake_call_openai_bad_schema(prompt):
        return json.dumps({"category": "Not A Real Category"})

    monkeypatch.setattr(routing_service, "_call_openai_llm", fake_call_openai_bad_schema)

    response = agent_client.post(
        "/api/tickets/route",
        json={"customer_id": 1, "message": "My dashboard is broken somehow today."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["assigned_team"] == "General Support"
    assert body["needs_human_review"] is True


def test_backend_safety_rules_apply_regardless_of_openai_output(agent_client, monkeypatch):
    """Even if the (mocked) OpenAI response under-prioritizes a confirmed
    security issue, the backend safeguard must still force High priority."""
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "test-key-not-real")

    def fake_call_openai_wrong_priority(prompt):
        return _openai_response(
            category="Security",
            priority="Low",  # deliberately wrong — the backend must override this
            assigned_team="Security Operations",
            confidence=0.9,
        )

    monkeypatch.setattr(routing_service, "_call_openai_llm", fake_call_openai_wrong_priority)

    response = agent_client.post(
        "/api/tickets/route",
        json={
            "customer_id": 4,
            "message": "I think someone else logged into my account from a different country.",
        },
    )

    assert response.status_code == 200
    assert response.json()["priority"] == "High"


def test_mock_mode_still_works_when_llm_provider_is_mock(agent_client):
    assert settings.llm_provider == "mock"  # sanity check on the test environment's default
    response = agent_client.post("/api/tickets/route", json={"customer_id": 5, "message": "broken"})
    assert response.status_code == 200
    assert response.json()["category"] == "Needs Clarification"
