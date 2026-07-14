from datetime import datetime

from pydantic import BaseModel

from app.schemas.ticket import ContextUsed, RoutingResult


class RoutingEvidenceRead(RoutingResult):
    """A persisted routing decision — same shape as a live RoutingResult, plus
    provenance so an agent/admin can see exactly what produced it, even after
    the browser session that triggered it is long gone."""

    provider: str
    model_name: str | None
    rules_version: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    created_at: datetime
