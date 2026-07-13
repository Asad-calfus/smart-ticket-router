"""Tests for the Phase 5 LLM routing service, run against LLM_PROVIDER=mock
(the default), so these are fast, free, and fully deterministic.

POST /api/tickets/route is agent/admin-only (customers use /api/my/tickets
instead — see test_customer_portal.py), so every test uses the `agent_client`
fixture from conftest.py.

routing_service also supports LLM_PROVIDER=anthropic and LLM_PROVIDER=openai
(real API calls) — provider selection, malformed-output retry/fallback, and
backend-safeguard behaviour under the OpenAI provider specifically are
covered in test_llm_providers.py so they don't need real network calls here.
"""

import pytest
from pydantic import ValidationError

from app.core.config import settings
from app.models.enums import AssignedTeam, TicketCategory, TicketPriority
from app.models import Ticket
from app.schemas.ticket import RoutingResult
from app.services import routing_service
from app.services.context_service import build_customer_context


def _route(client, customer_id: int, message: str, **kwargs):
    payload = {"customer_id": customer_id, "message": message, **kwargs}
    return client.post("/api/tickets/route", json=payload)


# --- Spec requirement: ten consecutive routing responses are all schema-valid ----


def test_ten_consecutive_routing_responses_are_schema_valid(agent_client):
    messages = [
        "Premium Dashboard is not opening for me at all this morning.",
        "I was charged twice for my subscription this month.",
        "Someone logged into my account from a country I've never visited.",
        "broken",
        "Does Analytics Suite support scheduled exports?",
        "I want a refund, I never used the product I was charged for.",
        "This is ridiculous, your app keeps crashing and nobody cares!!",
        "My dashboard access is suspended but I'm paid up.",
        "help",
        "What's the difference between Standard and Premium plans?",
    ]
    for message in messages:
        response = _route(agent_client, 1, message)
        assert response.status_code == 200
        body = response.json()
        # Raises if any required field is missing or malformed.
        RoutingResult.model_validate(body)
        assert {"category", "priority", "assigned_team", "reasoning", "confidence", "needs_human_review",
                "clarification_questions", "context_used", "ticket_id"} <= body.keys()


# --- Angry tone must not raise priority on its own ---------------------------


def test_angry_tone_alone_does_not_raise_priority(agent_client):
    response = _route(
        agent_client,
        8,
        "This is absolutely ridiculous!! Your mobile app has been crashing for DAYS and nobody is helping me!!",
    )
    body = response.json()
    assert body["priority"] != "High"


def test_angry_tone_with_genuine_outage_is_still_high(agent_client):
    response = _route(
        agent_client,
        3,
        "Our production Analytics Suite dashboards are COMPLETELY DOWN company-wide right now, fix it NOW!!",
    )
    body = response.json()
    assert body["priority"] == "High"


# --- "broken" -> Needs Clarification -----------------------------------------


def test_broken_message_returns_needs_clarification_with_questions(agent_client):
    response = _route(agent_client, 5, "broken")
    body = response.json()
    assert body["category"] == "Needs Clarification"
    assert body["priority"] == "Low"
    assert body["assigned_team"] == "General Support"
    assert body["needs_human_review"] is True
    assert len(body["clarification_questions"]) >= 1


def test_numeric_only_message_is_always_low_priority_even_with_high_priority_customer_context(db_session):
    # Customer 1 has both an inactive-access product and an active incident.
    # Neither is relevant when the message is only an unexplained number.
    context = build_customer_context(db_session, 1)
    unsafe_model_result = RoutingResult(
        category=TicketCategory.NEEDS_CLARIFICATION,
        priority=TicketPriority.HIGH,
        assigned_team=AssignedTeam.GENERAL_SUPPORT,
        reasoning="The numeric reference needs clarification.",
        confidence=0.25,
        needs_human_review=True,
        clarification_questions=["What does this number refer to?"],
    )

    safe_result = routing_service.apply_backend_safeguards(unsafe_model_result, "3443243", context)

    assert safe_result.category == TicketCategory.NEEDS_CLARIFICATION
    assert safe_result.priority == TicketPriority.LOW
    assert safe_result.assigned_team == AssignedTeam.GENERAL_SUPPORT
    assert safe_result.needs_human_review is True


def test_short_but_actionable_security_message_is_not_treated_as_vague():
    assert routing_service._is_vague("account hacked") is False


# --- Ambiguous ticket gives defensible reasoning -----------------------------


def test_ambiguous_billing_access_ticket_has_reasoning(agent_client):
    response = _route(agent_client, 6, "I can't log in and I think you charged me twice this month.")
    body = response.json()
    assert body["category"] in ("Billing", "Account Access")
    assert len(body["reasoning"]) > 10


# --- Known high-severity cases get High priority -----------------------------


def test_security_report_is_high_priority(agent_client):
    response = _route(agent_client, 4, "I think someone else logged into my account from a different country.")
    body = response.json()
    assert body["category"] == "Security"
    assert body["priority"] == "High"


def test_payment_deducted_access_missing_is_high_priority(agent_client):
    response = _route(
        agent_client,
        1, "My Payments Gateway plan shows active and I was charged, but I still can't access payment features."
    )
    body = response.json()
    assert body["priority"] == "High"


def test_unrelated_ticket_is_not_inflated_by_an_unrelated_access_issue(agent_client):
    # customer 6 (Priya) has an unrelated suspended-access product on file;
    # a totally unrelated product question must not inherit High priority from it.
    response = _route(agent_client, 6, "Does Analytics Suite support exporting reports directly to CSV?")
    body = response.json()
    assert body["priority"] != "High"


def test_active_regional_incident_raises_priority(agent_client):
    response = _route(agent_client, 1, "Premium Dashboard is not opening for me at all this morning.")
    body = response.json()
    assert body["priority"] == "High"
    assert len(body["context_used"]["active_incident_ids"]) >= 1


# --- Input validation ---------------------------------------------------------


def test_empty_message_returns_validation_error(agent_client):
    response = _route(agent_client, 1, "   ")
    assert response.status_code == 422


def test_too_long_message_returns_validation_error(agent_client):
    response = _route(agent_client, 1, "word " * (settings.max_ticket_message_length))
    assert response.status_code == 422


def test_invalid_customer_id_returns_404(agent_client):
    response = _route(agent_client, 999999, "My dashboard is not loading.")
    assert response.status_code == 404


# --- Consistency ---------------------------------------------------------------


def test_same_input_produces_equivalent_routing(agent_client):
    message = "Does Analytics Suite support scheduled weekly report exports?"
    first = _route(agent_client, 7, message).json()
    second = _route(agent_client, 7, message).json()
    assert first["category"] == second["category"]
    assert first["priority"] == second["priority"]
    assert first["assigned_team"] == second["assigned_team"]


# --- Evidence integrity: retrieved ids must be real rows ----------------------


def test_evidence_ids_belong_to_real_tickets(agent_client, db_session):
    response = _route(agent_client, 1, "Premium Dashboard is not opening for me at all this morning.")
    body = response.json()
    for ticket_id in body["context_used"]["similar_ticket_ids"]:
        assert db_session.get(Ticket, ticket_id) is not None


# --- Route Without Context comparison -----------------------------------------


def test_route_without_context_sends_no_customer_evidence(agent_client):
    response = _route(agent_client, 1, "Premium Dashboard is not opening for me at all this morning.", use_context=False)
    body = response.json()
    assert body["context_used"]["customer_profile_used"] is False
    assert body["context_used"]["product_ids"] == []
    assert body["context_used"]["active_incident_ids"] == []
    assert body["context_used"]["similar_ticket_ids"] == []


def test_route_without_context_misses_the_incident_boost_that_context_catches(agent_client):
    with_context = _route(
        agent_client, 1, "Premium Dashboard is not opening for me at all this morning.", use_context=True
    ).json()
    without_context = _route(
        agent_client, 1, "Premium Dashboard is not opening for me at all this morning.", use_context=False
    ).json()
    assert with_context["priority"] == "High"
    assert without_context["priority"] != "High"


# --- Failure handling: LLM failure never crashes, always falls back safely ----


def test_llm_failure_returns_safe_fallback_not_a_crash(agent_client, monkeypatch):
    def _boom(message, prompt):
        raise RuntimeError("simulated provider outage")

    monkeypatch.setattr(routing_service, "_get_raw_result_dict", _boom)
    response = _route(agent_client, 1, "My dashboard is broken somehow today.")
    assert response.status_code == 200
    body = response.json()
    assert body["assigned_team"] == "General Support"
    assert body["needs_human_review"] is True


def test_malformed_llm_output_is_retried_then_falls_back(agent_client, monkeypatch):
    calls = {"count": 0}

    def _bad_json(message, prompt):
        calls["count"] += 1
        return {"category": "Not A Real Category"}

    monkeypatch.setattr(routing_service, "_get_raw_result_dict", _bad_json)
    response = _route(agent_client, 1, "My dashboard is broken somehow today.")
    assert response.status_code == 200
    assert calls["count"] == routing_service.LLM_MAX_ATTEMPTS
    body = response.json()
    assert body["assigned_team"] == "General Support"


def test_routing_result_rejects_confidence_out_of_range():
    with pytest.raises(ValidationError):
        RoutingResult(
            category="Other",
            priority="Low",
            assigned_team="General Support",
            reasoning="test",
            confidence=1.5,
            needs_human_review=False,
        )
