from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_agent
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models import User
from app.models.enums import MessageType
from app.schemas.conversation import (
    AgentRosterItem,
    TicketAssignmentRead,
    TicketAssignmentRequest,
    TicketMessageCreate,
    TicketMessageRead,
)
from app.schemas.feedback import TicketFeedbackCreate, TicketFeedbackRead
from app.schemas.routing_evidence import RoutingEvidenceRead
from app.schemas.ticket import (
    TicketListItem,
    TicketRead,
    TicketResolveRequest,
    TicketRouteRequest,
    TicketRouteResponse,
)
from app.services import conversation_service, feedback_service, routing_service, ticket_service
from app.services.ticket_service import TicketQueueFilter

router = APIRouter(prefix="/api/tickets", tags=["tickets"], dependencies=[Depends(require_agent)])


@router.get("", response_model=list[TicketListItem])
def list_tickets(
    filter: TicketQueueFilter = Query(TicketQueueFilter.ALL, alias="filter"),
    db: Session = Depends(get_db),
) -> list[TicketListItem]:
    return ticket_service.list_tickets(db, queue_filter=filter)


@router.post("/route", response_model=TicketRouteResponse)
def route_ticket(
    payload: TicketRouteRequest, agent: User = Depends(require_agent), db: Session = Depends(get_db)
) -> TicketRouteResponse:
    return routing_service.route_ticket_request(db, payload, current_user=agent)


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


@router.get("/{ticket_id}/messages", response_model=list[TicketMessageRead])
def list_ticket_messages(ticket_id: int, db: Session = Depends(get_db)) -> list[TicketMessageRead]:
    """Full conversation thread, including internal notes — agent/admin only."""
    return conversation_service.list_messages_for_agent(db, ticket_id)


@router.post("/{ticket_id}/messages", response_model=TicketMessageRead)
def add_ticket_message(
    ticket_id: int, payload: TicketMessageCreate, agent: User = Depends(require_agent), db: Session = Depends(get_db)
) -> TicketMessageRead:
    message_type = MessageType.AGENT_REPLY if payload.message_type == "Agent Reply" else MessageType.INTERNAL_NOTE
    return conversation_service.add_agent_message(db, ticket_id, agent, payload.body, message_type)


@router.get("/agents/roster", response_model=list[AgentRosterItem])
def list_agent_roster(db: Session = Depends(get_db)) -> list[AgentRosterItem]:
    """Active agents/admins an agent can assign a ticket to — deliberately
    lighter-weight than the admin-only /api/admin/agents list."""
    return conversation_service.list_agent_roster(db)


@router.post("/{ticket_id}/assign", response_model=TicketAssignmentRead)
def assign_ticket(
    ticket_id: int,
    payload: TicketAssignmentRequest,
    agent: User = Depends(require_agent),
    db: Session = Depends(get_db),
) -> TicketAssignmentRead:
    return conversation_service.assign_ticket(db, ticket_id, payload.agent_user_id, agent)


@router.get("/{ticket_id}/evidence", response_model=RoutingEvidenceRead)
def get_ticket_evidence(ticket_id: int, db: Session = Depends(get_db)) -> RoutingEvidenceRead:
    """The persisted routing decision + evidence — survives a reload,
    unlike the frontend's in-memory cache of the live routing response."""
    evidence = routing_service.get_latest_evidence(db, ticket_id)
    if evidence is None:
        raise NotFoundError(f"Ticket {ticket_id} has not been routed yet.")
    return RoutingEvidenceRead(
        category=evidence.category,
        priority=evidence.priority,
        assigned_team=evidence.assigned_team,
        reasoning=evidence.reasoning,
        confidence=evidence.confidence,
        needs_human_review=evidence.needs_human_review,
        clarification_questions=evidence.clarification_questions,
        context_used={
            "customer_profile_used": evidence.customer_profile_used,
            "product_ids": evidence.product_ids,
            "active_incident_ids": evidence.active_incident_ids,
            "similar_ticket_ids": evidence.similar_ticket_ids,
            "knowledge_document_ids": evidence.knowledge_document_ids,
        },
        provider=evidence.provider,
        model_name=evidence.model_name,
        rules_version=evidence.rules_version,
        input_tokens=evidence.input_tokens,
        output_tokens=evidence.output_tokens,
        total_tokens=evidence.total_tokens,
        created_at=evidence.created_at,
    )
