"""Development-only "email" delivery: logs the message instead of sending it.

No real email provider is configured for this project. Password-reset,
email-verification, and agent-invitation links are written to the
application log, clearly prefixed, so they're easy to find and use locally.
Never wire this up to return tokens/links in an HTTP response body — see
app/api/auth.py and app/api/admin.py, which always return a generic
confirmation message regardless of what this function does.
"""

import logging

logger = logging.getLogger("app.dev_email")


def send_dev_email(to: str, subject: str, body: str) -> None:
    logger.info("[DEV EMAIL] To: %s | Subject: %s\n%s", to, subject, body)
