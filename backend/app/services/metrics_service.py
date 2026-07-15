from datetime import datetime, timedelta, timezone

from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session
from sqlalchemy.types import Date

from app.models import RoutingFeedback, Ticket
from app.models.enums import TicketPriority
from app.schemas.metrics import BreakdownEntry, DailyVolumeEntry, MetricsSummary

# Rough industry-standard assumption for how long a human agent takes to manually
# triage and route one ticket (read the message, check the account, decide category/
# priority/team). This is an ESTIMATE, never a measurement — see MetricsSummary.
ESTIMATED_MANUAL_ROUTING_SECONDS = 240.0

DAILY_VOLUME_WINDOW_DAYS = 14

_PRIORITY_ORDER = [TicketPriority.HIGH.value, TicketPriority.MEDIUM.value, TicketPriority.LOW.value]


def _grouped_counts(db: Session, column) -> list[BreakdownEntry]:
    rows = db.execute(
        select(column, func.count()).where(column.is_not(None)).group_by(column).order_by(func.count().desc())
    ).all()
    return [BreakdownEntry(label=getattr(label, "value", label), count=count) for label, count in rows]


def _priority_breakdown(db: Session) -> list[BreakdownEntry]:
    entries = {e.label: e.count for e in _grouped_counts(db, Ticket.priority)}
    return [BreakdownEntry(label=p, count=entries.get(p, 0)) for p in _PRIORITY_ORDER if p in entries]


def _daily_volume(db: Session) -> list[DailyVolumeEntry]:
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=DAILY_VOLUME_WINDOW_DAYS - 1)
    day_col = cast(Ticket.created_at, Date)
    rows = dict(
        db.execute(
            select(day_col, func.count()).where(day_col >= start).group_by(day_col).order_by(day_col)
        ).all()
    )
    return [
        DailyVolumeEntry(date=(start + timedelta(days=i)).isoformat(), count=rows.get(start + timedelta(days=i), 0))
        for i in range(DAILY_VOLUME_WINDOW_DAYS)
    ]


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

    avg_confidence = db.scalar(select(func.avg(Ticket.confidence)).where(Ticket.confidence.is_not(None)))

    return MetricsSummary(
        total_routed_tickets=total_routed,
        human_review_percentage=round(human_review_percentage, 1),
        accepted_ai_decisions=accepted,
        corrected_ai_decisions=corrected,
        avg_ai_routing_time_seconds=avg_routing_seconds,
        estimated_manual_routing_time_seconds=ESTIMATED_MANUAL_ROUTING_SECONDS,
        estimated_time_saved_seconds=time_saved,
        category_breakdown=_grouped_counts(db, Ticket.category),
        team_breakdown=_grouped_counts(db, Ticket.assigned_team),
        priority_breakdown=_priority_breakdown(db),
        daily_volume=_daily_volume(db),
        avg_confidence=round(float(avg_confidence), 3) if avg_confidence is not None else None,
    )
