"""Unit tests for the in-memory login rate limiter."""

from __future__ import annotations

from app.core.login_rate_limit import (
    LOGIN_RATE_LIMIT_MAX_FAILURES,
    LoginRateLimiter,
)


def test_allows_up_to_max_failures_then_blocks() -> None:
    limiter = LoginRateLimiter(max_failures=5, window_seconds=900)
    email = "user@example.com"
    ip = "203.0.113.10"
    now = 1_000.0

    for index in range(LOGIN_RATE_LIMIT_MAX_FAILURES):
        assert limiter.is_blocked(email, ip, now=now + index) is False
        limiter.register_failure(email, ip, now=now + index)

    assert limiter.is_blocked(email, ip, now=now + 5) is True


def test_success_resets_bucket() -> None:
    limiter = LoginRateLimiter(max_failures=5, window_seconds=900)
    email = "user@example.com"
    ip = "203.0.113.10"
    now = 1_000.0
    for index in range(5):
        limiter.register_failure(email, ip, now=now + index)
    assert limiter.is_blocked(email, ip, now=now + 5) is True

    limiter.reset(email, ip)
    assert limiter.is_blocked(email, ip, now=now + 6) is False


def test_buckets_are_scoped_to_email_and_ip() -> None:
    limiter = LoginRateLimiter(max_failures=2, window_seconds=900)
    now = 1_000.0
    limiter.register_failure("a@example.com", "10.0.0.1", now=now)
    limiter.register_failure("a@example.com", "10.0.0.1", now=now + 1)

    assert limiter.is_blocked("a@example.com", "10.0.0.1", now=now + 2) is True
    assert limiter.is_blocked("a@example.com", "10.0.0.2", now=now + 2) is False
    assert limiter.is_blocked("b@example.com", "10.0.0.1", now=now + 2) is False


def test_email_key_is_case_insensitive() -> None:
    limiter = LoginRateLimiter(max_failures=2, window_seconds=900)
    now = 1_000.0
    limiter.register_failure("Admin@Example.com", "10.0.0.1", now=now)
    limiter.register_failure("admin@example.com", "10.0.0.1", now=now + 1)
    assert limiter.is_blocked("ADMIN@example.com", "10.0.0.1", now=now + 2) is True


def test_failures_outside_window_do_not_count() -> None:
    limiter = LoginRateLimiter(max_failures=2, window_seconds=15)
    now = 1_000.0
    limiter.register_failure("user@example.com", "10.0.0.1", now=now)
    limiter.register_failure("user@example.com", "10.0.0.1", now=now + 1)
    assert limiter.is_blocked("user@example.com", "10.0.0.1", now=now + 2) is True
    assert limiter.is_blocked("user@example.com", "10.0.0.1", now=now + 20) is False
