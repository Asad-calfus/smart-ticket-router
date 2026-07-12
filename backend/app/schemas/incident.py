from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import IncidentSeverity, IncidentStatus


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    product_id: int
    product_name: str
    affected_location: str | None
    severity: IncidentSeverity
    status: IncidentStatus
    started_at: datetime
    resolved_at: datetime | None
