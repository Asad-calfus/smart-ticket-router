from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import (
    AssignedTeam,
    AssignedTeamType,
    TicketCategory,
    TicketCategoryType,
    TicketPriority,
    TicketPriorityType,
)


class RoutingFeedback(Base):
    """Records what a human agent accepted or corrected after an AI routing decision."""

    __tablename__ = "routing_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)

    ai_category: Mapped[TicketCategory | None] = mapped_column(TicketCategoryType, nullable=True)
    ai_priority: Mapped[TicketPriority | None] = mapped_column(TicketPriorityType, nullable=True)
    ai_assigned_team: Mapped[AssignedTeam | None] = mapped_column(AssignedTeamType, nullable=True)

    final_category: Mapped[TicketCategory | None] = mapped_column(TicketCategoryType, nullable=True)
    final_priority: Mapped[TicketPriority | None] = mapped_column(TicketPriorityType, nullable=True)
    final_assigned_team: Mapped[AssignedTeam | None] = mapped_column(AssignedTeamType, nullable=True)

    feedback_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticket: Mapped["Ticket"] = relationship(back_populates="feedback_entries")
