from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import settings
from app.models.enums import AssignedTeam, TicketCategory, TicketChannel, TicketPriority, TicketStatus


class TicketListItem(BaseModel):
    """One row in the ticket queue (left column)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    customer_name: str
    message_preview: str
    channel: TicketChannel
    category: TicketCategory | None
    priority: TicketPriority | None
    assigned_team: AssignedTeam | None
    secondary_teams: list[AssignedTeam] = Field(default_factory=list)
    status: TicketStatus
    confidence: float | None
    needs_human_review: bool
    waiting_minutes: int
    created_at: datetime


class TicketRead(BaseModel):
    """Full ticket detail (centre column)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    customer_name: str
    message: str
    channel: TicketChannel
    category: TicketCategory | None
    priority: TicketPriority | None
    assigned_team: AssignedTeam | None
    secondary_teams: list[AssignedTeam] = Field(default_factory=list)
    reasoning: str | None
    confidence: float | None
    needs_human_review: bool
    status: TicketStatus
    resolution: str | None
    created_at: datetime
    resolved_at: datetime | None
    human_verified: bool
    routing_time_ms: int | None


class ContextUsed(BaseModel):
    """Evidence the routing decision was based on — shown to the agent as "AI Evidence"."""

    customer_profile_used: bool = False
    product_ids: list[int] = Field(default_factory=list)
    active_incident_ids: list[int] = Field(default_factory=list)
    similar_ticket_ids: list[int] = Field(default_factory=list)
    knowledge_document_ids: list[int] = Field(default_factory=list)


class RoutingResult(BaseModel):
    """Strict, validated shape the routing service must always return."""

    category: TicketCategory
    priority: TicketPriority
    assigned_team: AssignedTeam
    # Other teams whose area this ticket also touches (e.g. billing + security in one
    # message) — informational only; assigned_team remains the single owning queue.
    secondary_teams: list[AssignedTeam] = Field(default_factory=list)
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)
    needs_human_review: bool
    clarification_questions: list[str] = Field(default_factory=list)
    context_used: ContextUsed = Field(default_factory=ContextUsed)


class TicketRouteRequest(BaseModel):
    customer_id: int
    message: str
    channel: TicketChannel = TicketChannel.EMAIL
    use_context: bool = True  # False powers the "Route Without Context" comparison demo.
    # Optional: route an existing queued ticket in place instead of creating a new one.
    ticket_id: int | None = None
    # False computes and returns a result without writing it to the database — used by the
    # context-comparison demo so trying both modes doesn't clutter the ticket queue.
    persist: bool = True

    @field_validator("message")
    @classmethod
    def message_not_blank_and_within_limit(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Ticket message cannot be empty.")
        if len(stripped) > settings.max_ticket_message_length:
            raise ValueError(
                f"Ticket message is too long (max {settings.max_ticket_message_length} characters)."
            )
        return stripped


class TicketRouteResponse(RoutingResult):
    ticket_id: int
    # Provenance for this specific call — same fields RoutingEvidenceRead
    # persists, surfaced immediately so the UI doesn't need a reload/refetch
    # to show which provider/model handled this ticket and what it cost.
    provider: str
    model_name: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None


class TicketResolveRequest(BaseModel):
    resolution: str
