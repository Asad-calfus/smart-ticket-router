from pydantic import BaseModel


class BreakdownEntry(BaseModel):
    label: str
    count: int


class DailyVolumeEntry(BaseModel):
    date: str
    count: int


class MetricsSummary(BaseModel):
    total_routed_tickets: int
    human_review_percentage: float
    accepted_ai_decisions: int
    corrected_ai_decisions: int
    avg_ai_routing_time_seconds: float | None
    estimated_manual_routing_time_seconds: float
    estimated_time_saved_seconds: float | None
    manual_routing_time_is_estimated: bool = True
    category_breakdown: list[BreakdownEntry] = []
    team_breakdown: list[BreakdownEntry] = []
    priority_breakdown: list[BreakdownEntry] = []
    daily_volume: list[DailyVolumeEntry] = []
    avg_confidence: float | None = None
