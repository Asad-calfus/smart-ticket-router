from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AssignedTeam, TicketCategory, TicketPriority


class TicketFeedbackCreate(BaseModel):
    """Agent decision after reviewing an AI routing recommendation.

    Omit a `final_*` field to accept the AI's value for that field as-is.
    """

    final_category: TicketCategory | None = None
    final_priority: TicketPriority | None = None
    final_assigned_team: AssignedTeam | None = None
    feedback_note: str | None = None
    send_for_human_review: bool = False


class TicketFeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    ai_category: TicketCategory | None
    ai_priority: TicketPriority | None
    ai_assigned_team: AssignedTeam | None
    final_category: TicketCategory | None
    final_priority: TicketPriority | None
    final_assigned_team: AssignedTeam | None
    feedback_note: str | None
    created_at: datetime
