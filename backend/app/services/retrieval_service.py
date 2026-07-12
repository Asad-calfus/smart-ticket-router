"""RAG half of the routing context: pgvector similarity search over past
tickets and knowledge documents.

Note: the Ticket entity (per the project's data model) has no direct
product_id — a ticket's product relevance is inferred from its message text
via the embedding, not a SQL join. "Prefer the same product" from the spec is
therefore satisfied by similarity ranking (ticket text naturally mentions
product names/symptoms), while "prefer resolved" and "prefer human-verified"
are enforced directly as SQL filters/ordering.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import KnowledgeDocument, Ticket
from app.models.enums import TicketStatus

DEFAULT_SIMILAR_TICKET_LIMIT = 5
DEFAULT_KNOWLEDGE_DOCUMENT_LIMIT = 3


def find_similar_tickets(
    db: Session,
    query_embedding: list[float],
    exclude_ticket_id: int | None = None,
    limit: int = DEFAULT_SIMILAR_TICKET_LIMIT,
) -> list[Ticket]:
    """Resolved tickets most similar to `query_embedding`, human-verified ones first.

    Never returns the ticket currently being routed, and never sends the
    full ticket table anywhere — only the top `limit` rows are fetched.
    """
    stmt = select(Ticket).where(Ticket.status == TicketStatus.RESOLVED, Ticket.embedding.is_not(None))
    if exclude_ticket_id is not None:
        stmt = stmt.where(Ticket.id != exclude_ticket_id)
    stmt = stmt.order_by(Ticket.human_verified.desc(), Ticket.embedding.cosine_distance(query_embedding)).limit(limit)
    return list(db.execute(stmt).scalars().all())


def find_relevant_knowledge_documents(
    db: Session,
    query_embedding: list[float],
    limit: int = DEFAULT_KNOWLEDGE_DOCUMENT_LIMIT,
) -> list[KnowledgeDocument]:
    stmt = (
        select(KnowledgeDocument)
        .where(KnowledgeDocument.embedding.is_not(None))
        .order_by(KnowledgeDocument.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())
