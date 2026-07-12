from pydantic import BaseModel


class MetricsSummary(BaseModel):
    total_routed_tickets: int
    human_review_percentage: float
    accepted_ai_decisions: int
    corrected_ai_decisions: int
    avg_ai_routing_time_seconds: float | None
    estimated_manual_routing_time_seconds: float
    estimated_time_saved_seconds: float | None
    manual_routing_time_is_estimated: bool = True
