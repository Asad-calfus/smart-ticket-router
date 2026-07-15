"""Controlled vocabularies shared across models, schemas and the routing service.

Every value here is rendered as a Postgres ENUM constraint (via SQLAlchemy's
Enum type) so the database itself rejects out-of-vocabulary values, not just
the API layer.
"""

import enum

from sqlalchemy import Enum as SAEnum


class TicketCategory(str, enum.Enum):
    TECHNICAL_ISSUE = "Technical Issue"
    BILLING = "Billing"
    ACCOUNT_ACCESS = "Account Access"
    REFUND = "Refund"
    PRODUCT_QUERY = "Product Query"
    SECURITY = "Security"
    NEEDS_CLARIFICATION = "Needs Clarification"
    OTHER = "Other"


class TicketPriority(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class AssignedTeam(str, enum.Enum):
    TECHNICAL_SUPPORT = "Technical Support"
    BILLING_OPERATIONS = "Billing Operations"
    IDENTITY_AND_ACCESS = "Identity and Access"
    REFUNDS_TEAM = "Refunds Team"
    PRODUCT_SUPPORT = "Product Support"
    SECURITY_OPERATIONS = "Security Operations"
    GENERAL_SUPPORT = "General Support"
    TRIAGE_QUEUE = "Triage Queue"


class TicketStatus(str, enum.Enum):
    OPEN = "Open"
    ROUTED = "Routed"
    IN_PROGRESS = "In Progress"
    NEEDS_HUMAN_REVIEW = "Needs Human Review"
    RESOLVED = "Resolved"
    REOPENED = "Reopened"


class TicketChannel(str, enum.Enum):
    EMAIL = "Email"
    CHAT = "Chat"
    PHONE = "Phone"
    PORTAL = "Portal"


class CustomerTier(str, enum.Enum):
    FREE = "Free"
    STANDARD = "Standard"
    PREMIUM = "Premium"
    ENTERPRISE = "Enterprise"


class ProductStatus(str, enum.Enum):
    ACTIVE = "Active"
    BETA = "Beta"
    DEPRECATED = "Deprecated"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "Active"
    TRIAL = "Trial"
    EXPIRED = "Expired"
    CANCELLED = "Cancelled"


class AccessStatus(str, enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    SUSPENDED = "Suspended"


class IncidentSeverity(str, enum.Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class IncidentStatus(str, enum.Enum):
    ACTIVE = "Active"
    MONITORING = "Monitoring"
    RESOLVED = "Resolved"


class UserRole(str, enum.Enum):
    CUSTOMER = "Customer"
    SUPPORT_AGENT = "Support Agent"
    ADMIN = "Admin"


class MessageType(str, enum.Enum):
    CUSTOMER_REPLY = "Customer Reply"
    AGENT_REPLY = "Agent Reply"
    INTERNAL_NOTE = "Internal Note"


class AgentAvailability(str, enum.Enum):
    AVAILABLE = "Available"
    BUSY = "Busy"
    OFFLINE = "Offline"


class TokenPurpose(str, enum.Enum):
    PASSWORD_RESET = "Password Reset"
    EMAIL_VERIFICATION = "Email Verification"


def _pg_enum(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """Build a Postgres ENUM column type whose stored values are the human-readable
    strings (e.g. "Technical Issue"), not the Python member names."""
    return SAEnum(enum_cls, values_callable=lambda cls: [member.value for member in cls], name=name)


TicketCategoryType = _pg_enum(TicketCategory, "ticket_category")
TicketPriorityType = _pg_enum(TicketPriority, "ticket_priority")
AssignedTeamType = _pg_enum(AssignedTeam, "assigned_team")
TicketStatusType = _pg_enum(TicketStatus, "ticket_status")
TicketChannelType = _pg_enum(TicketChannel, "ticket_channel")
CustomerTierType = _pg_enum(CustomerTier, "customer_tier")
ProductStatusType = _pg_enum(ProductStatus, "product_status")
SubscriptionStatusType = _pg_enum(SubscriptionStatus, "subscription_status")
AccessStatusType = _pg_enum(AccessStatus, "access_status")
IncidentSeverityType = _pg_enum(IncidentSeverity, "incident_severity")
IncidentStatusType = _pg_enum(IncidentStatus, "incident_status")
UserRoleType = _pg_enum(UserRole, "user_role")
MessageTypeType = _pg_enum(MessageType, "message_type")
AgentAvailabilityType = _pg_enum(AgentAvailability, "agent_availability")
TokenPurposeType = _pg_enum(TokenPurpose, "token_purpose")
