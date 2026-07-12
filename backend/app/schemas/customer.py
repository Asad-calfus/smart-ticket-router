from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AccessStatus, CustomerTier, SubscriptionStatus
from app.schemas.incident import IncidentRead


class CustomerProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    product_name: str
    plan_name: str
    subscription_status: SubscriptionStatus
    access_status: AccessStatus
    expiry_date: date | None = None


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    tier: CustomerTier
    location: str
    preferred_language: str
    created_at: datetime


class CustomerDetailRead(CustomerRead):
    products: list[CustomerProductRead] = []
    active_incidents: list[IncidentRead] = []
