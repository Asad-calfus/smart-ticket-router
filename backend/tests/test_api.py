"""API-level tests for the agent-facing endpoints added in Phase 3.

These endpoints are agent/admin-only (see app/api/deps.py), so every test
here (except /health, which needs no auth) uses the `agent_client` fixture —
a TestClient already logged in as the demo Support Agent, with its CSRF
header pre-set for mutating requests. See tests/conftest.py.
"""

from fastapi.testclient import TestClient

from app.main import app


def test_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unauthenticated_request_is_rejected():
    client = TestClient(app)
    response = client.get("/api/tickets")
    assert response.status_code == 401


def test_list_customers_returns_seeded_customers(agent_client):
    response = agent_client.get("/api/customers")
    assert response.status_code == 200
    customers = response.json()
    assert len(customers) >= 10
    assert {"id", "name", "email", "tier", "location", "preferred_language"} <= customers[0].keys()


def test_get_customer_includes_products(agent_client):
    response = agent_client.get("/api/customers/1")
    assert response.status_code == 200
    body = response.json()
    assert body["name"]
    assert isinstance(body["products"], list)
    assert len(body["products"]) >= 1
    assert {"product_name", "plan_name", "subscription_status", "access_status"} <= body["products"][0].keys()


def test_get_invalid_customer_returns_404_not_crash(agent_client):
    response = agent_client.get("/api/customers/999999")
    assert response.status_code == 404
    assert "detail" in response.json()


def test_customer_tickets_endpoint(agent_client):
    response = agent_client.get("/api/customers/1/tickets")
    assert response.status_code == 200
    tickets = response.json()
    assert all(t["customer_id"] == 1 for t in tickets)


def test_list_tickets_default_filter(agent_client):
    response = agent_client.get("/api/tickets")
    assert response.status_code == 200
    tickets = response.json()
    assert len(tickets) >= 50


def test_list_tickets_unassigned_filter_only_returns_open(agent_client):
    response = agent_client.get("/api/tickets", params={"filter": "unassigned"})
    assert response.status_code == 200
    tickets = response.json()
    assert len(tickets) >= 20
    assert all(t["status"] == "Open" for t in tickets)


def test_list_tickets_high_priority_filter(agent_client):
    response = agent_client.get("/api/tickets", params={"filter": "high_priority"})
    assert response.status_code == 200
    tickets = response.json()
    assert all(t["priority"] == "High" for t in tickets)


def test_list_tickets_invalid_filter_is_rejected(agent_client):
    response = agent_client.get("/api/tickets", params={"filter": "not-a-real-filter"})
    assert response.status_code == 422  # FastAPI query validation, not a crash
    assert "detail" in response.json()


def test_get_ticket_detail(agent_client):
    response = agent_client.get("/api/tickets/1")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == 1
    assert "customer_name" in body


def test_get_invalid_ticket_returns_404(agent_client):
    response = agent_client.get("/api/tickets/999999")
    assert response.status_code == 404


def test_active_incidents_endpoint(agent_client):
    response = agent_client.get("/api/incidents/active")
    assert response.status_code == 200
    incidents = response.json()
    assert len(incidents) >= 3
    assert all(i["status"] in ("Active", "Monitoring") for i in incidents)


def test_metrics_summary_endpoint(agent_client):
    response = agent_client.get("/api/metrics/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["total_routed_tickets"] >= 30
    assert 0 <= body["human_review_percentage"] <= 100


def test_submit_feedback_accepts_and_stores(agent_client):
    response = agent_client.post("/api/tickets/2/feedback", json={"feedback_note": "looks right"})
    assert response.status_code == 200
    body = response.json()
    assert body["ticket_id"] == 2
    assert body["final_category"] == body["ai_category"]


def test_submit_feedback_on_missing_ticket_returns_404(agent_client):
    response = agent_client.post("/api/tickets/999999/feedback", json={})
    assert response.status_code == 404
