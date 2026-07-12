from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import AssignedTeam, AssignedTeamType, ProductStatus, ProductStatusType


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    owning_team: Mapped[AssignedTeam] = mapped_column(AssignedTeamType, nullable=False)
    status: Mapped[ProductStatus] = mapped_column(ProductStatusType, nullable=False, default=ProductStatus.ACTIVE)

    customer_links: Mapped[list["CustomerProduct"]] = relationship(back_populates="product")
    incidents: Mapped[list["Incident"]] = relationship(back_populates="product")
    knowledge_documents: Mapped[list["KnowledgeDocument"]] = relationship(back_populates="product")
