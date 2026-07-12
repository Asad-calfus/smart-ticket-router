from pydantic import BaseModel, ConfigDict

from app.models.enums import AssignedTeam, ProductStatus


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    owning_team: AssignedTeam
    status: ProductStatus
