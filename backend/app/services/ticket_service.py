import enum
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models import Customer, Ticket
from app.models.enums import TicketPriority, TicketStatus
from app.schemas.ticket import TicketListItem, TicketRead
from app.services.context_service import get_customer_ids_with_active_incidents

MESSAGE_PREVIEW_LENGTH = 80


class TicketQueueFilter(str, enum.Enum):
    ALL = "all"
    UNASSIGNED = "unassigned"
    HIGH_PRIORITY = "high_priority"
    NEEDS_HUMAN_REVIEW = "needs_human_review"
    ACTIVE_INCIDENT = "active_incident"


def get_ticket_or_404(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise NotFoundError(f"Ticket {ticket_id} not found.")
    return ticket


def _preview(message: str) -> str:
    stripped = " ".join(message.strip().split())
    if len(stripped) <= MESSAGE_PREVIEW_LENGTH:
        return stripped
    return stripped[:MESSAGE_PREVIEW_LENGTH].rstrip() + "..."


def _waiting_minutes(created_at: datetime) -> int:
    now = datetime.now(timezone.utc)
    created = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    return max(0, int((now - created).total_seconds() // 60))


def to_ticket_list_item(ticket: Ticket, customer_name: str) -> TicketListItem:
    return TicketListItem(
        id=ticket.id,
        customer_id=ticket.customer_id,
        customer_name=customer_name,
        message_preview=_preview(ticket.message),
        channel=ticket.channel,
        category=ticket.category,
        priority=ticket.priority,
        assigned_team=ticket.assigned_team,
        status=ticket.status,
        confidence=ticket.confidence,
        needs_human_review=ticket.needs_human_review,
        waiting_minutes=_waiting_minutes(ticket.created_at),
        created_at=ticket.created_at,
    )


def to_ticket_read(ticket: Ticket, customer_name: str) -> TicketRead:
    return TicketRead(
        id=ticket.id,
        customer_id=ticket.customer_id,
        customer_name=customer_name,
        message=ticket.message,
        channel=ticket.channel,
        category=ticket.category,
        priority=ticket.priority,
        assigned_team=ticket.assigned_team,
        reasoning=ticket.reasoning,
        confidence=ticket.confidence,
        needs_human_review=ticket.needs_human_review,
        status=ticket.status,
        resolution=ticket.resolution,
        created_at=ticket.created_at,
        resolved_at=ticket.resolved_at,
        human_verified=ticket.human_verified,
        routing_time_ms=ticket.routing_time_ms,
    )


def list_tickets(db: Session, queue_filter: TicketQueueFilter = TicketQueueFilter.ALL) -> list[TicketListItem]:
    stmt = select(Ticket, Customer.name).join(Customer, Customer.id == Ticket.customer_id)

    if queue_filter == TicketQueueFilter.UNASSIGNED:
        stmt = stmt.where(Ticket.status == TicketStatus.OPEN)
    elif queue_filter == TicketQueueFilter.HIGH_PRIORITY:
        stmt = stmt.where(Ticket.priority == TicketPriority.HIGH)
    elif queue_filter == TicketQueueFilter.NEEDS_HUMAN_REVIEW:
        stmt = stmt.where(Ticket.needs_human_review.is_(True))
    elif queue_filter == TicketQueueFilter.ACTIVE_INCIDENT:
        customer_ids = get_customer_ids_with_active_incidents(db)
        if not customer_ids:
            return []
        stmt = stmt.where(Ticket.customer_id.in_(customer_ids))

    stmt = stmt.order_by(Ticket.created_at.desc())
    rows = db.execute(stmt).all()
    return [to_ticket_list_item(ticket, customer_name) for ticket, customer_name in rows]


def list_tickets_for_customer(db: Session, customer_id: int) -> list[TicketRead]:
    stmt = (
        select(Ticket, Customer.name)
        .join(Customer, Customer.id == Ticket.customer_id)
        .where(Ticket.customer_id == customer_id)
        .order_by(Ticket.created_at.desc())
    )
    rows = db.execute(stmt).all()
    return [to_ticket_read(ticket, customer_name) for ticket, customer_name in rows]


def get_ticket_read(db: Session, ticket_id: int) -> TicketRead:
    ticket = get_ticket_or_404(db, ticket_id)
    customer = db.get(Customer, ticket.customer_id)
    return to_ticket_read(ticket, customer.name)


def resolve_ticket(db: Session, ticket_id: int, resolution: str) -> TicketRead:
    ticket = get_ticket_or_404(db, ticket_id)
    ticket.status = TicketStatus.RESOLVED
    ticket.resolution = resolution
    ticket.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    customer = db.get(Customer, ticket.customer_id)
    return to_ticket_read(ticket, customer.name)
