"""Tests for the embedding + pgvector retrieval services built in Phase 4.

Assumes the seeded dev database has embeddings backfilled
(`python -m app.db.seed && python -m app.db.backfill_embeddings`).
"""

from sqlalchemy import select

from app.core.config import settings
from app.models import Ticket
from app.models.enums import TicketStatus
from app.services.embedding_service import get_embedding
from app.services.retrieval_service import find_relevant_knowledge_documents, find_similar_tickets


def test_mock_embedding_has_configured_dimension():
    embedding = get_embedding("My dashboard is down")
    assert len(embedding) == settings.embedding_dim


def test_mock_embedding_is_deterministic():
    text = "Premium Dashboard is not opening for me at all this morning"
    assert get_embedding(text) == get_embedding(text)


def test_similar_tickets_only_returns_resolved_and_real_ids(db_session):
    query_embedding = get_embedding("Premium Dashboard is not opening, is something wrong?")
    results = find_similar_tickets(db_session, query_embedding, exclude_ticket_id=None, limit=5)

    assert 1 <= len(results) <= 5
    for ticket in results:
        assert ticket.status == TicketStatus.RESOLVED
        # every id returned must correspond to a real row (guards against fabricated evidence)
        assert db_session.get(Ticket, ticket.id) is not None


def test_similar_tickets_excludes_the_current_ticket(db_session):
    any_resolved = db_session.execute(select(Ticket).where(Ticket.status == TicketStatus.RESOLVED)).scalars().first()
    query_embedding = get_embedding(any_resolved.message)

    results = find_similar_tickets(db_session, query_embedding, exclude_ticket_id=any_resolved.id, limit=5)

    assert all(t.id != any_resolved.id for t in results)


def test_top_similar_ticket_is_topically_relevant(db_session):
    query_embedding = get_embedding("Premium Dashboard is not opening for me at all this morning")
    results = find_similar_tickets(db_session, query_embedding, exclude_ticket_id=None, limit=5)
    assert "Dashboard" in results[0].message


def test_relevant_knowledge_documents_returns_real_ids(db_session):
    query_embedding = get_embedding("Premium Dashboard won't load, what should I check?")
    docs = find_relevant_knowledge_documents(db_session, query_embedding, limit=3)
    assert 1 <= len(docs) <= 3
    assert any("Dashboard" in doc.title for doc in docs)
