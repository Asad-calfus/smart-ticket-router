from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class UserLLMSettings(Base):
    """A user's personal LLM provider/model/API key for ticket routing.

    Optional 1:1 override of the global env-based settings (app.core.config)
    — when a user hasn't configured one, routing falls back to the existing
    LLM_PROVIDER/*_API_KEY behavior unchanged. api_key is stored encrypted
    (see app.core.crypto) and never returned decrypted to the frontend.
    """

    __tablename__ = "user_llm_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Last 4 chars only, stored in plaintext for display — lets the settings
    # UI show "...ab12" without ever decrypting the real key just to render it.
    key_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    # e.g. "minimal"/"low"/"medium"/"high" — only meaningful for model
    # families that support it (see REASONING_LEVELS_BY_PREFIX); ignored
    # otherwise.
    reasoning_effort: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="llm_settings")
