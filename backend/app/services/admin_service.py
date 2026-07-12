from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models import AgentProfile, AuditEvent, User
from app.models.enums import AssignedTeam, UserRole
from app.schemas.admin import AgentUserRead, AuditEventRead
from app.services import audit_service, auth_service


def invite_agent(db: Session, email: str, role: UserRole, team: AssignedTeam | None, invited_by: User) -> None:
    auth_service.create_agent_invitation(db, email, role, team, invited_by)
    audit_service.record_event(
        db, invited_by, "agent.invited", target_type="invitation", metadata={"email": email, "role": role.value}
    )


def _to_agent_read(db: Session, user: User) -> AgentUserRead:
    profile = db.execute(select(AgentProfile).where(AgentProfile.user_id == user.id)).scalar_one_or_none()
    return AgentUserRead(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        display_name=profile.display_name if profile else None,
        team=profile.team if profile else None,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def list_agents(db: Session) -> list[AgentUserRead]:
    stmt = select(User).where(User.role.in_((UserRole.SUPPORT_AGENT, UserRole.ADMIN))).order_by(User.created_at)
    return [_to_agent_read(db, user) for user in db.execute(stmt).scalars().all()]


def _get_agent_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or user.role not in (UserRole.SUPPORT_AGENT, UserRole.ADMIN):
        raise NotFoundError(f"Agent {user_id} not found.")
    return user


def set_agent_active(db: Session, user_id: int, is_active: bool, actor: User) -> AgentUserRead:
    user = _get_agent_or_404(db, user_id)
    user.is_active = is_active
    db.commit()
    audit_service.record_event(
        db, actor, "user.activated" if is_active else "user.deactivated", target_type="user", target_id=user.id
    )
    return _to_agent_read(db, user)


def update_agent(
    db: Session, user_id: int, role: UserRole | None, team: AssignedTeam | None, actor: User
) -> AgentUserRead:
    user = _get_agent_or_404(db, user_id)
    changes: dict = {}

    if role is not None and role != user.role:
        if role == UserRole.CUSTOMER:
            raise ConflictError("Cannot change an agent/admin to the Customer role via this endpoint.")
        changes["role"] = {"from": user.role.value, "to": role.value}
        user.role = role

    profile = db.execute(select(AgentProfile).where(AgentProfile.user_id == user.id)).scalar_one_or_none()
    if team is not None and profile is not None and team != profile.team:
        changes["team"] = {"from": profile.team.value if profile.team else None, "to": team.value}
        profile.team = team

    db.commit()
    if changes:
        audit_service.record_event(
            db, actor, "user.role_or_team_changed", target_type="user", target_id=user.id, metadata=changes
        )
    return _to_agent_read(db, user)


def list_audit_log(db: Session, limit: int = 100) -> list[AuditEventRead]:
    stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
    events = db.execute(stmt).scalars().all()
    results = []
    for event in events:
        actor_email = None
        if event.actor_user_id is not None:
            actor = db.get(User, event.actor_user_id)
            actor_email = actor.email if actor else None
        results.append(
            AuditEventRead(
                id=event.id,
                actor_user_id=event.actor_user_id,
                actor_email=actor_email,
                action=event.action,
                target_type=event.target_type,
                target_id=event.target_id,
                event_metadata=event.event_metadata,
                created_at=event.created_at,
            )
        )
    return results
