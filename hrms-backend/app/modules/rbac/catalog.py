"""System-seeded RBAC module / submodule catalog (HRMS RBAC-DATA-1).

No Create/Edit Module UI in v1 — rows are inserted only by seed/config.

Module keys are the stable contract shared by session ``accessGrants``,
``require_module_access`` on routes, and the frontend nav. Display names may
change; keys must not.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

MODULE_KEY_DASHBOARD: Final = "dashboard"
MODULE_KEY_EMPLOYEES: Final = "employees"
MODULE_KEY_CUSTOMERS: Final = "customers"
MODULE_KEY_PROJECTS: Final = "projects"
MODULE_KEY_ASSETS: Final = "assets"
MODULE_KEY_AUDIT_TRAIL: Final = "activityLog"
MODULE_KEY_COMPANY_SETUP: Final = "companySetup"

MODULE_DASHBOARD: Final = "Dashboard"
MODULE_EMPLOYEES: Final = "Employees"
MODULE_CLIENTS: Final = "Clients"
MODULE_PROJECTS: Final = "Projects"
MODULE_ASSET_MANAGEMENT: Final = "Asset Management"
MODULE_AUDIT_TRAIL: Final = "Activity Log"
MODULE_COMPANY_SETUP: Final = "Company Setup"

SUBMODULE_KEY_ONBOARDING: Final = "onboarding"
SUBMODULE_KEY_COMPANY_PROFILE: Final = "companyProfile"
SUBMODULE_KEY_DEPARTMENTS: Final = "departments"
SUBMODULE_KEY_LOCATIONS: Final = "locations"
SUBMODULE_KEY_DESIGNATIONS: Final = "designations"
SUBMODULE_KEY_LEAVE_POLICY: Final = "leavePolicy"
SUBMODULE_KEY_RBAC: Final = "rbac"

SUBMODULE_ONBOARDING: Final = "Onboarding"
SUBMODULE_COMPANY_PROFILE: Final = "Company Profile"
SUBMODULE_DEPARTMENTS: Final = "Departments"
SUBMODULE_LOCATIONS: Final = "Locations"
SUBMODULE_DESIGNATIONS: Final = "Designations"
SUBMODULE_LEAVE_POLICY: Final = "Leave Policy"
SUBMODULE_RBAC: Final = "RBAC"

# Employee Portal is derived at session time (Self for every employee, Manage
# while anyone reports to them) and is never granted, so it is not in the
# catalog. The display names remain only to recognise legacy stored rows.
MODULE_KEY_EMPLOYEE_PORTAL: Final = "employeePortal"
SUBMODULE_KEY_SELF: Final = "self"
SUBMODULE_KEY_MANAGE: Final = "manage"

MODULE_EMPLOYEE_PORTAL: Final = "Employee Portal"
SUBMODULE_SELF: Final = "Self"
SUBMODULE_MANAGE: Final = "Manage"


@dataclass(frozen=True, slots=True)
class CatalogSubmodule:
    key: str
    name: str


@dataclass(frozen=True, slots=True)
class CatalogModule:
    key: str
    name: str
    display_order: int
    submodules: tuple[CatalogSubmodule, ...] = ()

    @property
    def has_submodules(self) -> bool:
        return bool(self.submodules)


DEFAULT_RBAC_CATALOG: Final[tuple[CatalogModule, ...]] = (
    CatalogModule(MODULE_KEY_DASHBOARD, MODULE_DASHBOARD, 1),
    CatalogModule(
        MODULE_KEY_EMPLOYEES,
        MODULE_EMPLOYEES,
        2,
        (CatalogSubmodule(SUBMODULE_KEY_ONBOARDING, SUBMODULE_ONBOARDING),),
    ),
    CatalogModule(MODULE_KEY_CUSTOMERS, MODULE_CLIENTS, 3),
    CatalogModule(MODULE_KEY_PROJECTS, MODULE_PROJECTS, 4),
    CatalogModule(MODULE_KEY_ASSETS, MODULE_ASSET_MANAGEMENT, 5),
    CatalogModule(MODULE_KEY_AUDIT_TRAIL, MODULE_AUDIT_TRAIL, 6),
    # Submodules mirror the Company Setup sidebar folder, in sidebar order.
    CatalogModule(
        MODULE_KEY_COMPANY_SETUP,
        MODULE_COMPANY_SETUP,
        7,
        (
            CatalogSubmodule(SUBMODULE_KEY_COMPANY_PROFILE, SUBMODULE_COMPANY_PROFILE),
            CatalogSubmodule(SUBMODULE_KEY_DEPARTMENTS, SUBMODULE_DEPARTMENTS),
            CatalogSubmodule(SUBMODULE_KEY_LOCATIONS, SUBMODULE_LOCATIONS),
            CatalogSubmodule(SUBMODULE_KEY_DESIGNATIONS, SUBMODULE_DESIGNATIONS),
            CatalogSubmodule(SUBMODULE_KEY_LEAVE_POLICY, SUBMODULE_LEAVE_POLICY),
            CatalogSubmodule(SUBMODULE_KEY_RBAC, SUBMODULE_RBAC),
        ),
    ),
)

MODULE_KEY_BY_NAME: Final[dict[str, str]] = {
    module.name: module.key for module in DEFAULT_RBAC_CATALOG
}

SUBMODULE_KEY_BY_NAME: Final[dict[str, str]] = {
    sub.name: sub.key
    for module in DEFAULT_RBAC_CATALOG
    for sub in module.submodules
}

# Every key that can appear in session accessGrants (catalog + derived).
SESSION_MODULE_KEYS: Final[frozenset[str]] = frozenset(
    {*MODULE_KEY_BY_NAME.values(), MODULE_KEY_EMPLOYEE_PORTAL}
)
SESSION_SUBMODULE_KEYS: Final[frozenset[str]] = frozenset(
    {*SUBMODULE_KEY_BY_NAME.values(), SUBMODULE_KEY_SELF, SUBMODULE_KEY_MANAGE}
)
