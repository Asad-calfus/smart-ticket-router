"""Shared pytest fixtures.

Tests run against the same local Postgres+pgvector instance used for
development (DATABASE_URL from .env) rather than a separate test database or
mocked engine — this keeps the setup simple for a portfolio project while
still exercising real pgvector/enum/FK behaviour. Run `docker compose up -d`,
apply migrations, then seed data AND demo auth accounts before running the
test suite:

    python -m app.db.seed && python -m app.db.backfill_embeddings && python -m app.db.seed_auth
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.main import app

DEMO_PASSWORD = "DemoPass123!"


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _logged_in_client(email: str) -> TestClient:
    client = TestClient(app)
    response = client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert response.status_code == 200, f"login as {email} failed: {response.text}"
    csrf_token = client.cookies.get("csrf_token")
    client.headers.update({"X-CSRF-Token": csrf_token})
    return client


@pytest.fixture(scope="session")
def agent_client() -> TestClient:
    """Authenticated as the demo Support Agent (agent@example.com).

    Session-scoped: logging in once and reusing the client across every test
    that needs it avoids tripping the login rate limiter (a real safeguard,
    not a test-only relaxation — see app/core/rate_limit.py) and is also more
    realistic (a real client doesn't re-authenticate on every request).
    """
    return _logged_in_client("agent@example.com")


@pytest.fixture(scope="session")
def admin_client() -> TestClient:
    """Authenticated as the demo Admin (admin@example.com)."""
    return _logged_in_client("admin@example.com")


@pytest.fixture(scope="session")
def customer_client() -> TestClient:
    """Authenticated as the demo Customer (customer@example.com, linked to Ananya Sharma)."""
    return _logged_in_client("customer@example.com")
