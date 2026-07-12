from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import AccessStatus, AccessStatusType, SubscriptionStatus, SubscriptionStatusType


class CustomerProduct(Base):
    """Links a customer to a purchased product: their plan, subscription and access status."""

    __tablename__ = "customer_products"
    __table_args__ = (UniqueConstraint("customer_id", "product_id", name="uq_customer_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(100), nullable=False)
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(SubscriptionStatusType, nullable=False)
    access_status: Mapped[AccessStatus] = mapped_column(AccessStatusType, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="products")
    product: Mapped["Product"] = relationship(back_populates="customer_links")
