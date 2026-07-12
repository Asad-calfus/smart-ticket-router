"""SQL-derived exact facts about a customer: profile, purchased products/access,
and any active incidents relevant to them.

This is the non-RAG half of the routing context. See
app.services.retrieval_service (Phase 4) for the vector-similarity half
(similar historical tickets and knowledge documents).
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models import Customer, CustomerProduct, Incident
from app.models.enums import IncidentStatus

ACTIVE_INCIDENT_STATUSES = (IncidentStatus.ACTIVE, IncidentStatus.MONITORING)


def get_customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise NotFoundError(f"Customer {customer_id} not found.")
    return customer


def get_customer_products(db: Session, customer_id: int) -> list[CustomerProduct]:
    stmt = select(CustomerProduct).where(CustomerProduct.customer_id == customer_id)
    return list(db.execute(stmt).scalars().all())


def get_active_incidents_for_customer(db: Session, customer: Customer, product_ids: list[int]) -> list[Incident]:
    """Active/monitoring incidents affecting one of the customer's products, in their
    region (or affecting all regions, when affected_location is null)."""
    if not product_ids:
        return []
    stmt = select(Incident).where(
        Incident.product_id.in_(product_ids),
        Incident.status.in_(ACTIVE_INCIDENT_STATUSES),
        (Incident.affected_location.is_(None)) | (Incident.affected_location == customer.location),
    )
    return list(db.execute(stmt).scalars().all())


def get_customer_ids_with_active_incidents(db: Session) -> set[int]:
    """Customer IDs affected by at least one active/monitoring incident.

    Powers the "Active Incident" ticket-queue filter.
    """
    stmt = (
        select(CustomerProduct.customer_id)
        .join(Incident, Incident.product_id == CustomerProduct.product_id)
        .join(Customer, Customer.id == CustomerProduct.customer_id)
        .where(
            Incident.status.in_(ACTIVE_INCIDENT_STATUSES),
            (Incident.affected_location.is_(None)) | (Incident.affected_location == Customer.location),
        )
    )
    return set(db.execute(stmt).scalars().all())


@dataclass
class CustomerContext:
    customer: Customer
    products: list[CustomerProduct] = field(default_factory=list)
    active_incidents: list[Incident] = field(default_factory=list)


def build_customer_context(db: Session, customer_id: int) -> CustomerContext:
    customer = get_customer_or_404(db, customer_id)
    products = get_customer_products(db, customer_id)
    product_ids = [p.product_id for p in products]
    active_incidents = get_active_incidents_for_customer(db, customer, product_ids)
    return CustomerContext(customer=customer, products=products, active_incidents=active_incidents)
