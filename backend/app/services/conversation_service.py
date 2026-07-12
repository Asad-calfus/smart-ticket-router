from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models import AgentProfile, TicketAssignment, TicketMessage, User
from app.models.enums import MessageType
from app.schemas.conversation import TicketAssignmentRead, TicketMessageRead
from app.services import audit_service
from app.services.ticket_service import get_ticket_or_404


def _author_label(db: Session, author_user_id: int | None) -> str:
    if author_user_id is None:
        return "System"
    user = db.get(User, author_user_id)
    if user is None:
        return "Unknown"
    agent_profile = db.execute(select(AgentProfile).where(AgentProfile.user_id == user.id)).scalar_one_or_none()
    if agent_profile is not None:
        return agent_profile.display_name
    return user.email


def _to_read(db: Session, message: TicketMessage) -> TicketMessageRead:
    return TicketMessageRead(
        id=message.id,
        ticket_id=message.ticket_id,
        author_user_id=message.author_user_id,
        author_label=_author_label(db, message.author_user_id),
        message_type=message.message_type,
        body=message.body,
        created_at=message.created_at,
    )


def list_messages_for_agent(db: Session, ticket_id: int) -> list[TicketMessageRead]:
    """Full thread, including internal notes — agent/admin only."""
    get_ticket_or_404(db, ticket_id)
    stmt = select(TicketMessage).where(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at)
    return [_to_read(db, m) for m in db.execute(stmt).scalars().all()]


def list_messages_for_customer(db: Session, ticket_id: int) -> list[TicketMessageRead]:
    """Customer-visible thread — internal notes are never included."""
    get_ticket_or_404(db, ticket_id)
    stmt = (
        select(TicketMessage)
        .where(TicketMessage.ticket_id == ticket_id, TicketMessage.message_type != MessageType.INTERNAL_NOTE)
        .order_by(TicketMessage.created_at)
    )
    return [_to_read(db, m) for m in db.execute(stmt).scalars().all()]


def add_agent_message(db: Session, ticket_id: int, agent: User, body: str, message_type: MessageType) -> TicketMessageRead:
    ticket = get_ticket_or_404(db, ticket_id)
    message = TicketMessage(ticket_id=ticket.id, author_user_id=agent.id, message_type=message_type, body=body)
    db.add(message)
    db.commit()
    db.refresh(message)
    audit_service.record_event(
        db, agent, "ticket.message_added", target_type="ticket", target_id=ticket.id,
        metadata={"message_type": message_type.value},
    )
    return _to_read(db, message)


def add_customer_message(db: Session, ticket_id: int, customer_user: User, body: str) -> TicketMessageRead:
    ticket = get_ticket_or_404(db, ticket_id)
    message = TicketMessage(
        ticket_id=ticket.id, author_user_id=customer_user.id, message_type=MessageType.CUSTOMER_REPLY, body=body
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_read(db, message)


def assign_ticket(db: Session, ticket_id: int, agent_user_id: int, assigned_by: User) -> TicketAssignmentRead:
    ticket = get_ticket_or_404(db, ticket_id)
    agent_user = db.get(User, agent_user_id)
    if agent_user is None or agent_user.role.value not in ("Support Agent", "Admin"):
        raise NotFoundError(f"Agent {agent_user_id} not found.")

    ticket.assigned_agent_id = agent_user.id
    assignment = TicketAssignment(
        ticket_id=ticket.id,
        assigned_agent_id=agent_user.id,
        assigned_team=ticket.assigned_team,
        assigned_by=assigned_by.id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    audit_service.record_event(
        db, assigned_by, "ticket.assigned", target_type="ticket", target_id=ticket.id,
        metadata={"assigned_agent_id": agent_user.id},
    )

    agent_profile = db.execute(select(AgentProfile).where(AgentProfile.user_id == agent_user.id)).scalar_one_or_none()
    return TicketAssignmentRead(
        id=assignment.id,
        ticket_id=assignment.ticket_id,
        assigned_agent_id=assignment.assigned_agent_id,
        assigned_agent_name=agent_profile.display_name if agent_profile else agent_user.email,
        assigned_team=assignment.assigned_team,
        assigned_by=assignment.assigned_by,
        assigned_at=assignment.assigned_at,
    )
