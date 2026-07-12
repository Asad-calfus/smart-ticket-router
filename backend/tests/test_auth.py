"""Tests for signup, login, logout, current-user, password reset, and account
status (disabled/unverified) behaviour.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import hash_token
from app.main import app
from app.models import AuthToken, User
from app.models.enums import TokenPurpose


def _fresh_client() -> TestClient:
    return TestClient(app)


def _unique_suffix() -> str:
    # Unique per Python object identity — avoids colliding with seeded/demo
    # accounts AND with tokens/emails left over from a previous test run
    # (auth_tokens.token_hash and users.email are both unique columns).
    return str(id(object()))


def _unique_email(prefix: str) -> str:
    return f"{prefix}.{_unique_suffix()}@example.com"


def test_signup_login_logout_and_me_roundtrip():
    client = _fresh_client()
    email = _unique_email("roundtrip")

    signup = client.post(
        "/api/auth/signup",
        json={"email": email, "password": "SignupPass123", "name": "Round Trip", "location": "Testland"},
    )
    assert signup.status_code == 200
    body = signup.json()
    assert body["email"] == email
    assert body["role"] == "Customer"
    assert "password" not in body and "password_hash" not in body

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email

    csrf = client.cookies.get("csrf_token")
    logout = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logout.status_code == 200

    me_after_logout = client.get("/api/auth/me")
    assert me_after_logout.status_code == 401


def test_signup_duplicate_email_is_rejected():
    client = _fresh_client()
    email = _unique_email("dup")
    first = client.post(
        "/api/auth/signup", json={"email": email, "password": "SignupPass123", "name": "Dup One"}
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/signup", json={"email": email, "password": "AnotherPass456", "name": "Dup Two"}
    )
    assert second.status_code == 409


def test_login_incorrect_password_returns_generic_error():
    client = _fresh_client()
    email = _unique_email("wrongpass")
    client.post("/api/auth/signup", json={"email": email, "password": "CorrectPass123", "name": "Wrong Pass"})
    client.cookies.clear()

    response = client.post("/api/auth/login", json={"email": email, "password": "IncorrectPass999"})
    assert response.status_code == 401
    assert "password" not in response.json()["detail"].lower() or "incorrect" in response.json()["detail"].lower()


def test_login_nonexistent_and_wrong_password_give_identical_error():
    client = _fresh_client()
    email = _unique_email("identical")
    client.post("/api/auth/signup", json={"email": email, "password": "CorrectPass123", "name": "Identical"})
    client.cookies.clear()

    wrong_password = client.post("/api/auth/login", json={"email": email, "password": "WrongPass999"})
    nonexistent = client.post("/api/auth/login", json={"email": "totally.made.up@example.com", "password": "WhoCares123"})

    assert wrong_password.status_code == 401
    assert nonexistent.status_code == 401
    assert wrong_password.json()["detail"] == nonexistent.json()["detail"]


def test_disabled_user_cannot_log_in(db_session):
    client = _fresh_client()
    email = _unique_email("disabled")
    client.post("/api/auth/signup", json={"email": email, "password": "DisabledPass123", "name": "Disabled User"})
    client.cookies.clear()

    user = db_session.execute(select(User).where(User.email == email)).scalar_one()
    user.is_active = False
    db_session.commit()

    response = client.post("/api/auth/login", json={"email": email, "password": "DisabledPass123"})
    assert response.status_code == 401


def test_unverified_user_can_still_log_in_but_me_reflects_unverified_status():
    client = _fresh_client()
    email = _unique_email("unverified")
    client.post("/api/auth/signup", json={"email": email, "password": "UnverifiedPass123", "name": "Unverified"})
    client.cookies.clear()

    login = client.post("/api/auth/login", json={"email": email, "password": "UnverifiedPass123"})
    assert login.status_code == 200
    assert login.json()["is_email_verified"] is False


def test_forgot_password_response_identical_for_existing_and_nonexistent_email():
    client = _fresh_client()
    email = _unique_email("forgot")
    client.post("/api/auth/signup", json={"email": email, "password": "ForgotPass123", "name": "Forgot"})
    client.cookies.clear()

    existing = client.post("/api/auth/forgot-password", json={"email": email})
    nonexistent = client.post("/api/auth/forgot-password", json={"email": "no.such.user@example.com"})

    assert existing.status_code == 200
    assert nonexistent.status_code == 200
    assert existing.json() == nonexistent.json()


def test_reset_password_token_is_one_time_use(db_session):
    client = _fresh_client()
    email = _unique_email("onetime")
    client.post("/api/auth/signup", json={"email": email, "password": "OldPass123", "name": "One Time"})
    client.cookies.clear()

    user = db_session.execute(select(User).where(User.email == email)).scalar_one()
    raw_token = f"test-raw-token-onetime-use-{_unique_suffix()}"
    db_session.add(
        AuthToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            purpose=TokenPurpose.PASSWORD_RESET,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
    )
    db_session.commit()

    first = client.post("/api/auth/reset-password", json={"token": raw_token, "new_password": "NewPass456"})
    assert first.status_code == 200

    second = client.post("/api/auth/reset-password", json={"token": raw_token, "new_password": "AnotherPass789"})
    assert second.status_code == 400


def test_reset_password_expired_token_is_rejected(db_session):
    client = _fresh_client()
    email = _unique_email("expired")
    client.post("/api/auth/signup", json={"email": email, "password": "OldPass123", "name": "Expired Token"})
    client.cookies.clear()

    user = db_session.execute(select(User).where(User.email == email)).scalar_one()
    raw_token = f"test-raw-token-already-expired-{_unique_suffix()}"
    db_session.add(
        AuthToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            purpose=TokenPurpose.PASSWORD_RESET,
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # already expired
        )
    )
    db_session.commit()

    response = client.post("/api/auth/reset-password", json={"token": raw_token, "new_password": "NewPass456"})
    assert response.status_code == 400


def test_reset_password_invalidates_existing_sessions(db_session):
    client = _fresh_client()
    email = _unique_email("sessioninvalidate")
    client.post(
        "/api/auth/signup", json={"email": email, "password": "OldPass123", "name": "Session Invalidate"}
    )
    # client is now logged in with a valid session cookie.
    assert client.get("/api/auth/me").status_code == 200

    user = db_session.execute(select(User).where(User.email == email)).scalar_one()
    raw_token = f"test-raw-token-session-invalidate-{_unique_suffix()}"
    db_session.add(
        AuthToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            purpose=TokenPurpose.PASSWORD_RESET,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
    )
    db_session.commit()

    fresh_client = _fresh_client()
    reset = fresh_client.post(
        "/api/auth/reset-password", json={"token": raw_token, "new_password": "BrandNewPass456"}
    )
    assert reset.status_code == 200

    # The original session (from signup) must no longer work.
    assert client.get("/api/auth/me").status_code == 401


def test_change_password_requires_correct_current_password():
    client = _fresh_client()
    email = _unique_email("changepw")
    client.post("/api/auth/signup", json={"email": email, "password": "OriginalPass123", "name": "Change PW"})
    csrf = client.cookies.get("csrf_token")

    response = client.post(
        "/api/auth/change-password",
        headers={"X-CSRF-Token": csrf},
        json={"current_password": "WrongCurrentPass", "new_password": "NewPass456"},
    )
    assert response.status_code == 400
