"""A minimal in-memory sliding-window rate limiter for sensitive auth endpoints
(login, forgot-password, reset-password).

This is intentionally simple: per-process memory, not distributed. That's a
real limitation — a production deployment behind multiple workers/instances
would need a shared store (e.g. Redis) — but it's honest, dependency-free
protection against basic brute-forcing for a local-dev/demo-scale app. See
README "Security assumptions" for this trade-off spelled out explicitly.
"""

import time
from collections import defaultdict


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        """Records an attempt for `key` and returns False if it should be rejected."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        attempts = [t for t in self._attempts[key] if t > cutoff]
        if len(attempts) >= self.max_attempts:
            self._attempts[key] = attempts
            return False
        attempts.append(now)
        self._attempts[key] = attempts
        return True


# Keyed by "endpoint:client_ip:email" by callers, so one abusive client/email
# can't exhaust another's quota.
login_rate_limiter = RateLimiter(max_attempts=10, window_seconds=60)
password_reset_rate_limiter = RateLimiter(max_attempts=5, window_seconds=300)
