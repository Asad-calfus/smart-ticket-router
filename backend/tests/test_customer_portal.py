"""Tests for the customer-facing portal: profile, ticket creation, listing,
and the mass-assignment/ownership protections around them.
"""


def test_customer_can_view_and_update_permitted_profile_fields(customer_client):
    profile = customer_client.get("/api/profile")
    assert profile.status_code == 200
    original_tier = profile.json()["tier"]

    csrf = customer_client.cookies.get("csrf_token")
    update = customer_client.patch(
        "/api/profile",
        headers={"X-CSRF-Token": csrf},
        json={"company": "Acme Corp", "phone": "555-0100"},
    )
    assert update.status_code == 200
    body = update.json()
    assert body["company"] == "Acme Corp"
    assert body["phone"] == "555-0100"
    assert body["tier"] == original_tier  # untouched — tier isn't a writable field


def test_profile_update_ignores_unwritable_fields_even_if_smuggled_in_request(customer_client):
    csrf = customer_client.cookies.get("csrf_token")
    before = customer_client.get("/api/profile").json()

    # MyProfileUpdate has no `tier`/`email` field at all — extra keys are simply
    # ignored by Pydantic rather than silently mapped onto the ORM model.
    # Uses `company` (not `location`) as the control field so this test doesn't
    # mutate the shared demo customer's location, which routing/incident-match
    # tests elsewhere depend on.
    response = customer_client.patch(
        "/api/profile",
        headers={"X-CSRF-Token": csrf},
        json={"tier": "Enterprise", "email": "hijacked@example.com", "company": "Smuggled Co"},
    )
    assert response.status_code == 200
    after = response.json()
    assert after["tier"] == before["tier"]
    assert after["company"] == "Smuggled Co"  # the actually-writable field did change


from app.services import customer_portal_service


def test_customer_can_create_a_ticket_immediately_and_schedule_routing(customer_client, monkeypatch):
    routed_ticket_ids = []
    monkeypatch.setattr(customer_portal_service, "route_created_ticket", routed_ticket_ids.append)
    csrf = customer_client.cookies.get("csrf_token")
    response = customer_client.post(
        "/api/my/tickets",
        headers={"X-CSRF-Token": csrf},
        json={"message": "My dashboard has been showing a blank screen since this morning."},
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "Open"
    assert body["category"] is None
    assert body["priority"] is None
    assert routed_ticket_ids == [body["id"]]
    # Internal AI evidence fields must never appear here.
    assert "reasoning" not in body
    assert "confidence" not in body


def test_ticket_create_request_cannot_smuggle_a_different_customer_id(customer_client):
    csrf = customer_client.cookies.get("csrf_token")
    # MyTicketCreate has no customer_id field — even trying to pass one in the
    # raw JSON body has no effect; the server always derives it from the session.
    response = customer_client.post(
        "/api/my/tickets",
        headers={"X-CSRF-Token": csrf},
        json={"message": "Attempting to impersonate another customer.", "customer_id": 999},
    )
    assert response.status_code == 202
    ticket_id = response.json()["id"]

    my_tickets = customer_client.get("/api/my/tickets").json()
    assert any(t["id"] == ticket_id for t in my_tickets)


def test_list_my_tickets_only_returns_own_tickets(customer_client):
    tickets = customer_client.get("/api/my/tickets").json()
    assert len(tickets) >= 1
    # (Ownership is enforced server-side via the session's linked customer_id;
    # there is no customer_id in the response to even check against here — the
    # absence of any other customer's ticket is verified in test_authorization.py.)
