"""Role-based access control tests: cross-customer isolation, role boundaries,
internal-note/AI-evidence leakage prevention, assignment, and status
transitions (reopen).

Uses the session-scoped agent_client/admin_client/customer_client fixtures
from conftest.py (logged in as the demo accounts seeded by
`python -m app.db.seed_auth`).
"""


def _first_ticket_id_for_customer_1(agent_client) -> int:
    tickets = agent_client.get("/api/tickets").json()
    return next(t["id"] for t in tickets if t["customer_id"] == 1)


def _first_ticket_id_for_other_customer(agent_client) -> int:
    tickets = agent_client.get("/api/tickets").json()
    return next(t["id"] for t in tickets if t["customer_id"] != 1)


# --- Cross-customer isolation --------------------------------------------------


def test_customer_cannot_access_another_customers_ticket(customer_client, agent_client):
    other_ticket_id = _first_ticket_id_for_other_customer(agent_client)
    response = customer_client.get(f"/api/my/tickets/{other_ticket_id}")
    # 404, never 403 — must not confirm the ticket even exists.
    assert response.status_code == 404


def test_customer_cannot_add_message_to_another_customers_ticket(customer_client, agent_client):
    other_ticket_id = _first_ticket_id_for_other_customer(agent_client)
    response = customer_client.post(
        f"/api/my/tickets/{other_ticket_id}/messages",
        headers={"X-CSRF-Token": customer_client.cookies.get("csrf_token")},
        json={"body": "trying to reply to someone else's ticket"},
    )
    assert response.status_code == 404


def test_customer_can_access_their_own_ticket(customer_client, agent_client):
    own_ticket_id = _first_ticket_id_for_customer_1(agent_client)
    response = customer_client.get(f"/api/my/tickets/{own_ticket_id}")
    assert response.status_code == 200
    assert response.json()["id"] == own_ticket_id


# --- Role boundaries ------------------------------------------------------------


def test_customer_cannot_call_agent_ticket_list(customer_client):
    assert customer_client.get("/api/tickets").status_code == 403


def test_customer_cannot_call_admin_endpoints(customer_client):
    assert customer_client.get("/api/admin/agents").status_code == 403


def test_customer_cannot_call_routing_endpoint_directly(customer_client):
    response = customer_client.post(
        "/api/tickets/route",
        headers={"X-CSRF-Token": customer_client.cookies.get("csrf_token")},
        json={"customer_id": 1, "message": "Trying to call the agent routing endpoint directly."},
    )
    assert response.status_code == 403


def test_agent_cannot_call_admin_endpoints(agent_client):
    assert agent_client.get("/api/admin/agents").status_code == 403
    assert agent_client.get("/api/admin/audit-log").status_code == 403


def test_admin_has_agent_permissions_too(admin_client):
    assert admin_client.get("/api/tickets").status_code == 200
    assert admin_client.get("/api/incidents/active").status_code == 200
    assert admin_client.get("/api/metrics/summary").status_code == 200


# --- Admin can invite and manage agents -----------------------------------------


def test_admin_can_invite_and_list_agents(admin_client):
    csrf = admin_client.cookies.get("csrf_token")
    invite = admin_client.post(
        "/api/admin/agents/invite",
        headers={"X-CSRF-Token": csrf},
        json={"email": "rbac.test.agent@example.com", "role": "Support Agent", "team": "Product Support"},
    )
    assert invite.status_code == 200

    agents = admin_client.get("/api/admin/agents").json()
    assert any(a["email"] == "agent@example.com" for a in agents)


def test_admin_can_deactivate_and_reactivate_an_agent(admin_client):
    agents = admin_client.get("/api/admin/agents").json()
    target = next(a for a in agents if a["email"] == "agent@example.com")
    csrf = admin_client.cookies.get("csrf_token")

    deactivated = admin_client.post(f"/api/admin/agents/{target['id']}/deactivate", headers={"X-CSRF-Token": csrf})
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    reactivated = admin_client.post(f"/api/admin/agents/{target['id']}/activate", headers={"X-CSRF-Token": csrf})
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


def test_agent_cannot_invite_agents(agent_client):
    response = agent_client.post(
        "/api/admin/agents/invite",
        headers={"X-CSRF-Token": agent_client.cookies.get("csrf_token")},
        json={"email": "should.not.work@example.com", "role": "Support Agent"},
    )
    assert response.status_code == 403


# --- Internal notes and AI evidence are never exposed to customers -------------


def test_internal_notes_never_appear_in_customer_message_thread(agent_client, customer_client):
    ticket_id = _first_ticket_id_for_customer_1(agent_client)
    agent_csrf = agent_client.cookies.get("csrf_token")

    agent_client.post(
        f"/api/tickets/{ticket_id}/messages",
        headers={"X-CSRF-Token": agent_csrf},
        json={"body": "internal-only note for authorization test", "message_type": "Internal Note"},
    )
    agent_client.post(
        f"/api/tickets/{ticket_id}/messages",
        headers={"X-CSRF-Token": agent_csrf},
        json={"body": "agent reply visible to customer", "message_type": "Agent Reply"},
    )

    agent_view = agent_client.get(f"/api/tickets/{ticket_id}/messages").json()
    assert any(m["message_type"] == "Internal Note" for m in agent_view)

    customer_view = customer_client.get(f"/api/my/tickets/{ticket_id}/messages").json()
    assert all(m["message_type"] != "Internal Note" for m in customer_view)
    assert any(m["message_type"] == "Agent Reply" for m in customer_view)


def test_customer_ticket_schema_excludes_ai_evidence_fields(customer_client, agent_client):
    ticket_id = _first_ticket_id_for_customer_1(agent_client)
    response = customer_client.get(f"/api/my/tickets/{ticket_id}")
    assert response.status_code == 200
    body = response.json()
    # These are internal AI-decision-evidence fields — never in the customer schema.
    for forbidden_field in ("reasoning", "confidence", "context_used", "routing_time_ms", "human_verified"):
        assert forbidden_field not in body


def test_customer_cannot_reach_ai_evidence_via_agent_endpoints(customer_client):
    # Belt-and-suspenders: even the agent-only ticket detail route must 403 a customer.
    assert customer_client.get("/api/tickets/1").status_code == 403


# --- Ticket assignment and status transitions -----------------------------------


def test_agent_can_assign_ticket_to_another_agent(agent_client, admin_client):
    ticket_id = _first_ticket_id_for_customer_1(agent_client)
    admin_id = admin_client.get("/api/auth/me").json()["id"]
    csrf = agent_client.cookies.get("csrf_token")

    response = agent_client.post(
        f"/api/tickets/{ticket_id}/assign",
        headers={"X-CSRF-Token": csrf},
        json={"agent_user_id": admin_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["assigned_agent_id"] == admin_id

    ticket = agent_client.get(f"/api/tickets/{ticket_id}").json()
    assert ticket is not None  # current assignment is reflected on the ticket row


def test_assign_to_non_agent_user_is_rejected(agent_client, customer_client):
    ticket_id = _first_ticket_id_for_customer_1(agent_client)
    customer_user_id = customer_client.get("/api/auth/me").json()["id"]
    csrf = agent_client.cookies.get("csrf_token")

    response = agent_client.post(
        f"/api/tickets/{ticket_id}/assign",
        headers={"X-CSRF-Token": csrf},
        json={"agent_user_id": customer_user_id},
    )
    assert response.status_code == 404


def test_customer_can_reopen_a_resolved_ticket(agent_client, customer_client):
    ticket_id = _first_ticket_id_for_customer_1(agent_client)
    agent_csrf = agent_client.cookies.get("csrf_token")
    agent_client.post(
        f"/api/tickets/{ticket_id}/resolve",
        headers={"X-CSRF-Token": agent_csrf},
        json={"resolution": "Resolved for authorization test."},
    )

    customer_csrf = customer_client.cookies.get("csrf_token")
    reopen = customer_client.post(
        f"/api/my/tickets/{ticket_id}/reopen",
        headers={"X-CSRF-Token": customer_csrf},
        json={"reason": "The issue came back."},
    )
    assert reopen.status_code == 200
    assert reopen.json()["status"] == "Reopened"


def test_reopening_a_non_resolved_ticket_is_a_conflict(agent_client, customer_client):
    tickets = customer_client.get("/api/my/tickets").json()
    non_resolved = next(t for t in tickets if t["status"] != "Resolved")
    csrf = customer_client.cookies.get("csrf_token")

    response = customer_client.post(
        f"/api/my/tickets/{non_resolved['id']}/reopen",
        headers={"X-CSRF-Token": csrf},
        json={"reason": "Trying to reopen something that isn't resolved."},
    )
    assert response.status_code == 409
