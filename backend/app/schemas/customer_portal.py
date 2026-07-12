from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import (
    AssignedTeam,
    CustomerTier,
    TicketCategory,
    TicketChannel,
    TicketPriority,
    TicketStatus,
)


class MyProfileRead(BaseModel):
    email: str
    is_email_verified: bool
    name: str
    tier: CustomerTier
    location: str
    preferred_language: str
    company: str | None
    phone: str | None
    contact_preferences: str | None


class MyProfileUpdate(BaseModel):
    """Only these fields are ever writable by the customer themselves — tier,
    email and customer_id are never client-settable (mass-assignment guard)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=120)
    preferred_language: str | None = Field(default=None, max_length=60)
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    contact_preferences: str | None = Field(default=None, max_length=200)


class MyTicketCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    channel: TicketChannel = TicketChannel.PORTAL


class MyTicketRead(BaseModel):
    """Customer-facing ticket view. Deliberately excludes AI reasoning,
    confidence, routing_time_ms and human_verified — internal evidence/QA
    fields customers must never see."""

    id: int
    message: str
    channel: TicketChannel
    category: TicketCategory | None
    priority: TicketPriority | None
    assigned_team: AssignedTeam | None
    status: TicketStatus
    resolution: str | None
    created_at: datetime
    resolved_at: datetime | None


class MyTicketReopenRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)
