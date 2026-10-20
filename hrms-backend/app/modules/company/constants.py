from __future__ import annotations

COMPANY_TYPES: tuple[str, ...] = (
    "Private Limited",
    "Public Limited",
    "LLC",
    "LLP",
    "C Corporation",
    "S Corporation",
    "Partnership",
    "Sole Proprietorship",
    "Non Profit",
)

COMPANY_TYPE_SET = frozenset(COMPANY_TYPES)

WEBSITE_INVALID_MESSAGE = "Enter a valid website URL (for example https://company.com)."
COMPANY_TYPE_INVALID_MESSAGE = "Select a company type from the list."
MAX_LOGO_BYTES = 1024 * 1024
MAX_LOGO_LABEL = "1MB"
LOGO_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/svg+xml",
    }
)
LOGO_INVALID_MESSAGE = "Logo must be a JPG, PNG, WebP, or SVG, 1MB or smaller."
