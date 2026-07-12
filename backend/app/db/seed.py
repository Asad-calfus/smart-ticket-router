"""Populate the database with realistic demo data for local development.

Run with (from backend/, venv active, migrations already applied):

    python -m app.db.seed

This script is for local development and demos only. It deletes existing
rows (in foreign-key-safe order) before inserting, so it is safe to re-run,
but it is destructive — never point it at a database containing real data.

Ticket/knowledge-document embeddings are left NULL here; the embedding
backfill happens in the Phase 4 embedding service.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import text

from app.db.session import SessionLocal
from app.models import (
    Customer,
    CustomerProduct,
    Incident,
    KnowledgeDocument,
    Product,
    Ticket,
)
from app.models.enums import (
    AccessStatus,
    AssignedTeam,
    CustomerTier,
    IncidentSeverity,
    IncidentStatus,
    ProductStatus,
    SubscriptionStatus,
    TicketCategory,
    TicketChannel,
    TicketPriority,
    TicketStatus,
)

# Fixed reference point so seeded "waiting time" / "days ago" data reads
# consistently across re-seeds instead of drifting with wall-clock time.
NOW = datetime(2026, 7, 12, 9, 0, 0)

# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

PRODUCTS = [
    {"key": "dashboard", "name": "Premium Dashboard", "owning_team": AssignedTeam.PRODUCT_SUPPORT, "status": ProductStatus.ACTIVE},
    {"key": "payments", "name": "Payments Gateway", "owning_team": AssignedTeam.BILLING_OPERATIONS, "status": ProductStatus.ACTIVE},
    {"key": "identity", "name": "Identity Vault", "owning_team": AssignedTeam.IDENTITY_AND_ACCESS, "status": ProductStatus.ACTIVE},
    {"key": "mobile", "name": "Mobile App", "owning_team": AssignedTeam.TECHNICAL_SUPPORT, "status": ProductStatus.ACTIVE},
    {"key": "analytics", "name": "Analytics Suite", "owning_team": AssignedTeam.PRODUCT_SUPPORT, "status": ProductStatus.BETA},
]

# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

CUSTOMERS = [
    {"key": "ananya", "name": "Ananya Sharma", "email": "ananya.sharma@example.com", "tier": CustomerTier.PREMIUM, "location": "Mumbai, India", "preferred_language": "Hindi"},
    {"key": "rahul", "name": "Rahul Verma", "email": "rahul.verma@example.com", "tier": CustomerTier.STANDARD, "location": "Delhi, India", "preferred_language": "Hindi"},
    {"key": "john", "name": "John Miller", "email": "john.miller@example.com", "tier": CustomerTier.ENTERPRISE, "location": "New York, USA", "preferred_language": "English"},
    {"key": "emma", "name": "Emma Clarke", "email": "emma.clarke@example.com", "tier": CustomerTier.STANDARD, "location": "London, UK", "preferred_language": "English"},
    {"key": "carlos", "name": "Carlos Gomez", "email": "carlos.gomez@example.com", "tier": CustomerTier.FREE, "location": "Madrid, Spain", "preferred_language": "Spanish"},
    {"key": "priya", "name": "Priya Nair", "email": "priya.nair@example.com", "tier": CustomerTier.PREMIUM, "location": "Bengaluru, India", "preferred_language": "English"},
    {"key": "wei", "name": "Wei Zhang", "email": "wei.zhang@example.com", "tier": CustomerTier.STANDARD, "location": "Singapore", "preferred_language": "English"},
    {"key": "sophie", "name": "Sophie Turner", "email": "sophie.turner@example.com", "tier": CustomerTier.ENTERPRISE, "location": "Sydney, Australia", "preferred_language": "English"},
    {"key": "omar", "name": "Omar Hassan", "email": "omar.hassan@example.com", "tier": CustomerTier.FREE, "location": "Dubai, UAE", "preferred_language": "English"},
    {"key": "maria", "name": "Maria Silva", "email": "maria.silva@example.com", "tier": CustomerTier.STANDARD, "location": "Sao Paulo, Brazil", "preferred_language": "Portuguese"},
]

# ---------------------------------------------------------------------------
# Customer <-> Product links (plan, subscription and access status)
# ---------------------------------------------------------------------------

CUSTOMER_PRODUCTS = [
    {"customer": "ananya", "product": "dashboard", "plan_name": "Premium Yearly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2027, 1, 1)},
    # Payment succeeded but access never activated — used for the "payment deducted, access missing" demo case.
    {"customer": "ananya", "product": "payments", "plan_name": "Pro Monthly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.INACTIVE, "expiry_date": date(2026, 8, 1)},
    {"customer": "rahul", "product": "mobile", "plan_name": "Standard Monthly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2026, 9, 1)},
    {"customer": "john", "product": "analytics", "plan_name": "Enterprise Annual", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2027, 3, 1)},
    {"customer": "john", "product": "dashboard", "plan_name": "Enterprise Annual", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2027, 3, 1)},
    {"customer": "emma", "product": "payments", "plan_name": "Standard Monthly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2026, 8, 15)},
    {"customer": "carlos", "product": "mobile", "plan_name": "Free Tier", "subscription_status": SubscriptionStatus.TRIAL, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2026, 7, 30)},
    {"customer": "priya", "product": "identity", "plan_name": "Premium Yearly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2027, 2, 1)},
    # Access suspended (policy/abuse hold) despite an active subscription — "customer without access to claimed product".
    {"customer": "priya", "product": "dashboard", "plan_name": "Premium Yearly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.SUSPENDED, "expiry_date": date(2027, 2, 1)},
    {"customer": "wei", "product": "analytics", "plan_name": "Standard Monthly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2026, 9, 10)},
    {"customer": "sophie", "product": "identity", "plan_name": "Enterprise Annual", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2027, 4, 1)},
    {"customer": "sophie", "product": "mobile", "plan_name": "Enterprise Annual", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2027, 4, 1)},
    # Subscription expired, access revoked — but the customer still believes they should have access.
    {"customer": "omar", "product": "dashboard", "plan_name": "Free Tier", "subscription_status": SubscriptionStatus.EXPIRED, "access_status": AccessStatus.INACTIVE, "expiry_date": date(2026, 5, 1)},
    {"customer": "maria", "product": "payments", "plan_name": "Standard Monthly", "subscription_status": SubscriptionStatus.ACTIVE, "access_status": AccessStatus.ACTIVE, "expiry_date": date(2026, 8, 20)},
    {"customer": "maria", "product": "mobile", "plan_name": "Standard Monthly", "subscription_status": SubscriptionStatus.CANCELLED, "access_status": AccessStatus.INACTIVE, "expiry_date": date(2026, 6, 1)},
]

# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------

INCIDENTS = [
    {
        "title": "Premium Dashboard outage in Mumbai region",
        "description": "Customers in the Mumbai region are unable to load the Premium Dashboard. Root cause: regional CDN node failure.",
        "product": "dashboard",
        "affected_location": "Mumbai, India",
        "severity": IncidentSeverity.CRITICAL,
        "status": IncidentStatus.ACTIVE,
        "started_at": NOW - timedelta(hours=5),
        "resolved_at": None,
    },
    {
        "title": "Payments Gateway intermittent failures in Europe",
        "description": "A subset of European customers are seeing intermittent payment failures on checkout. Engineering is investigating the upstream processor.",
        "product": "payments",
        "affected_location": "London, UK",
        "severity": IncidentSeverity.HIGH,
        "status": IncidentStatus.MONITORING,
        "started_at": NOW - timedelta(days=1, hours=3),
        "resolved_at": None,
    },
    {
        "title": "Identity Vault SSO login delays",
        "description": "Single sign-on logins are taking 30-60 seconds longer than usual across all regions.",
        "product": "identity",
        "affected_location": None,
        "severity": IncidentSeverity.MEDIUM,
        "status": IncidentStatus.ACTIVE,
        "started_at": NOW - timedelta(hours=10),
        "resolved_at": None,
    },
    {
        "title": "Mobile App crashes on Android 14",
        "description": "The Mobile App crashed on launch for some Android 14 devices. Fixed in release 4.2.1.",
        "product": "mobile",
        "affected_location": None,
        "severity": IncidentSeverity.HIGH,
        "status": IncidentStatus.RESOLVED,
        "started_at": NOW - timedelta(days=10),
        "resolved_at": NOW - timedelta(days=8),
    },
    {
        "title": "Analytics Suite data export outage",
        "description": "CSV/Excel export was unavailable for Analytics Suite users in Singapore due to a storage bucket misconfiguration.",
        "product": "analytics",
        "affected_location": "Singapore",
        "severity": IncidentSeverity.MEDIUM,
        "status": IncidentStatus.RESOLVED,
        "started_at": NOW - timedelta(days=5),
        "resolved_at": NOW - timedelta(days=4),
    },
]

# ---------------------------------------------------------------------------
# Knowledge documents
# ---------------------------------------------------------------------------

KNOWLEDGE_DOCUMENTS = [
    {
        "title": "How to reset your Identity Vault password",
        "content": (
            "If you cannot log in, go to the Identity Vault login page and select 'Forgot password'. "
            "A reset link is sent to your registered email and expires after 30 minutes. If the login "
            "issue persists after resetting, check whether your subscription or access status is active "
            "before escalating as a technical bug."
        ),
        "product": "identity",
    },
    {
        "title": "Understanding subscription billing cycles",
        "content": (
            "Subscriptions renew automatically on the plan's billing date. A charge appearing before "
            "access is granted usually means the payment succeeded but the product entitlement sync is "
            "still pending — this should resolve within a few minutes, otherwise it should be treated as "
            "a billing/access mismatch rather than a fraud concern."
        ),
        "product": "payments",
    },
    {
        "title": "Premium Dashboard won't load — troubleshooting steps",
        "content": (
            "First confirm whether there is an active incident affecting the customer's region. If not, "
            "ask the customer to clear their browser cache, confirm their subscription/access status is "
            "Active, and try an incognito window to rule out browser extensions."
        ),
        "product": "dashboard",
    },
    {
        "title": "Refund policy overview",
        "content": (
            "Refunds are issued for unused subscription time within 14 days of a charge, or immediately "
            "for confirmed billing errors (double charges, charged-but-no-access cases). Refunds outside "
            "this window require manager approval and should be routed to the Refunds Team."
        ),
        "product": None,
    },
    {
        "title": "Mobile App troubleshooting guide",
        "content": (
            "For crashes on launch, confirm the app version and OS version. Known crash issues on older "
            "Android versions were fixed in release 4.2.1 — advise the customer to update. If the crash "
            "persists on the latest version, collect a crash log and escalate to Technical Support."
        ),
        "product": "mobile",
    },
    {
        "title": "Security best practices for account protection",
        "content": (
            "Any report of unauthorized login, unexpected password reset emails, or suspicious 'account "
            "access' messages should be treated as a potential security incident. Do not ask the customer "
            "for their password. Escalate to Security Operations and recommend the customer change their "
            "password from a trusted device."
        ),
        "product": None,
    },
]

# ---------------------------------------------------------------------------
# Historical tickets — resolved corpus used for RAG retrieval.
# ---------------------------------------------------------------------------

HISTORICAL_TICKETS = [
    {"customer": "john", "channel": TicketChannel.EMAIL, "days_ago": 40, "message": "Our Premium Dashboard has been throwing a 500 error for the whole New York office since this morning.", "category": TicketCategory.TECHNICAL_ISSUE, "priority": TicketPriority.HIGH, "assigned_team": AssignedTeam.TECHNICAL_SUPPORT, "reasoning": "Widespread dashboard error affecting a whole office is a functional outage for this customer.", "confidence": 0.91, "resolution": "Identified a bad cache deploy affecting enterprise tenants; rolled back and confirmed recovery with the customer.", "human_verified": True},
    {"customer": "emma", "channel": TicketChannel.EMAIL, "days_ago": 38, "message": "I was charged twice for my Payments Gateway subscription this month, can you check?", "category": TicketCategory.BILLING, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.BILLING_OPERATIONS, "reasoning": "Duplicate charge is a billing discrepancy, not an outage or security issue.", "confidence": 0.88, "resolution": "Confirmed a duplicate charge due to a retried webhook; refunded the extra charge within 2 business days.", "human_verified": True},
    {"customer": "priya", "channel": TicketChannel.CHAT, "days_ago": 35, "message": "I can't log into Identity Vault, it says my password is wrong even though I just reset it.", "category": TicketCategory.ACCOUNT_ACCESS, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.IDENTITY_AND_ACCESS, "reasoning": "Login failure after a legitimate reset points to an account-access issue, not a security breach.", "confidence": 0.85, "resolution": "Password reset had not propagated due to a caching bug; forced a session refresh and confirmed login.", "human_verified": True},
    {"customer": "carlos", "channel": TicketChannel.CHAT, "days_ago": 33, "message": "Quiero cancelar mi suscripcion y pedir un reembolso, no he usado la app.", "category": TicketCategory.REFUND, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.REFUNDS_TEAM, "reasoning": "Unused trial subscription cancellation request within the refund window.", "confidence": 0.8, "resolution": "Cancelled subscription and issued a full refund per policy for an unused trial.", "human_verified": True},
    {"customer": "wei", "channel": TicketChannel.EMAIL, "days_ago": 30, "message": "Does Analytics Suite support scheduled weekly report exports?", "category": TicketCategory.PRODUCT_QUERY, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.PRODUCT_SUPPORT, "reasoning": "General product capability question with no urgency.", "confidence": 0.9, "resolution": "Confirmed scheduled exports are supported under Settings > Reports > Schedule, shared setup steps.", "human_verified": True},
    {"customer": "sophie", "channel": TicketChannel.PHONE, "days_ago": 29, "message": "Someone tried to log into my account from an unfamiliar device, I got an alert email.", "category": TicketCategory.SECURITY, "priority": TicketPriority.HIGH, "assigned_team": AssignedTeam.SECURITY_OPERATIONS, "reasoning": "Suspicious login attempt is a security concern regardless of tone.", "confidence": 0.93, "resolution": "Verified the login attempt was blocked by MFA; forced a password reset and reviewed account activity with the customer.", "human_verified": True},
    {"customer": "omar", "channel": TicketChannel.EMAIL, "days_ago": 27, "message": "My Premium Dashboard subscription expired but I thought I still had a grace period.", "category": TicketCategory.BILLING, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.BILLING_OPERATIONS, "reasoning": "Expired subscription with no active incident; a billing/plan clarification, not a bug.", "confidence": 0.82, "resolution": "Explained the grace period had ended two weeks prior; offered a discounted renewal.", "human_verified": True},
    {"customer": "maria", "channel": TicketChannel.CHAT, "days_ago": 25, "message": "My Mobile App subscription shows cancelled but I never asked to cancel it.", "category": TicketCategory.BILLING, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.BILLING_OPERATIONS, "reasoning": "Unexpected cancellation is a billing/account discrepancy needing investigation.", "confidence": 0.78, "resolution": "Found the cancellation was triggered by a failed renewal payment; reactivated after the customer updated their card.", "human_verified": True},
    {"customer": "rahul", "channel": TicketChannel.CHAT, "days_ago": 24, "message": "The mobile app keeps crashing every time I open the reports tab.", "category": TicketCategory.TECHNICAL_ISSUE, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.TECHNICAL_SUPPORT, "reasoning": "Reproducible crash in a specific feature area, not affecting all users.", "confidence": 0.84, "resolution": "Identified a crash on older Android versions; advised update to app version 4.2.1, confirmed fix.", "human_verified": True},
    {"customer": "ananya", "channel": TicketChannel.EMAIL, "days_ago": 22, "message": "Can I upgrade from Premium Yearly to an Enterprise plan mid-cycle?", "category": TicketCategory.PRODUCT_QUERY, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.PRODUCT_SUPPORT, "reasoning": "Plan question with no reported problem.", "confidence": 0.87, "resolution": "Explained prorated mid-cycle upgrade process and shared a comparison sheet.", "human_verified": True},
    {"customer": "john", "channel": TicketChannel.EMAIL, "days_ago": 20, "message": "We'd like a refund for the Analytics Suite add-on we accidentally purchased twice.", "category": TicketCategory.REFUND, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.REFUNDS_TEAM, "reasoning": "Confirmed duplicate purchase, clear refund case.", "confidence": 0.9, "resolution": "Verified duplicate purchase in billing records and refunded the second charge.", "human_verified": True},
    {"customer": "emma", "channel": TicketChannel.CHAT, "days_ago": 19, "message": "I think I got phished — I received an email asking me to confirm my password on a strange link.", "category": TicketCategory.SECURITY, "priority": TicketPriority.HIGH, "assigned_team": AssignedTeam.SECURITY_OPERATIONS, "reasoning": "Reported phishing attempt targeting account credentials is a security concern.", "confidence": 0.92, "resolution": "Confirmed the email was not sent by us, advised the customer not to click the link, and reported the domain for takedown.", "human_verified": True},
    {"customer": "priya", "channel": TicketChannel.EMAIL, "days_ago": 18, "message": "My Premium Dashboard access shows suspended, I don't understand why since I'm paid up.", "category": TicketCategory.ACCOUNT_ACCESS, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.IDENTITY_AND_ACCESS, "reasoning": "Active subscription with suspended access is an entitlement mismatch needing manual review.", "confidence": 0.76, "resolution": "Found the suspension was tied to an unresolved billing dispute; cleared once the dispute closed.", "human_verified": False},
    {"customer": "wei", "channel": TicketChannel.CHAT, "days_ago": 17, "message": "Getting a blank screen when I try to export data from Analytics Suite.", "category": TicketCategory.TECHNICAL_ISSUE, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.TECHNICAL_SUPPORT, "reasoning": "Feature-specific bug affecting one workflow, not a full outage.", "confidence": 0.83, "resolution": "Traced to the Singapore export outage; confirmed resolved after the storage bucket fix.", "human_verified": True},
    {"customer": "sophie", "channel": TicketChannel.EMAIL, "days_ago": 16, "message": "This is unacceptable, your app STILL crashes constantly and no one has fixed it!!", "category": TicketCategory.TECHNICAL_ISSUE, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.TECHNICAL_SUPPORT, "reasoning": "Angry tone alone does not raise priority; underlying issue is a known, already-patched crash bug.", "confidence": 0.79, "resolution": "Confirmed customer was on an outdated app version; walked through the update and confirmed stability.", "human_verified": True},
    {"customer": "omar", "channel": TicketChannel.CHAT, "days_ago": 15, "message": "I want a refund, I was charged for a plan I can't even access anymore.", "category": TicketCategory.REFUND, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.REFUNDS_TEAM, "reasoning": "Charged for inaccessible plan is a legitimate refund case tied to an expired/inactive subscription.", "confidence": 0.81, "resolution": "Issued a prorated refund for the period after expiry and clarified renewal terms.", "human_verified": True},
    {"customer": "maria", "channel": TicketChannel.EMAIL, "days_ago": 14, "message": "Como faço para mudar meu email cadastrado na conta?", "category": TicketCategory.ACCOUNT_ACCESS, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.IDENTITY_AND_ACCESS, "reasoning": "Routine account-detail update request.", "confidence": 0.86, "resolution": "Verified identity and updated the registered email address.", "human_verified": True},
    {"customer": "rahul", "channel": TicketChannel.CHAT, "days_ago": 13, "message": "क्या मोबाइल ऐप में डार्क मोड आने वाला है?", "category": TicketCategory.PRODUCT_QUERY, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.PRODUCT_SUPPORT, "reasoning": "Low-priority feature request in Hindi, no functional problem reported.", "confidence": 0.74, "resolution": "Logged as a feature request for the mobile roadmap; no immediate fix needed.", "human_verified": True},
    {"customer": "ananya", "channel": TicketChannel.EMAIL, "days_ago": 12, "message": "My Payments Gateway plan shows active and charged, but I still can't access any payment features.", "category": TicketCategory.BILLING, "priority": TicketPriority.HIGH, "assigned_team": AssignedTeam.BILLING_OPERATIONS, "reasoning": "Payment succeeded but product access never activated — treated as high priority per policy.", "confidence": 0.9, "resolution": "Found entitlement sync had failed after payment; manually granted access and fixed the sync job.", "human_verified": True},
    {"customer": "john", "channel": TicketChannel.PHONE, "days_ago": 11, "message": "Our entire Analytics Suite dashboard is down company-wide, this is a complete outage for us.", "category": TicketCategory.TECHNICAL_ISSUE, "priority": TicketPriority.HIGH, "assigned_team": AssignedTeam.TECHNICAL_SUPPORT, "reasoning": "Customer-confirmed complete outage is treated as high priority regardless of tone.", "confidence": 0.92, "resolution": "Traced to the Singapore-region storage outage; resolved once the underlying incident closed.", "human_verified": True},
    {"customer": "emma", "channel": TicketChannel.EMAIL, "days_ago": 10, "message": "Is there a way to get an itemized invoice for last quarter's Payments Gateway charges?", "category": TicketCategory.BILLING, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.BILLING_OPERATIONS, "reasoning": "Routine billing information request.", "confidence": 0.88, "resolution": "Generated and emailed an itemized quarterly invoice.", "human_verified": True},
    {"customer": "carlos", "channel": TicketChannel.CHAT, "days_ago": 9, "message": "broken", "category": TicketCategory.NEEDS_CLARIFICATION, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.GENERAL_SUPPORT, "reasoning": "Message gives no detail on product, symptom, or timing; clarification was required before routing.", "confidence": 0.4, "resolution": "Followed up and learned the mobile app icon was missing after an OS update; guided a reinstall.", "human_verified": True},
    {"customer": "priya", "channel": TicketChannel.EMAIL, "days_ago": 8, "message": "I keep getting logged out of Identity Vault every few minutes, is this a bug or did something happen to my account?", "category": TicketCategory.ACCOUNT_ACCESS, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.IDENTITY_AND_ACCESS, "reasoning": "Ambiguous between a session bug and an account issue; treated as account access pending investigation.", "confidence": 0.68, "resolution": "Found a session-token expiry misconfiguration after a recent deploy; fixed and extended session length.", "human_verified": True},
    {"customer": "wei", "channel": TicketChannel.CHAT, "days_ago": 7, "message": "Can you explain the difference between the Standard and Enterprise plans for Analytics Suite?", "category": TicketCategory.PRODUCT_QUERY, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.PRODUCT_SUPPORT, "reasoning": "Plan comparison question, no issue reported.", "confidence": 0.89, "resolution": "Shared the plan comparison page and highlighted Enterprise-only features.", "human_verified": True},
    {"customer": "sophie", "channel": TicketChannel.EMAIL, "days_ago": 6, "message": "I got an email saying my password was changed but I never changed it!", "category": TicketCategory.SECURITY, "priority": TicketPriority.HIGH, "assigned_team": AssignedTeam.SECURITY_OPERATIONS, "reasoning": "Unrecognized password change is a strong security signal.", "confidence": 0.94, "resolution": "Confirmed unauthorized access via a reused password from another breach; reset credentials and enabled MFA.", "human_verified": True},
    {"customer": "omar", "channel": TicketChannel.CHAT, "days_ago": 5, "message": "My dashboard access still isn't working even after renewing.", "category": TicketCategory.ACCOUNT_ACCESS, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.IDENTITY_AND_ACCESS, "reasoning": "Renewal completed but access not restored — an entitlement sync issue.", "confidence": 0.8, "resolution": "Manually re-synced entitlements after renewal; confirmed access restored.", "human_verified": True},
    {"customer": "maria", "channel": TicketChannel.EMAIL, "days_ago": 4, "message": "Just wanted to say the new Payments Gateway dashboard redesign looks great!", "category": TicketCategory.OTHER, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.GENERAL_SUPPORT, "reasoning": "Positive feedback with no request or issue.", "confidence": 0.7, "resolution": "Thanked the customer and passed feedback to the product team.", "human_verified": False},
    {"customer": "rahul", "channel": TicketChannel.CHAT, "days_ago": 3, "message": "The mobile app is showing my data in the wrong currency, can you fix that?", "category": TicketCategory.TECHNICAL_ISSUE, "priority": TicketPriority.MEDIUM, "assigned_team": AssignedTeam.TECHNICAL_SUPPORT, "reasoning": "Localized display bug affecting one customer's account settings.", "confidence": 0.77, "resolution": "Corrected a regional settings misconfiguration on the account.", "human_verified": True},
    {"customer": "ananya", "channel": TicketChannel.PHONE, "days_ago": 2, "message": "The Premium Dashboard has been down for me since this morning, is there an outage?", "category": TicketCategory.TECHNICAL_ISSUE, "priority": TicketPriority.HIGH, "assigned_team": AssignedTeam.TECHNICAL_SUPPORT, "reasoning": "Matches an active regional outage affecting this customer's location.", "confidence": 0.93, "resolution": "Confirmed the Mumbai regional outage; provided an ETA and a status page link.", "human_verified": False},
    {"customer": "john", "channel": TicketChannel.EMAIL, "days_ago": 1, "message": "Requesting a call to discuss expanding our Enterprise seats for Analytics Suite.", "category": TicketCategory.PRODUCT_QUERY, "priority": TicketPriority.LOW, "assigned_team": AssignedTeam.PRODUCT_SUPPORT, "reasoning": "Sales/product expansion inquiry, not a support issue.", "confidence": 0.85, "resolution": "Scheduled a call with the account team.", "human_verified": True},
]

# ---------------------------------------------------------------------------
# Demo tickets — unrouted, used to demonstrate live routing (20-ticket demo).
# Each covers a specific scenario called out in the project spec.
# ---------------------------------------------------------------------------

DEMO_TICKETS = [
    {"customer": "sophie", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "This is absolutely ridiculous!! Your mobile app has been crashing for DAYS and nobody is helping me!!"},  # angry customer
    {"customer": "carlos", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "broken"},  # vague message
    {"customer": "priya", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "I can't log in and I think you charged me twice this month."},  # ambiguous billing/account-access
    {"customer": "ananya", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "My Payments Gateway plan shows active and I was charged, but I still can't access any payment features."},  # payment deducted, access missing
    {"customer": "ananya", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "Premium Dashboard is not opening for me at all this morning, is something wrong on your end?"},  # active regional incident
    {"customer": "emma", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "I think someone else logged into my account — I got a login alert from a country I've never visited."},  # security concern
    {"customer": "wei", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "I want a refund for my Analytics Suite subscription, I was charged but never actually used it this cycle."},  # refund request
    {"customer": "john", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "Does Analytics Suite support exporting reports directly to CSV?"},  # general product question
    {"customer": "rahul", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "मेरा डैशबोर्ड नहीं खुल रहा है, कृपया मदद करें।"},  # Hindi message: "My dashboard isn't opening, please help."
    {"customer": "priya", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "This is the third time I'm writing about my Premium Dashboard access being suspended — still not fixed since last week."},  # repeated unresolved issue
    {"customer": "omar", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "I should have access to Premium Dashboard on my plan but it says my account can't use it."},  # customer without access to claimed product
    {"customer": "sophie", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "It would be nice if the Mobile App had a dark mode option someday, not urgent at all."},  # low-priority feature request
    {"customer": "carlos", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "help"},  # very short message
    {"customer": "maria", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "I keep getting logged out of the Mobile App every few minutes and I don't know if this is a bug on your end or if my account was suspended for some reason, because I also noticed my subscription status looked odd yesterday."},  # ambiguous account-access vs technical
    {"customer": "john", "channel": TicketChannel.PHONE, "days_ago": 0, "message": "Our production Analytics Suite dashboards are COMPLETELY DOWN company-wide right now, this is unacceptable, fix it NOW!!"},  # angry + genuine complete outage
    {"customer": "wei", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "What's the difference between the Standard and Premium plans for Analytics Suite?"},  # product query on pricing/plans
    {"customer": "maria", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "You charged me again this month even though I cancelled my Mobile App subscription last week."},  # repeated billing complaint
    {"customer": "emma", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "I received a suspicious email asking me to confirm my password on a link that doesn't look official — is this really from you?"},  # phishing / security report
    {"customer": "rahul", "channel": TicketChannel.CHAT, "days_ago": 0, "message": "Mera account not working properly hai, kripya help kijiye jaldi se."},  # mixed-language message
    {"customer": "emma", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": "Premium Dashboard is loading really slowly for me today, is there some kind of issue?"},  # incident-adjacent but different location (should not match Mumbai incident)
    {"customer": "sophie", "channel": TicketChannel.EMAIL, "days_ago": 0, "message": (
        "I have been a loyal customer for over three years now and I have never had to write in this much detail before, "
        "but I feel like I need to explain the full history of what has been going on with my account because every time "
        "I contact support I get a different answer and nobody seems to actually read the previous notes on my case, so let "
        "me start from the beginning: about two months ago I upgraded my Identity Vault plan to Enterprise, and around the "
        "same time I also added the Mobile App to my subscription, and ever since then I have noticed that roughly once a "
        "week I get logged out unexpectedly from both products at the same time, sometimes in the middle of important work, "
        "and when I log back in everything looks fine for a while until it happens again, and I am not sure if this is related "
        "to the Enterprise upgrade, or some kind of session timeout setting, or possibly a security issue given how often it "
        "happens, and I would really appreciate if someone could actually look into the root cause instead of just telling me "
        "to clear my cache again, because I have already tried that multiple times without any lasting improvement."
    )},  # very long message
]


def _wipe_existing(session) -> None:
    """Clear existing rows and reset id sequences so this script can be re-run and always
    produce the same, predictable ids."""
    session.execute(
        text(
            "TRUNCATE TABLE routing_feedback, tickets, knowledge_documents, incidents, "
            "customer_products, products, customers RESTART IDENTITY CASCADE"
        )
    )
    session.commit()


def _create_products(session) -> dict[str, Product]:
    by_key = {}
    for data in PRODUCTS:
        product = Product(name=data["name"], owning_team=data["owning_team"], status=data["status"])
        session.add(product)
        by_key[data["key"]] = product
    session.flush()
    return by_key


def _create_customers(session) -> dict[str, Customer]:
    by_key = {}
    for data in CUSTOMERS:
        customer = Customer(
            name=data["name"],
            email=data["email"],
            tier=data["tier"],
            location=data["location"],
            preferred_language=data["preferred_language"],
        )
        session.add(customer)
        by_key[data["key"]] = customer
    session.flush()
    return by_key


def _create_customer_products(session, customers: dict[str, Customer], products: dict[str, Product]) -> None:
    for data in CUSTOMER_PRODUCTS:
        session.add(
            CustomerProduct(
                customer_id=customers[data["customer"]].id,
                product_id=products[data["product"]].id,
                plan_name=data["plan_name"],
                subscription_status=data["subscription_status"],
                access_status=data["access_status"],
                expiry_date=data["expiry_date"],
            )
        )
    session.flush()


def _create_incidents(session, products: dict[str, Product]) -> None:
    for data in INCIDENTS:
        session.add(
            Incident(
                title=data["title"],
                description=data["description"],
                product_id=products[data["product"]].id,
                affected_location=data["affected_location"],
                severity=data["severity"],
                status=data["status"],
                started_at=data["started_at"],
                resolved_at=data["resolved_at"],
            )
        )
    session.flush()


def _create_knowledge_documents(session, products: dict[str, Product]) -> None:
    for data in KNOWLEDGE_DOCUMENTS:
        product_id = products[data["product"]].id if data["product"] else None
        session.add(KnowledgeDocument(title=data["title"], content=data["content"], product_id=product_id))
    session.flush()


def _create_historical_tickets(session, customers: dict[str, Customer]) -> None:
    for data in HISTORICAL_TICKETS:
        created_at = NOW - timedelta(days=data["days_ago"])
        session.add(
            Ticket(
                customer_id=customers[data["customer"]].id,
                message=data["message"],
                channel=data["channel"],
                category=data["category"],
                priority=data["priority"],
                assigned_team=data["assigned_team"],
                reasoning=data["reasoning"],
                confidence=data["confidence"],
                needs_human_review=data["confidence"] < 0.75,
                status=TicketStatus.RESOLVED,
                resolution=data["resolution"],
                created_at=created_at,
                resolved_at=created_at + timedelta(hours=6),
                human_verified=data["human_verified"],
            )
        )
    session.flush()


def _create_demo_tickets(session, customers: dict[str, Customer]) -> None:
    for data in DEMO_TICKETS:
        session.add(
            Ticket(
                customer_id=customers[data["customer"]].id,
                message=data["message"],
                channel=data["channel"],
                status=TicketStatus.OPEN,
                created_at=NOW - timedelta(days=data["days_ago"]),
                human_verified=False,
            )
        )
    session.flush()


def seed() -> None:
    session = SessionLocal()
    try:
        _wipe_existing(session)
        products = _create_products(session)
        customers = _create_customers(session)
        _create_customer_products(session, customers, products)
        _create_incidents(session, products)
        _create_knowledge_documents(session, products)
        _create_historical_tickets(session, customers)
        _create_demo_tickets(session, customers)
        session.commit()
        print(
            f"Seeded {len(CUSTOMERS)} customers, {len(PRODUCTS)} products, "
            f"{len(CUSTOMER_PRODUCTS)} customer-product links, {len(INCIDENTS)} incidents, "
            f"{len(KNOWLEDGE_DOCUMENTS)} knowledge documents, {len(HISTORICAL_TICKETS)} historical tickets, "
            f"{len(DEMO_TICKETS)} demo tickets."
        )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
