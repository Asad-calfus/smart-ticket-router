from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models import User
from app.schemas.admin import AgentInviteRequest, AgentUpdateRequest, AgentUserRead, AuditEventRead
from app.schemas.auth import GenericMessage
from app.services import admin_service

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.post("/agents/invite", response_model=GenericMessage)
def invite_agent(
    payload: AgentInviteRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> GenericMessage:
    admin_service.invite_agent(db, payload.email, payload.role, payload.team, admin)
    return GenericMessage(message="Invitation sent.")


@router.get("/agents", response_model=list[AgentUserRead])
def list_agents(db: Session = Depends(get_db)) -> list[AgentUserRead]:
    return admin_service.list_agents(db)


@router.post("/agents/{user_id}/activate", response_model=AgentUserRead)
def activate_agent(
    user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> AgentUserRead:
    return admin_service.set_agent_active(db, user_id, True, admin)


@router.post("/agents/{user_id}/deactivate", response_model=AgentUserRead)
def deactivate_agent(
    user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> AgentUserRead:
    return admin_service.set_agent_active(db, user_id, False, admin)


@router.patch("/agents/{user_id}", response_model=AgentUserRead)
def update_agent(
    user_id: int,
    payload: AgentUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AgentUserRead:
    return admin_service.update_agent(db, user_id, payload.role, payload.team, admin)


@router.get("/audit-log", response_model=list[AuditEventRead])
def audit_log(db: Session = Depends(get_db)) -> list[AuditEventRead]:
    return admin_service.list_audit_log(db)
