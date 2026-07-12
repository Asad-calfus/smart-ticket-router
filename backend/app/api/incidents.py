from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Incident, Product
from app.models.enums import IncidentStatus
from app.schemas.incident import IncidentRead

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("/active", response_model=list[IncidentRead])
def list_active_incidents(db: Session = Depends(get_db)) -> list[IncidentRead]:
    stmt = (
        select(Incident, Product.name)
        .join(Product, Product.id == Incident.product_id)
        .where(Incident.status.in_((IncidentStatus.ACTIVE, IncidentStatus.MONITORING)))
        .order_by(Incident.started_at.desc())
    )
    rows = db.execute(stmt).all()
    return [
        IncidentRead(
            id=incident.id,
            title=incident.title,
            description=incident.description,
            product_id=incident.product_id,
            product_name=product_name,
            affected_location=incident.affected_location,
            severity=incident.severity,
            status=incident.status,
            started_at=incident.started_at,
            resolved_at=incident.resolved_at,
        )
        for incident, product_name in rows
    ]
