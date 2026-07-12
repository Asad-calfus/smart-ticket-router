from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.enums import AssignedTeam, AssignedTeamType


class TicketAssignment(Base):
    """Append-only assignment history. `Ticket.assigned_agent_id` holds the
    current assignment for fast lookups; this table is the audit trail of
    every assignment/reassignment."""

    __tablename__ = "ticket_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    assigned_agent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_team: Mapped[AssignedTeam | None] = mapped_column(AssignedTeamType, nullable=True)
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    unassigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
