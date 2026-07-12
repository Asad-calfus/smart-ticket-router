from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import MessageType, MessageTypeType


class TicketMessage(Base):
    """One entry in a ticket's conversation thread (customer reply, agent
    reply, or an agent-only internal note).

    This is separate from `Ticket.message` — that field is the original
    inbound text the AI routing pipeline embeds/classifies, and is left
    untouched so the existing routing/retrieval services need no changes.
    """

    __tablename__ = "ticket_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    author_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    message_type: Mapped[MessageType] = mapped_column(MessageTypeType, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticket: Mapped["Ticket"] = relationship(back_populates="messages")
