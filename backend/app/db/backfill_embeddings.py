"""Compute and store embeddings for any ticket/knowledge-document rows that
don't have one yet (e.g. right after seeding).

Run with (from backend/, venv active): python -m app.db.backfill_embeddings
"""

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import KnowledgeDocument, Ticket
from app.services.embedding_service import get_embedding


def backfill() -> None:
    session = SessionLocal()
    try:
        tickets = list(session.execute(select(Ticket).where(Ticket.embedding.is_(None))).scalars().all())
        for ticket in tickets:
            ticket.embedding = get_embedding(ticket.message)

        documents = list(
            session.execute(select(KnowledgeDocument).where(KnowledgeDocument.embedding.is_(None))).scalars().all()
        )
        for document in documents:
            document.embedding = get_embedding(f"{document.title}\n{document.content}")

        session.commit()
        print(f"Backfilled embeddings for {len(tickets)} tickets and {len(documents)} knowledge documents.")
    finally:
        session.close()


if __name__ == "__main__":
    backfill()
