"""FastAPI dependencies for authentication and role-based authorization.

get_current_user is the single place that (a) reads the session cookie,
(b) enforces CSRF on state-changing requests, and (c) resolves + renews the
session. require_customer/require_agent/require_admin layer role checks on
top, so every protected route declares its requirement in one line.
"""

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME
from app.db.session import get_db
from app.models import User
from app.models.enums import UserRole
from app.services import auth_service

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    if request.method not in _SAFE_METHODS:
        csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(CSRF_HEADER_NAME)
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid.")

    user = auth_service.get_valid_session_user(db, token)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is inactive.")
    return user


def require_customer(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Customer access required.")
    return user


def require_agent(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.SUPPORT_AGENT, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Agent access required.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
