"""Verifies the schema, seed data and relationships created in Phase 2.

Assumes `docker compose up -d db`, `alembic upgrade head` and
`python -m app.db.seed` have already been run.
"""

from sqlalchemy import func, select, text
from sqlalchemy.exc import DataError

from app.models import Customer, CustomerProduct, Incident, KnowledgeDocument, Product, Ticket
from app.models.enums import TicketStatus


def test_seed_minimums_are_met(db_session):
    assert db_session.scalar(select(func.count()).select_from(Customer)) >= 10
    assert db_session.scalar(select(func.count()).select_from(Product)) >= 5
    assert db_session.scalar(select(func.count()).select_from(Incident)) >= 3
    assert db_session.scalar(select(func.count()).select_from(KnowledgeDocument)) >= 3

    resolved_count = db_session.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.RESOLVED)
    )
    assert resolved_count >= 30

    open_count = db_session.scalar(select(func.count()).select_from(Ticket).where(Ticket.status == TicketStatus.OPEN))
    assert open_count >= 20


def test_resolved_tickets_have_a_verified_subset_for_rag(db_session):
    verified_resolved = db_session.scalar(
        select(func.count())
        .select_from(Ticket)
        .where(Ticket.status == TicketStatus.RESOLVED, Ticket.human_verified.is_(True))
    )
    assert verified_resolved > 0


def test_no_orphaned_foreign_keys(db_session):
    orphan_tickets = db_session.execute(
        select(func.count())
        .select_from(Ticket)
        .outerjoin(Customer, Customer.id == Ticket.customer_id)
        .where(Customer.id.is_(None))
    ).scalar_one()
    assert orphan_tickets == 0

    orphan_links = db_session.execute(
        select(func.count())
        .select_from(CustomerProduct)
        .outerjoin(Product, Product.id == CustomerProduct.product_id)
        .where(Product.id.is_(None))
    ).scalar_one()
    assert orphan_links == 0


def test_customer_product_relationship_navigates_correctly(db_session):
    customer = db_session.execute(select(Customer).where(Customer.name == "Ananya Sharma")).scalar_one()
    product_names = {link.product.name for link in customer.products}
    assert "Premium Dashboard" in product_names
    assert "Payments Gateway" in product_names


def test_invalid_enum_value_is_rejected_by_the_database(db_session):
    try:
        db_session.execute(
            text(
                "INSERT INTO customers (name, email, tier, location, preferred_language) "
                "VALUES ('Bad Enum', 'bad-enum@example.com', 'NotARealTier', 'Nowhere', 'English')"
            )
        )
        db_session.commit()
        raise AssertionError("expected the database to reject an out-of-vocabulary enum value")
    except DataError:
        db_session.rollback()
