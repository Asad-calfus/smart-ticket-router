from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import login_rate_limiter, password_reset_rate_limiter
from app.core.security import SESSION_COOKIE_NAME, clear_session_cookies, set_session_cookies
from app.db.session import get_db
from app.models import AgentProfile, CustomerProfile, User
from app.schemas.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    CurrentUserRead,
    ForgotPasswordRequest,
    GenericMessage,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    VerifyEmailRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_key(request: Request, extra: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{client_host}:{extra}"


def _current_user_read(db: Session, user: User) -> CurrentUserRead:
    customer_id = None
    agent_display_name = None
    agent_team = None

    if user.role.value == "Customer":
        profile = db.execute(select(CustomerProfile).where(CustomerProfile.user_id == user.id)).scalar_one_or_none()
        if profile is not None:
            customer_id = profile.customer_id
    else:
        agent_profile = db.execute(select(AgentProfile).where(AgentProfile.user_id == user.id)).scalar_one_or_none()
        if agent_profile is not None:
            agent_display_name = agent_profile.display_name
            agent_team = agent_profile.team

    return CurrentUserRead(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        customer_id=customer_id,
        agent_display_name=agent_display_name,
        agent_team=agent_team,
    )


@router.post("/signup", response_model=CurrentUserRead)
def signup(payload: SignupRequest, response: Response, db: Session = Depends(get_db)) -> CurrentUserRead:
    try:
        user = auth_service.signup_customer(
            db, payload.email, payload.password, payload.name, payload.location, payload.preferred_language
        )
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=409, detail=exc.detail) from None

    session_token, csrf_token = auth_service.create_session(db, user)
    set_session_cookies(response, session_token, csrf_token)
    return _current_user_read(db, user)


@router.post("/login", response_model=CurrentUserRead)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> CurrentUserRead:
    if not login_rate_limiter.allow(_client_key(request, payload.email)):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again shortly.")

    try:
        user = auth_service.authenticate(db, payload.email, payload.password)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=401, detail=exc.detail) from None

    session_token, csrf_token = auth_service.create_session(db, user)
    set_session_cookies(response, session_token, csrf_token)
    return _current_user_read(db, user)


@router.post("/logout", response_model=GenericMessage)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> GenericMessage:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        auth_service.invalidate_session(db, token)
    clear_session_cookies(response)
    return GenericMessage(message="Logged out.")


@router.get("/me", response_model=CurrentUserRead)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CurrentUserRead:
    return _current_user_read(db, user)


@router.post("/forgot-password", response_model=GenericMessage)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)) -> GenericMessage:
    if not password_reset_rate_limiter.allow(_client_key(request, payload.email)):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")
    auth_service.request_password_reset(db, payload.email)
    # Deliberately generic and identical whether or not the email exists.
    return GenericMessage(message="If an account exists for this email, a reset link has been sent.")


@router.post("/reset-password", response_model=GenericMessage)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)) -> GenericMessage:
    if not password_reset_rate_limiter.allow(_client_key(request, payload.token[:16])):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")
    try:
        auth_service.reset_password(db, payload.token, payload.new_password)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from None
    return GenericMessage(message="Password has been reset. Please log in.")


@router.post("/verify-email", response_model=GenericMessage)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> GenericMessage:
    try:
        auth_service.verify_email(db, payload.token)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from None
    return GenericMessage(message="Email verified.")


@router.post("/change-password", response_model=GenericMessage)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenericMessage:
    current_token = request.cookies.get(SESSION_COOKIE_NAME, "")
    try:
        auth_service.change_password(db, user, payload.current_password, payload.new_password, current_token)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from None
    return GenericMessage(message="Password changed.")


@router.post("/accept-invitation", response_model=CurrentUserRead)
def accept_invitation(payload: AcceptInvitationRequest, response: Response, db: Session = Depends(get_db)) -> CurrentUserRead:
    try:
        user = auth_service.accept_agent_invitation(db, payload.token, payload.password, payload.display_name)
    except auth_service.AuthError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from None

    session_token, csrf_token = auth_service.create_session(db, user)
    set_session_cookies(response, session_token, csrf_token)
    return _current_user_read(db, user)
