"""Customer-facing portal logic. Every function here derives `customer_id`
from the authenticated User's linked CustomerProfile — never from anything
the client supplies — so a customer can never read or act on another
customer's data by passing a different id in a request body/query.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.db.session import SessionLocal
from app.models import Customer, CustomerProfile, Ticket, User
from app.models.enums import TicketStatus
from app.schemas.customer_portal import MyProfileRead, MyProfileUpdate, MyTicketCreate, MyTicketRead
from app.schemas.ticket import TicketRouteRequest
from app.services import routing_service
from app.services.ticket_service import get_ticket_or_404

logger = logging.getLogger("app")


def _get_profile_and_customer(db: Session, user: User) -> tuple[CustomerProfile, Customer]:
    profile = db.execute(select(CustomerProfile).where(CustomerProfile.user_id == user.id)).scalar_one_or_none()
    if profile is None or profile.customer_id is None:
        raise NotFoundError("No customer profile is linked to this account.")
    customer = db.get(Customer, profile.customer_id)
    if customer is None:
        raise NotFoundError("No customer profile is linked to this account.")
    return profile, customer


def get_my_profile(db: Session, user: User) -> MyProfileRead:
    profile, customer = _get_profile_and_customer(db, user)
    return MyProfileRead(
        email=user.email,
        is_email_verified=user.is_email_verified,
        name=customer.name,
        tier=customer.tier,
        location=customer.location,
        preferred_language=customer.preferred_language,
        company=profile.company,
        phone=profile.phone,
        contact_preferences=profile.contact_preferences,
    )


def update_my_profile(db: Session, user: User, payload: MyProfileUpdate) -> MyProfileRead:
    profile, customer = _get_profile_and_customer(db, user)

    # Explicit allow-list of writable fields — payload can never touch tier,
    # customer_id, or email regardless of what a crafted request body contains.
    if payload.name is not None:
        customer.name = payload.name
    if payload.location is not None:
        customer.location = payload.location
    if payload.preferred_language is not None:
        customer.preferred_language = payload.preferred_language
    if payload.company is not None:
        profile.company = payload.company
    if payload.phone is not None:
        profile.phone = payload.phone
    if payload.contact_preferences is not None:
        profile.contact_preferences = payload.contact_preferences

    db.commit()
    return get_my_profile(db, user)


def _to_my_ticket_read(ticket: Ticket) -> MyTicketRead:
    return MyTicketRead(
        id=ticket.id,
        message=ticket.message,
        channel=ticket.channel,
        category=ticket.category,
        priority=ticket.priority,
        assigned_team=ticket.assigned_team,
        status=ticket.status,
        resolution=ticket.resolution,
        created_at=ticket.created_at,
        resolved_at=ticket.resolved_at,
    )


def create_my_ticket(db: Session, user: User, payload: MyTicketCreate) -> MyTicketRead:
    """Persist a customer ticket immediately; AI routing happens separately.

    Keeping creation separate from routing means the customer gets a ticket ID
    without waiting for the embedding and LLM network calls.
    """
    _, customer = _get_profile_and_customer(db, user)
    ticket = Ticket(
        customer_id=customer.id,
        message=payload.message.strip(),
        channel=payload.channel,
        status=TicketStatus.OPEN,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _to_my_ticket_read(ticket)


def route_created_ticket(ticket_id: int) -> None:
    """Route a newly-created customer ticket after the HTTP response is sent.

    Background tasks must never reuse the request-scoped SQLAlchemy session,
    which is closed once the response finishes, so this function owns a fresh
    session for its entire lifetime.
    """
    db = SessionLocal()
    try:
        ticket = db.get(Ticket, ticket_id)
        if ticket is None:
            logger.warning("Background routing skipped: ticket %s no longer exists.", ticket_id)
            return
        # Idempotency guard: a retry or an agent action must not route the same
        # ticket twice once a category has already been persisted.
        if ticket.category is not None:
            return
        payload = TicketRouteRequest(
            customer_id=ticket.customer_id,
            message=ticket.message,
            channel=ticket.channel,
            ticket_id=ticket.id,
        )
        routing_service.route_ticket_request(db, payload)
    except Exception:  # noqa: BLE001 - background failures must be logged, never crash the server
        db.rollback()
        logger.exception("Background routing failed for ticket %s; it remains Open for agent triage.", ticket_id)
    finally:
        db.close()


def list_my_tickets(db: Session, user: User) -> list[MyTicketRead]:
    _, customer = _get_profile_and_customer(db, user)
    stmt = select(Ticket).where(Ticket.customer_id == customer.id).order_by(Ticket.created_at.desc())
    return [_to_my_ticket_read(t) for t in db.execute(stmt).scalars().all()]


def _get_owned_ticket(db: Session, user: User, ticket_id: int) -> Ticket:
    _, customer = _get_profile_and_customer(db, user)
    ticket = get_ticket_or_404(db, ticket_id)
    if ticket.customer_id != customer.id:
        # 404, not 403 — never confirm that a ticket id belonging to someone
        # else even exists.
        raise NotFoundError(f"Ticket {ticket_id} not found.")
    return ticket


def get_my_ticket(db: Session, user: User, ticket_id: int) -> MyTicketRead:
    ticket = _get_owned_ticket(db, user, ticket_id)
    return _to_my_ticket_read(ticket)


def reopen_my_ticket(db: Session, user: User, ticket_id: int, reason: str) -> MyTicketRead:
    ticket = _get_owned_ticket(db, user, ticket_id)
    if ticket.status != TicketStatus.RESOLVED:
        raise ConflictError("Only resolved tickets can be reopened.")
    ticket.status = TicketStatus.REOPENED
    ticket.resolved_at = None
    db.commit()
    db.refresh(ticket)
    return _to_my_ticket_read(ticket)
