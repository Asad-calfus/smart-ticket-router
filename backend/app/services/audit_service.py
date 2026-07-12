from sqlalchemy.orm import Session

from app.models import AuditEvent, User


def record_event(
    db: Session,
    actor: User | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    metadata: dict | None = None,
) -> None:
    """Appends an audit event.

    Caller is responsible for ensuring `metadata` only ever contains safe,
    non-sensitive fields — never passwords, tokens, or API keys.
    """
    db.add(
        AuditEvent(
            actor_user_id=actor.id if actor else None,
            action=action,
            target_type=target_type,
            target_id=target_id,
            event_metadata=metadata,
        )
    )
    db.commit()
