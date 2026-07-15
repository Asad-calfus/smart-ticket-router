from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.enums import (
    AssignedTeam,
    AssignedTeamType,
    TicketCategory,
    TicketCategoryType,
    TicketPriority,
    TicketPriorityType,
)

# Bump this when routing_service's backend safeguard logic changes meaningfully,
# so persisted evidence can be traced back to the rules version that produced it.
ROUTING_RULES_VERSION = "v1"


class RoutingEvidence(Base):
    """A durable record of one routing decision: which evidence was retrieved,
    what the model/rules produced, and how long it took. Replaces the
    frontend-memory-only cache the UI used to rely on — this is what makes
    the "AI Evidence" tab survive a page reload."""

    __tablename__ = "routing_evidence"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)

    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rules_version: Mapped[str] = mapped_column(String(20), nullable=False, default=ROUTING_RULES_VERSION)

    customer_profile_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    product_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False, default=list)
    active_incident_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False, default=list)
    similar_ticket_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False, default=list)
    knowledge_document_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False, default=list)

    category: Mapped[TicketCategory] = mapped_column(TicketCategoryType, nullable=False)
    priority: Mapped[TicketPriority] = mapped_column(TicketPriorityType, nullable=False)
    assigned_team: Mapped[AssignedTeam] = mapped_column(AssignedTeamType, nullable=False)
    secondary_teams: Mapped[list[AssignedTeam]] = mapped_column(ARRAY(AssignedTeamType), nullable=False, default=list)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    needs_human_review: Mapped[bool] = mapped_column(Boolean, nullable=False)
    clarification_questions: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    routing_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Null for the mock provider (no API usage) or if the provider response
    # didn't include usage — never fabricated/estimated, only real counts.
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
