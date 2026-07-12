"""Shared pytest fixtures.

Tests run against the same local Postgres+pgvector instance used for
development (DATABASE_URL from .env) rather than a separate test database or
mocked engine — this keeps the setup simple for a portfolio project while
still exercising real pgvector/enum/FK behaviour. Run `docker compose up -d`
and apply migrations before running the test suite.
"""

from collections.abc import Generator

import pytest
from sqlalchemy.orm import Session

from app.db.session import SessionLocal


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
