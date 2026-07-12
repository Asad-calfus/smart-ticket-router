from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_agent
from app.db.session import get_db
from app.schemas.metrics import MetricsSummary
from app.services.metrics_service import get_metrics_summary

router = APIRouter(prefix="/api/metrics", tags=["metrics"], dependencies=[Depends(require_agent)])


@router.get("/summary", response_model=MetricsSummary)
def metrics_summary(db: Session = Depends(get_db)) -> MetricsSummary:
    return get_metrics_summary(db)
