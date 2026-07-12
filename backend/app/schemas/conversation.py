from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AssignedTeam, MessageType


class TicketMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    # Agents choose which type of message they're posting; customers always
    # post CUSTOMER_REPLY (enforced server-side, not client-selectable there).
    message_type: Literal["Agent Reply", "Internal Note"] = "Agent Reply"


class CustomerMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class TicketMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    author_user_id: int | None
    author_label: str
    message_type: MessageType
    body: str
    created_at: datetime


class TicketAssignmentRequest(BaseModel):
    agent_user_id: int


class TicketAssignmentRead(BaseModel):
    id: int
    ticket_id: int
    assigned_agent_id: int | None
    assigned_agent_name: str | None
    assigned_team: AssignedTeam | None
    assigned_by: int | None
    assigned_at: datetime


class AgentRosterItem(BaseModel):
    """Minimal, non-sensitive agent info — just enough to populate an
    assignment dropdown. Deliberately excludes email/last_login/etc, which
    are only exposed via the admin-only /api/admin/agents endpoint."""

    id: int
    display_name: str
    team: AssignedTeam | None
