"""Creates/repairs local dev-only demo accounts: customer@example.com,
agent@example.com, admin@example.com (all password 'DemoPass123!').

Safe to re-run any time, including after `python -m app.db.seed`. That
script's TRUNCATE ... CASCADE on `customers` also empties `customer_profiles`
(it has a foreign key to `customers`), but never touches `users` — so this
script re-links by email rather than by numeric id, restoring a working demo
account set without ever deleting or duplicating a User row.

Run with (from backend/, venv active): python -m app.db.seed_auth

DEV-ONLY CREDENTIALS — never use these outside local development.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import AgentProfile, Customer, CustomerProfile, User
from app.models.enums import AssignedTeam, UserRole

DEMO_PASSWORD = "DemoPass123!"


def _get_or_create_user(session: Session, email: str, role: UserRole) -> User:
    user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(
            email=email,
            password_hash=hash_password(DEMO_PASSWORD),
            role=role,
            is_active=True,
            is_email_verified=True,
        )
        session.add(user)
        session.flush()
    return user


def seed_auth() -> None:
    session = SessionLocal()
    try:
        admin_user = _get_or_create_user(session, "admin@example.com", UserRole.ADMIN)
        if not session.execute(
            select(AgentProfile).where(AgentProfile.user_id == admin_user.id)
        ).scalar_one_or_none():
            session.add(AgentProfile(user_id=admin_user.id, display_name="Demo Admin", team=None))

        agent_user = _get_or_create_user(session, "agent@example.com", UserRole.SUPPORT_AGENT)
        if not session.execute(
            select(AgentProfile).where(AgentProfile.user_id == agent_user.id)
        ).scalar_one_or_none():
            session.add(
                AgentProfile(user_id=agent_user.id, display_name="Demo Agent", team=AssignedTeam.GENERAL_SUPPORT)
            )

        customer_user = _get_or_create_user(session, "customer@example.com", UserRole.CUSTOMER)
        business_customer = session.execute(
            select(Customer).where(Customer.email == "ananya.sharma@example.com")
        ).scalar_one_or_none()
        profile = session.execute(
            select(CustomerProfile).where(CustomerProfile.user_id == customer_user.id)
        ).scalar_one_or_none()
        if profile is None:
            session.add(
                CustomerProfile(
                    user_id=customer_user.id,
                    customer_id=business_customer.id if business_customer else None,
                )
            )
        elif business_customer is not None and profile.customer_id != business_customer.id:
            profile.customer_id = business_customer.id  # re-link after a reseed changed the id

        session.commit()
        print(
            "Demo accounts ready (dev-only, password for all: 'DemoPass123!'):\n"
            "  admin@example.com    (Admin)\n"
            "  agent@example.com    (Support Agent, General Support team)\n"
            "  customer@example.com (Customer, linked to Ananya Sharma's account)"
        )
    finally:
        session.close()


if __name__ == "__main__":
    seed_auth()
