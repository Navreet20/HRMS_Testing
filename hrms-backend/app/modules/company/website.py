from __future__ import annotations

from urllib.parse import urlparse, urlunparse

from app.modules.company.constants import WEBSITE_INVALID_MESSAGE

_BLOCKED_SCHEMES = frozenset({"javascript", "data", "ftp", "file", "mailto", "vbscript"})
_ALLOWED_SCHEMES = frozenset({"http", "https"})


def normalize_company_website(raw: str | None) -> str:
    """Return a stored http(s) URL, or raise ValueError with a user-facing message."""
    text = (raw or "").strip()
    if not text or any(character.isspace() for character in text):
        raise ValueError(WEBSITE_INVALID_MESSAGE)

    lowered = text.lower()
    for scheme in _BLOCKED_SCHEMES:
        if lowered.startswith(f"{scheme}:"):
            raise ValueError(WEBSITE_INVALID_MESSAGE)

    if "://" not in text:
        text = f"https://{text}"

    parsed = urlparse(text)
    scheme = (parsed.scheme or "").lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise ValueError(WEBSITE_INVALID_MESSAGE)
    if parsed.username or parsed.password:
        raise ValueError(WEBSITE_INVALID_MESSAGE)

    host = (parsed.hostname or "").strip().rstrip(".")
    if not host or "." not in host or host.startswith(".") or host.endswith("."):
        raise ValueError(WEBSITE_INVALID_MESSAGE)

    path = parsed.path if parsed.path not in ("", "/") else ""
    normalized = urlunparse(
        (scheme, parsed.netloc.lower(), path, parsed.params, parsed.query, parsed.fragment)
    )
    return normalized
