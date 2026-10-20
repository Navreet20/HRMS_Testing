"""In-memory login rate limiter (email + IP).

Single-process only: buckets live in this worker's memory. Multi-instance
or multi-worker deployments need a shared store (for example Redis).
"""

from __future__ import annotations

import time
from threading import Lock

from fastapi import Request

LOGIN_RATE_LIMIT_MAX_FAILURES = 5
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60
LOGIN_RATE_LIMIT_MESSAGE = (
    "Too many failed sign-in attempts. Try again in 15 minutes."
)


def client_ip_from_request(request: Request) -> str:
    """Best-effort client IP; first X-Forwarded-For hop when present."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hop = forwarded.split(",")[0].strip()
        if hop:
            return hop
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class LoginRateLimiter:
    """Sliding-window counter of failed logins keyed by email+IP."""

    def __init__(
        self,
        *,
        max_failures: int = LOGIN_RATE_LIMIT_MAX_FAILURES,
        window_seconds: int = LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        self._max_failures = max_failures
        self._window_seconds = window_seconds
        self._lock = Lock()
        self._failures: dict[str, list[float]] = {}

    def bucket_key(self, email: str, ip: str) -> str:
        return f"{email.strip().lower()}|{ip.strip()}"

    def _prune(self, stamps: list[float], now: float) -> list[float]:
        cutoff = now - self._window_seconds
        return [stamp for stamp in stamps if stamp > cutoff]

    def is_blocked(self, email: str, ip: str, *, now: float | None = None) -> bool:
        moment = time.monotonic() if now is None else now
        key = self.bucket_key(email, ip)
        with self._lock:
            stamps = self._prune(self._failures.get(key, []), moment)
            if stamps:
                self._failures[key] = stamps
            else:
                self._failures.pop(key, None)
            return len(stamps) >= self._max_failures

    def register_failure(
        self, email: str, ip: str, *, now: float | None = None
    ) -> None:
        moment = time.monotonic() if now is None else now
        key = self.bucket_key(email, ip)
        with self._lock:
            stamps = self._prune(self._failures.get(key, []), moment)
            stamps.append(moment)
            self._failures[key] = stamps

    def reset(self, email: str, ip: str) -> None:
        key = self.bucket_key(email, ip)
        with self._lock:
            self._failures.pop(key, None)

    def reset_all(self) -> None:
        with self._lock:
            self._failures.clear()


login_rate_limiter = LoginRateLimiter()
