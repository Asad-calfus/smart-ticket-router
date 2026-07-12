from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.feedback import TicketFeedbackCreate, TicketFeedbackRead
from app.schemas.ticket import (
    TicketListItem,
    TicketRead,
    TicketResolveRequest,
    TicketRouteRequest,
    TicketRouteResponse,
)
from app.services import feedback_service, routing_service, ticket_service
from app.services.ticket_service import TicketQueueFilter

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("", response_model=list[TicketListItem])
def list_tickets(
    filter: TicketQueueFilter = Query(TicketQueueFilter.ALL, alias="filter"),
    db: Session = Depends(get_db),
) -> list[TicketListItem]:
    return ticket_service.list_tickets(db, queue_filter=filter)


@router.post("/route", response_model=TicketRouteResponse)
def route_ticket(payload: TicketRouteRequest, db: Session = Depends(get_db)) -> TicketRouteResponse:
    return routing_service.route_ticket_request(db, payload)


@router.get("/{ticket_id}", response_model=TicketRead)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)) -> TicketRead:
    return ticket_service.get_ticket_read(db, ticket_id)


@router.post("/{ticket_id}/feedback", response_model=TicketFeedbackRead)
def submit_feedback(
    ticket_id: int, payload: TicketFeedbackCreate, db: Session = Depends(get_db)
) -> TicketFeedbackRead:
    return feedback_service.record_feedback(db, ticket_id, payload)


@router.post("/{ticket_id}/resolve", response_model=TicketRead)
def resolve_ticket(ticket_id: int, payload: TicketResolveRequest, db: Session = Depends(get_db)) -> TicketRead:
    return ticket_service.resolve_ticket(db, ticket_id, payload.resolution)
