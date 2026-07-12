from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import IncidentSeverity, IncidentSeverityType, IncidentStatus, IncidentStatusType


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    # Null means the incident affects all locations.
    affected_location: Mapped[str | None] = mapped_column(String(120), nullable=True)
    severity: Mapped[IncidentSeverity] = mapped_column(IncidentSeverityType, nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(IncidentStatusType, nullable=False, default=IncidentStatus.ACTIVE)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    product: Mapped["Product"] = relationship(back_populates="incidents")
