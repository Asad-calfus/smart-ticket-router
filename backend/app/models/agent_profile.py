from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import AgentAvailability, AgentAvailabilityType, AssignedTeam, AssignedTeamType


class AgentProfile(Base):
    __tablename__ = "agent_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    team: Mapped[AssignedTeam | None] = mapped_column(AssignedTeamType, nullable=True)
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    availability_status: Mapped[AgentAvailability] = mapped_column(
        AgentAvailabilityType, nullable=False, default=AgentAvailability.AVAILABLE
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="agent_profile")
