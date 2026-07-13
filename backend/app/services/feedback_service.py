from sqlalchemy.orm import Session

from app.models import RoutingFeedback
from app.models.enums import TicketStatus
from app.schemas.feedback import TicketFeedbackCreate, TicketFeedbackRead
from app.services.ticket_service import get_ticket_or_404


def record_feedback(db: Session, ticket_id: int, payload: TicketFeedbackCreate) -> TicketFeedbackRead:
    """Store what the agent accepted or corrected, then apply the final decision to the ticket."""
    ticket = get_ticket_or_404(db, ticket_id)

    final_category = payload.final_category or ticket.category
    final_priority = payload.final_priority or ticket.priority
    final_assigned_team = payload.final_assigned_team or ticket.assigned_team

    feedback = RoutingFeedback(
        ticket_id=ticket.id,
        ai_category=ticket.category,
        ai_priority=ticket.priority,
        ai_assigned_team=ticket.assigned_team,
        final_category=final_category,
        final_priority=final_priority,
        final_assigned_team=final_assigned_team,
        feedback_note=payload.feedback_note,
    )
    db.add(feedback)

    ticket.category = final_category
    ticket.priority = final_priority
    ticket.assigned_team = final_assigned_team
    if payload.send_for_human_review:
        ticket.status = TicketStatus.NEEDS_HUMAN_REVIEW
        ticket.needs_human_review = True
    elif ticket.status != TicketStatus.RESOLVED:
        # Accepting or correcting the recommendation means an agent has taken
        # ownership of the routing decision, including when the AI originally
        # requested human review.
        ticket.status = TicketStatus.IN_PROGRESS
        ticket.needs_human_review = False

    db.commit()
    db.refresh(feedback)
    return feedback
