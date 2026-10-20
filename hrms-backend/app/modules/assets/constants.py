"""Asset Management constants (enums + category seed + ID short codes)."""

from __future__ import annotations

ASSET_STATUS_IN_STOCK = "In Stock"
ASSET_STATUS_ASSIGNED = "Assigned"
ASSET_STATUS_UNDER_REPAIR = "Under Repair"
ASSET_STATUS_DECOMMISSIONED = "Decommissioned"
ASSET_STATUS_LOST = "Lost"

ASSET_STATUSES = frozenset(
    {
        ASSET_STATUS_IN_STOCK,
        ASSET_STATUS_ASSIGNED,
        ASSET_STATUS_UNDER_REPAIR,
        ASSET_STATUS_DECOMMISSIONED,
        ASSET_STATUS_LOST,
    }
)

ASSET_CONDITIONS = frozenset({"New", "Good", "Fair", "Poor"})

# Extra cover beyond standard manufacturer warranty (serial + receipt).
# Blank/omitted → None (standard manufacturer warranty). Number is stored
# separately on WARRANTY_PLAN and is ignored until a type is set.
WARRANTY_PLAN_TYPE_OPTIONS: tuple[str, ...] = (
    "AppleCare / AppleCare+",
    "Store / retailer protection",
    "Dell ProSupport",
    "HP Care Pack",
    "Other",
)
WARRANTY_PLAN_TYPES = frozenset(WARRANTY_PLAN_TYPE_OPTIONS)

# Inclusive "warranty expiring soon" window: today through today + N days.
# Already-expired dates are out of range (not "soon").
WARRANTY_EXPIRING_SOON_DAYS = 30

# OS platform values allowed per category name. Categories absent from this
# map (Keyboard, Mouse, Monitor, Access Card, …) have no valid values —
# providing osPlatform for those categories must be rejected.
# Values are sets for membership checks only — never use as an implicit default
# (blank/omitted osPlatform must stay None, including for Mobile).
OS_PLATFORMS_BY_CATEGORY: dict[str, frozenset[str]] = {
    "Laptop": frozenset({"Mac", "Windows"}),
    "Mobile": frozenset({"iOS", "Android"}),
}

# All filter/update-accepted OS values (union across categories).
OS_PLATFORMS: frozenset[str] = frozenset().union(*OS_PLATFORMS_BY_CATEGORY.values())

# Manufacturer serial is required for these categories only. Others stay
# optional (blank → None). SERIAL_NUMBER remains nullable; no uniqueness.
SERIAL_REQUIRED_CATEGORIES: frozenset[str] = frozenset({"Laptop", "Mobile"})


def allowed_os_platforms_for_category(category_name: str) -> set[str]:
    """Return the allowed osPlatform values for a category (empty if none)."""
    name = (category_name or "").strip()
    return set(OS_PLATFORMS_BY_CATEGORY.get(name, frozenset()))


def normalize_optional_os_platform(raw: object, category_name: str) -> str | None:
    """Validate optional osPlatform for create/update.

    Blank, missing, or whitespace-only → None (never invent Android/iOS/Mac/Windows).
    Non-empty values must be in the category allow-list.
    """
    if raw is None or str(raw).strip() == "":
        return None
    platform = str(raw).strip()
    allowed = allowed_os_platforms_for_category(category_name)
    if not allowed:
        raise ValueError(
            f"osPlatform is not allowed for category {category_name}"
        )
    if platform not in allowed:
        raise ValueError(
            f"osPlatform must be one of: {', '.join(sorted(allowed))} "
            f"for category {category_name}"
        )
    return platform


def serial_number_required_for_category(category_name: str) -> bool:
    """True when manufacturer serial is required (Laptop, Mobile)."""
    return (category_name or "").strip() in SERIAL_REQUIRED_CATEGORIES


def normalize_optional_warranty_plan_type(raw: object) -> str | None:
    """Validate optional extra warranty-plan type for create/update.

    Blank, missing, or whitespace-only → None (standard manufacturer warranty).
    Non-empty values must be in WARRANTY_PLAN_TYPES.
    """
    if raw is None or str(raw).strip() == "":
        return None
    plan_type = str(raw).strip()
    if plan_type not in WARRANTY_PLAN_TYPES:
        raise ValueError(
            "warrantyPlanType must be one of: "
            + ", ".join(WARRANTY_PLAN_TYPE_OPTIONS)
        )
    return plan_type


def normalize_optional_serial_number(raw: object, category_name: str) -> str | None:
    """Validate serialNumber for create/update.

    Blank, missing, or whitespace-only → None, except Laptop/Mobile which
    require a non-blank value. Duplicate serials are allowed (assetId is
    the unique sticker).
    """
    serial = None if raw is None or str(raw).strip() == "" else str(raw).strip()
    if serial is None and serial_number_required_for_category(category_name):
        name = (category_name or "").strip() or "this category"
        raise ValueError(f"serialNumber is required for category {name}")
    return serial


RETURN_REASONS = frozenset({"Employee terminated", "Broken", "Other"})
# Swap replaces hardware for the same employee — not offboarding.
SWAP_REASONS = frozenset({"Broken", "Upgrade", "Other"})

ACTION_CREATED = "Created"
ACTION_UPDATED = "Updated"
ACTION_ASSIGNED = "Assigned"
ACTION_RETURNED = "Returned"
ACTION_SWAPPED = "Swapped"
ACTION_UNDER_REPAIR = "Under Repair"
ACTION_DECOMMISSIONED = "Decommissioned"
ACTION_RETURNED_TO_STOCK = "Returned to stock"
ACTION_REPORTED_LOST = "Reported lost"
ACTION_FOUND = "Found"

# Why an asset is being reported missing. Stored on the closed allocation and
# in the activity log.
LOST_REASONS = frozenset({"Lost", "Stolen"})

# What the finder says about a recovered asset decides where it goes next:
# working → In Stock, damaged → Under Repair, beyond repair → Decommissioned.
# Value: (new status, condition stored on the asset).
FOUND_CONDITIONS: dict[str, tuple[str, str]] = {
    "Good": (ASSET_STATUS_IN_STOCK, "Good"),
    "Damaged": (ASSET_STATUS_UNDER_REPAIR, "Poor"),
    "Not repairable": (ASSET_STATUS_DECOMMISSIONED, "Poor"),
}

SEED_ASSET_CATEGORIES: tuple[str, ...] = (
    "Laptop",
    "Mobile",
    "Keyboard",
    "Mouse",
    "Monitor",
    "Access Card",
)

# Short codes used in business asset_id: {company}-{short}-{NNNN}
CATEGORY_SHORT_CODES: dict[str, str] = {
    "Laptop": "LAP",
    "Mobile": "MOB",
    "Keyboard": "KEY",
    "Mouse": "MOU",
    "Monitor": "MON",
    "Access Card": "ACC",
}


def category_short_code(category_name: str) -> str:
    """Map category name → 3-letter short code (known map, else first 3 letters)."""
    name = (category_name or "").strip()
    if name in CATEGORY_SHORT_CODES:
        return CATEGORY_SHORT_CODES[name]
    compact = "".join(name.split()).upper()
    if len(compact) >= 3:
        return compact[:3]
    return (compact + "XXX")[:3]


def company_code_prefix(company_name: str) -> str:
    """First 3 letters of the company name (EAOVA → EAO, Cognivance → COG)."""
    letters = "".join(ch for ch in (company_name or "") if ch.isalpha()).upper()
    if len(letters) >= 3:
        return letters[:3]
    return (letters + "XXX")[:3]


def next_asset_id_from_existing(
    existing_codes: list[str],
    short: str,
    company_code: str,
) -> str:
    """Pick next {company}-{short}-NNNN from existing business codes for that prefix."""
    code = (company_code or "").strip().upper() or "XXX"
    prefix = f"{code}-{short}-"
    prefix_upper = prefix.upper()
    max_n = 0
    for row in existing_codes:
        text = str(row or "").strip()
        if not text.upper().startswith(prefix_upper):
            continue
        suffix = text[len(prefix) :]
        if suffix.isdigit():
            max_n = max(max_n, int(suffix))
    return f"{prefix}{max_n + 1:04d}"
