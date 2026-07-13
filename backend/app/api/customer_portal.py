from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import require_customer
from app.db.session import get_db
from app.models import User
from app.schemas.conversation import CustomerMessageCreate, TicketMessageRead
from app.schemas.customer_portal import (
    MyProfileRead,
    MyProfileUpdate,
    MyTicketCreate,
    MyTicketRead,
    MyTicketReopenRequest,
)
from app.services import conversation_service, customer_portal_service

router = APIRouter(tags=["customer-portal"], dependencies=[Depends(require_customer)])


@router.get("/api/profile", response_model=MyProfileRead)
def get_profile(user: User = Depends(require_customer), db: Session = Depends(get_db)) -> MyProfileRead:
    return customer_portal_service.get_my_profile(db, user)


@router.patch("/api/profile", response_model=MyProfileRead)
def update_profile(
    payload: MyProfileUpdate, user: User = Depends(require_customer), db: Session = Depends(get_db)
) -> MyProfileRead:
    return customer_portal_service.update_my_profile(db, user, payload)


@router.post("/api/my/tickets", response_model=MyTicketRead, status_code=status.HTTP_202_ACCEPTED)
def create_my_ticket(
    payload: MyTicketCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> MyTicketRead:
    ticket = customer_portal_service.create_my_ticket(db, user, payload)
    background_tasks.add_task(customer_portal_service.route_created_ticket, ticket.id)
    return ticket


@router.get("/api/my/tickets", response_model=list[MyTicketRead])
def list_my_tickets(user: User = Depends(require_customer), db: Session = Depends(get_db)) -> list[MyTicketRead]:
    return customer_portal_service.list_my_tickets(db, user)


@router.get("/api/my/tickets/{ticket_id}", response_model=MyTicketRead)
def get_my_ticket(
    ticket_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)
) -> MyTicketRead:
    return customer_portal_service.get_my_ticket(db, user, ticket_id)


@router.get("/api/my/tickets/{ticket_id}/messages", response_model=list[TicketMessageRead])
def list_my_ticket_messages(
    ticket_id: int, user: User = Depends(require_customer), db: Session = Depends(get_db)
) -> list[TicketMessageRead]:
    # Ownership check first — 404s before we ever touch the message thread.
    customer_portal_service.get_my_ticket(db, user, ticket_id)
    return conversation_service.list_messages_for_customer(db, ticket_id)


@router.post("/api/my/tickets/{ticket_id}/messages", response_model=TicketMessageRead)
def add_my_ticket_message(
    ticket_id: int,
    payload: CustomerMessageCreate,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> TicketMessageRead:
    customer_portal_service.get_my_ticket(db, user, ticket_id)
    return conversation_service.add_customer_message(db, ticket_id, user, payload.body)


@router.post("/api/my/tickets/{ticket_id}/reopen", response_model=MyTicketRead)
def reopen_my_ticket(
    ticket_id: int,
    payload: MyTicketReopenRequest,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> MyTicketRead:
    return customer_portal_service.reopen_my_ticket(db, user, ticket_id, payload.reason)
