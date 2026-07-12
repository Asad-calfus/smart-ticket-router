from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Customer
from app.schemas.customer import CustomerDetailRead, CustomerProductRead, CustomerRead
from app.schemas.incident import IncidentRead
from app.schemas.ticket import TicketRead
from app.services import context_service, ticket_service

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)) -> list[Customer]:
    return list(db.execute(select(Customer).order_by(Customer.name)).scalars().all())


@router.get("/{customer_id}", response_model=CustomerDetailRead)
def get_customer(customer_id: int, db: Session = Depends(get_db)) -> CustomerDetailRead:
    context = context_service.build_customer_context(db, customer_id)
    products = [
        CustomerProductRead(
            product_id=link.product_id,
            product_name=link.product.name,
            plan_name=link.plan_name,
            subscription_status=link.subscription_status,
            access_status=link.access_status,
            expiry_date=link.expiry_date,
        )
        for link in context.products
    ]
    active_incidents = [
        IncidentRead(
            id=incident.id,
            title=incident.title,
            description=incident.description,
            product_id=incident.product_id,
            product_name=incident.product.name,
            affected_location=incident.affected_location,
            severity=incident.severity,
            status=incident.status,
            started_at=incident.started_at,
            resolved_at=incident.resolved_at,
        )
        for incident in context.active_incidents
    ]
    return CustomerDetailRead(
        id=context.customer.id,
        name=context.customer.name,
        email=context.customer.email,
        tier=context.customer.tier,
        location=context.customer.location,
        preferred_language=context.customer.preferred_language,
        created_at=context.customer.created_at,
        products=products,
        active_incidents=active_incidents,
    )


@router.get("/{customer_id}/tickets", response_model=list[TicketRead])
def get_customer_tickets(customer_id: int, db: Session = Depends(get_db)) -> list[TicketRead]:
    context_service.get_customer_or_404(db, customer_id)
    return ticket_service.list_tickets_for_customer(db, customer_id)
