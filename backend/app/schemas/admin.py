from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.enums import AssignedTeam, UserRole


class AgentInviteRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.SUPPORT_AGENT
    team: AssignedTeam | None = None


class AgentUserRead(BaseModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    is_email_verified: bool
    display_name: str | None
    team: AssignedTeam | None
    last_login_at: datetime | None
    created_at: datetime


class AgentUpdateRequest(BaseModel):
    role: UserRole | None = None
    team: AssignedTeam | None = None


class AuditEventRead(BaseModel):
    id: int
    actor_user_id: int | None
    actor_email: str | None
    action: str
    target_type: str | None
    target_id: int | None
    event_metadata: dict | None
    created_at: datetime
