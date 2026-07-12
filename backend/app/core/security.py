"""Password hashing, token generation, and session/CSRF cookie helpers.

Session strategy: opaque, server-side sessions referenced by an HttpOnly
cookie (never localStorage). A second, non-HttpOnly cookie carries a CSRF
token the frontend echoes back as a header on state-changing requests
(the "double-submit cookie" pattern) — see app/api/deps.py for where it's
checked. Only a SHA-256 hash of each session/reset/verification/invitation
token is ever stored in the database; the raw value exists only in the
cookie or the one-time link sent to the user.
"""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Response

from app.core.config import settings

SESSION_COOKIE_NAME = "session_token"
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        # Any hasher-internal error (e.g. a corrupt/legacy hash) is treated as
        # "does not match" rather than crashing the login request.
        return False


def normalize_email(email: str) -> str:
    return email.strip().lower()


def generate_token() -> str:
    """A cryptographically secure, URL-safe raw token (session/reset/invite/etc)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """One-way hash of a raw token, for DB storage — never store the raw value."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def set_session_cookies(response: Response, session_token: str, csrf_token: str) -> None:
    max_age = settings.session_lifetime_hours * 3600
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=max_age,
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,  # the frontend must be able to read this to echo it back as a header
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=max_age,
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")
