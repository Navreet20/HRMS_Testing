from app.core.roles import Role

TIMESHEET_ROLES = (
    Role.SUPERADMIN,
    Role.ACCOUNTANT,
    Role.ADMIN,
    Role.HR,
    Role.ONBOARDING,
    Role.EMPLOYEE,
    Role.IMMIGRATION,
    Role.MARKETING,
)

HR_STAFF_ROLES = (
    Role.SUPERADMIN,
    Role.ACCOUNTANT,
    Role.ADMIN,
    Role.HR,
    Role.ONBOARDING,
    Role.IMMIGRATION,
    Role.MARKETING,
)

# Profile Activity Log sidebar / read API — HR and Admin only (not Employee).
AUDIT_TRAIL_ROLES = (Role.SUPERADMIN, Role.ADMIN, Role.HR)

# ESS-DATA-5 functional Manage queues (Profile / Asset / IT). Asset Manager & IT
# map to this set until dedicated app roles exist.
ESS_FUNCTIONAL_QUEUE_ROLES = AUDIT_TRAIL_ROLES

# Weekly timesheet approve/reject/lookup besides the reporting manager.
# Superadmin login is SUPERADMIN.
TIMESHEET_ORG_APPROVER_ROLES = (Role.SUPERADMIN, Role.ADMIN, Role.HR)

FINANCE_ROLES = (Role.ADMIN, Role.SUPERADMIN, Role.HR, Role.ACCOUNTANT)

ADMIN_ROLES = (Role.SUPERADMIN, Role.ADMIN)

# Clients directory /clients — HR, Admin, and developer login (SUPERADMIN).
CLIENTS_ROLES = (Role.SUPERADMIN, Role.ADMIN, Role.HR)

APPROVAL_ROLES = (Role.SUPERADMIN, Role.ADMIN, Role.HR, Role.ONBOARDING)

# Company holidays and leave policy setup (Company Setup) — HR and Admin.
LEAVE_ADMIN_ROLES = (Role.SUPERADMIN, Role.ADMIN, Role.HR)
