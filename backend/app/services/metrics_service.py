from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import RoutingFeedback, Ticket
from app.schemas.metrics import MetricsSummary

# Rough industry-standard assumption for how long a human agent takes to manually
# triage and route one ticket (read the message, check the account, decide category/
# priority/team). This is an ESTIMATE, never a measurement — see MetricsSummary.
ESTIMATED_MANUAL_ROUTING_SECONDS = 240.0


def get_metrics_summary(db: Session) -> MetricsSummary:
    total_routed = db.scalar(select(func.count()).select_from(Ticket).where(Ticket.category.is_not(None))) or 0

    needs_review = (
        db.scalar(
            select(func.count())
            .select_from(Ticket)
            .where(Ticket.category.is_not(None), Ticket.needs_human_review.is_(True))
        )
        or 0
    )
    human_review_percentage = (needs_review / total_routed * 100.0) if total_routed else 0.0

    feedback_rows = list(db.execute(select(RoutingFeedback)).scalars().all())
    accepted = sum(
        1
        for f in feedback_rows
        if f.final_category == f.ai_category
        and f.final_priority == f.ai_priority
        and f.final_assigned_team == f.ai_assigned_team
    )
    corrected = len(feedback_rows) - accepted

    avg_routing_ms = db.scalar(select(func.avg(Ticket.routing_time_ms)).where(Ticket.routing_time_ms.is_not(None)))
    avg_routing_seconds = float(avg_routing_ms) / 1000 if avg_routing_ms is not None else None

    time_saved = (
        (ESTIMATED_MANUAL_ROUTING_SECONDS - avg_routing_seconds) if avg_routing_seconds is not None else None
    )

    return MetricsSummary(
        total_routed_tickets=total_routed,
        human_review_percentage=round(human_review_percentage, 1),
        accepted_ai_decisions=accepted,
        corrected_ai_decisions=corrected,
        avg_ai_routing_time_seconds=avg_routing_seconds,
        estimated_manual_routing_time_seconds=ESTIMATED_MANUAL_ROUTING_SECONDS,
        estimated_time_saved_seconds=time_saved,
    )
