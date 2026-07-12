from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.enums import AssignedTeam, AssignedTeamType, UserRole, UserRoleType


class AgentInvitation(Base):
    """An admin-issued invite for someone to join as a Support Agent or Admin.
    Only `token_hash` (SHA-256 of the raw token) is ever stored — the raw
    token is sent to the invitee once and never persisted."""

    __tablename__ = "agent_invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(UserRoleType, nullable=False)
    team: Mapped[AssignedTeam | None] = mapped_column(AssignedTeamType, nullable=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invited_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
