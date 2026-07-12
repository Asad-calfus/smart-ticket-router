from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.db.base_class import Base
from app.models.enums import (
    AssignedTeam,
    AssignedTeamType,
    TicketCategory,
    TicketCategoryType,
    TicketChannel,
    TicketChannelType,
    TicketPriority,
    TicketPriorityType,
    TicketStatus,
    TicketStatusType,
)


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[TicketChannel] = mapped_column(TicketChannelType, nullable=False, default=TicketChannel.EMAIL)

    # Populated once the ticket has been routed (by the AI or a human). Null until then.
    category: Mapped[TicketCategory | None] = mapped_column(TicketCategoryType, nullable=True)
    priority: Mapped[TicketPriority | None] = mapped_column(TicketPriorityType, nullable=True)
    assigned_team: Mapped[AssignedTeam | None] = mapped_column(AssignedTeamType, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    needs_human_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    status: Mapped[TicketStatus] = mapped_column(TicketStatusType, nullable=False, default=TicketStatus.OPEN)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Embedding of `message`, used for pgvector similarity search when routing later tickets.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.embedding_dim), nullable=True)
    # True only for resolved tickets whose category/priority/team/resolution a human has confirmed as correct.
    human_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Wall-clock time the routing service took to produce a result for this ticket. Null until routed.
    # Powers the "measured AI routing time" analytics metric (see /api/metrics/summary).
    routing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="tickets")
    feedback_entries: Mapped[list["RoutingFeedback"]] = relationship(back_populates="ticket")
