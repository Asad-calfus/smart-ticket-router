"""Single import point that registers every model on Base.metadata.

Alembic's env.py imports `Base` from here (not from base_class directly) so
that autogenerate can see all tables.
"""

from app.db.base_class import Base
from app.models import (  # noqa: F401
    AgentInvitation,
    AgentProfile,
    AuditEvent,
    AuthToken,
    Customer,
    CustomerProduct,
    CustomerProfile,
    Incident,
    KnowledgeDocument,
    Product,
    RoutingEvidence,
    RoutingFeedback,
    Ticket,
    TicketAssignment,
    TicketMessage,
    User,
    UserSession,
)

__all__ = ["Base"]
