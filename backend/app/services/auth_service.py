"""Signup, login, logout, sessions, password reset, email verification, and
agent-invitation acceptance.

Nothing in this module ever logs or returns a raw password, session token, or
reset/verification/invitation token — only their hashes are persisted, and
only app.core.dev_email "sends" (logs) the raw link, clearly marked dev-only.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dev_email import send_dev_email
from app.core.security import generate_token, hash_password, hash_token, normalize_email, verify_password
from app.models import AgentInvitation, AgentProfile, AuthToken, Customer, CustomerProfile, User, UserSession
from app.models.enums import AssignedTeam, CustomerTier, TokenPurpose, UserRole


class AuthError(Exception):
    """A safe-to-display auth failure (bad credentials, expired token, ...).
    The message is deliberately generic — it must never reveal *why* a
    request failed in a way that leaks whether an email/account exists."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --- Signup / login / logout -------------------------------------------------


def signup_customer(
    db: Session, email: str, password: str, name: str, location: str, preferred_language: str
) -> User:
    normalized = normalize_email(email)
    existing = db.execute(select(User).where(User.email == normalized)).scalar_one_or_none()
    if existing is not None:
        raise AuthError("Could not create an account with these details.")

    user = User(
        email=normalized,
        password_hash=hash_password(password),
        role=UserRole.CUSTOMER,
        is_active=True,
        is_email_verified=False,
    )
    db.add(user)
    db.flush()

    customer = Customer(
        name=name,
        email=normalized,
        tier=CustomerTier.FREE,
        location=location,
        preferred_language=preferred_language,
    )
    db.add(customer)
    db.flush()

    db.add(CustomerProfile(user_id=user.id, customer_id=customer.id))
    db.commit()
    db.refresh(user)

    _send_verification_email(db, user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    normalized = normalize_email(email)
    user = db.execute(select(User).where(User.email == normalized)).scalar_one_or_none()
    # Same generic failure regardless of whether the email exists or the
    # password was wrong — never distinguish the two to the caller.
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Incorrect email or password.")
    if not user.is_active:
        raise AuthError("Incorrect email or password.")
    user.last_login_at = _utcnow()
    db.commit()
    return user


def create_session(db: Session, user: User) -> tuple[str, str]:
    """Returns (raw_session_token, raw_csrf_token) — only their hashes are stored."""
    raw_session_token = generate_token()
    raw_csrf_token = generate_token()
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(raw_session_token),
            expires_at=_utcnow() + timedelta(hours=settings.session_lifetime_hours),
        )
    )
    db.commit()
    return raw_session_token, raw_csrf_token


def get_valid_session_user(db: Session, raw_session_token: str) -> User | None:
    """Looks up the session, renews its sliding expiry, and returns the user —
    or None if the token is missing/unknown/expired."""
    token_hash = hash_token(raw_session_token)
    session = db.execute(select(UserSession).where(UserSession.token_hash == token_hash)).scalar_one_or_none()
    if session is None:
        return None
    now = _utcnow()
    if session.expires_at < now:
        return None
    session.last_seen_at = now
    session.expires_at = now + timedelta(hours=settings.session_lifetime_hours)
    db.commit()
    return db.get(User, session.user_id)


def invalidate_session(db: Session, raw_session_token: str) -> None:
    token_hash = hash_token(raw_session_token)
    db.query(UserSession).filter(UserSession.token_hash == token_hash).delete()
    db.commit()


def invalidate_all_sessions(db: Session, user_id: int, except_raw_token: str | None = None) -> None:
    query = db.query(UserSession).filter(UserSession.user_id == user_id)
    if except_raw_token is not None:
        query = query.filter(UserSession.token_hash != hash_token(except_raw_token))
    query.delete()
    db.commit()


# --- Password reset / email verification -------------------------------------


def _create_token(db: Session, user: User, purpose: TokenPurpose, lifetime: timedelta) -> str:
    raw_token = generate_token()
    db.add(
        AuthToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            purpose=purpose,
            expires_at=_utcnow() + lifetime,
        )
    )
    db.commit()
    return raw_token


def _send_verification_email(db: Session, user: User) -> None:
    raw_token = _create_token(
        db, user, TokenPurpose.EMAIL_VERIFICATION,
        timedelta(hours=settings.email_verification_token_lifetime_hours),
    )
    send_dev_email(
        user.email,
        "Verify your email",
        f"Verify your account: http://localhost:5173/verify-email?token={raw_token}",
    )


def request_password_reset(db: Session, email: str) -> None:
    """Always completes successfully from the caller's perspective — never
    reveals whether the email exists. Only sends a reset email if it does."""
    normalized = normalize_email(email)
    user = db.execute(select(User).where(User.email == normalized)).scalar_one_or_none()
    if user is None or not user.is_active:
        return
    raw_token = _create_token(
        db, user, TokenPurpose.PASSWORD_RESET,
        timedelta(minutes=settings.password_reset_token_lifetime_minutes),
    )
    send_dev_email(
        user.email,
        "Reset your password",
        f"Reset your password: http://localhost:5173/reset-password?token={raw_token}",
    )


def _consume_token(db: Session, raw_token: str, purpose: TokenPurpose) -> User:
    token_hash = hash_token(raw_token)
    record = db.execute(
        select(AuthToken).where(AuthToken.token_hash == token_hash, AuthToken.purpose == purpose)
    ).scalar_one_or_none()
    if record is None or record.used_at is not None or record.expires_at < _utcnow():
        raise AuthError("This link is invalid or has expired.")
    record.used_at = _utcnow()
    db.commit()
    user = db.get(User, record.user_id)
    if user is None:
        raise AuthError("This link is invalid or has expired.")
    return user


def reset_password(db: Session, raw_token: str, new_password: str) -> None:
    user = _consume_token(db, raw_token, TokenPurpose.PASSWORD_RESET)
    user.password_hash = hash_password(new_password)
    db.commit()
    # A reset invalidates every existing session, including any an attacker
    # may hold from before the legitimate user reset their password.
    invalidate_all_sessions(db, user.id)


def verify_email(db: Session, raw_token: str) -> None:
    user = _consume_token(db, raw_token, TokenPurpose.EMAIL_VERIFICATION)
    user.is_email_verified = True
    db.commit()


def change_password(db: Session, user: User, current_password: str, new_password: str, current_session_token: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AuthError("Current password is incorrect.")
    user.password_hash = hash_password(new_password)
    db.commit()
    invalidate_all_sessions(db, user.id, except_raw_token=current_session_token)


# --- Agent invitations --------------------------------------------------------


def create_agent_invitation(
    db: Session, email: str, role: UserRole, team: AssignedTeam | None, invited_by: User
) -> str:
    if role == UserRole.CUSTOMER:
        raise AuthError("Invitations are only for Support Agent or Admin roles.")
    normalized = normalize_email(email)
    raw_token = generate_token()
    db.add(
        AgentInvitation(
            email=normalized,
            role=role,
            team=team,
            token_hash=hash_token(raw_token),
            expires_at=_utcnow() + timedelta(days=settings.agent_invitation_lifetime_days),
            invited_by=invited_by.id,
        )
    )
    db.commit()
    send_dev_email(
        normalized,
        "You've been invited to join as a support agent",
        f"Accept your invitation: http://localhost:5173/accept-invitation?token={raw_token}",
    )
    return raw_token


def accept_agent_invitation(db: Session, raw_token: str, password: str, display_name: str) -> User:
    token_hash = hash_token(raw_token)
    invitation = db.execute(
        select(AgentInvitation).where(AgentInvitation.token_hash == token_hash)
    ).scalar_one_or_none()
    if invitation is None or invitation.accepted_at is not None or invitation.expires_at < _utcnow():
        raise AuthError("This invitation is invalid or has expired.")

    existing = db.execute(select(User).where(User.email == invitation.email)).scalar_one_or_none()
    if existing is not None:
        raise AuthError("An account already exists for this invitation.")

    user = User(
        email=invitation.email,
        password_hash=hash_password(password),
        role=invitation.role,
        is_active=True,
        is_email_verified=True,  # invited directly by an admin — a trusted channel
    )
    db.add(user)
    db.flush()

    db.add(AgentProfile(user_id=user.id, display_name=display_name, team=invitation.team))
    invitation.accepted_at = _utcnow()
    db.commit()
    db.refresh(user)
    return user
