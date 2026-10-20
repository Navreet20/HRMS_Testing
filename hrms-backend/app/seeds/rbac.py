"""The RBAC modules and submodules. This list is the source of truth: on every start, schema_ensure writes it to
the modules and submodules tables (insert new rows, update changed ones), so a change here reaches every database.

How to change the list:
- Add: append a row with a NEW id (never reuse an id, even one that was retired).
- Rename or reorder: edit the key, display name or display order in place; the id stays. Code and the frontend look
  modules up by key, so update every use of an old key in the same change.
- Retire: keep the row and set is_active=False. Never delete a row: grants point at it, and rows missing from this
  list are left in the database untouched.
Keys are camelCase (ck_modules_key, ck_submodules_key), the same keys the frontend uses."""
from typing import NamedTuple

from sqlalchemy.dialects.postgresql import insert

from app.models.employee_master import Module, Submodule


class ModuleRow(NamedTuple):
    id: int
    key: str
    display_name: str
    display_order: int
    is_active: bool = True


class SubmoduleRow(NamedTuple):
    id: int
    module_id: int
    key: str
    display_name: str
    display_order: int
    is_active: bool = True


MODULES = (
    ModuleRow(1, "employees", "Employees", 1),
    ModuleRow(2, "customers", "Clients", 2),
    ModuleRow(3, "projects", "Projects", 3),
    ModuleRow(4, "assets", "Asset Management", 4),
    ModuleRow(5, "activityLog", "Activity Log", 5),
    ModuleRow(6, "companySetup", "Company Setup", 6),
)

SUBMODULES = (
    SubmoduleRow(1, 1, "onboarding", "Onboarding", 1),
    SubmoduleRow(2, 6, "companyProfile", "Company Profile", 1),
    SubmoduleRow(3, 6, "departments", "Departments", 2),
    SubmoduleRow(4, 6, "locations", "Locations", 3),
    SubmoduleRow(5, 6, "designations", "Designations", 4),
    SubmoduleRow(6, 6, "leavePolicy", "Leave Policy", 5),
    SubmoduleRow(7, 6, "rbac", "RBAC", 6),
)


def check_lists(modules=MODULES, submodules=SUBMODULES) -> None:
    """Raise ValueError if the lists contradict themselves, so a bad edit stops the start instead of half-applying."""
    for name, rows in (("module", modules), ("submodule", submodules)):
        ids = [r.id for r in rows]
        keys = [r.key for r in rows]
        if len(set(ids)) != len(ids):
            raise ValueError(f"two {name}s share an id: {sorted(i for i in ids if ids.count(i) > 1)}")
        if len(set(keys)) != len(keys):
            raise ValueError(f"two {name}s share a key: {sorted(k for k in keys if keys.count(k) > 1)}")
    module_ids = {m.id for m in modules}
    for s in submodules:
        if s.module_id not in module_ids:
            raise ValueError(f"submodule {s.key!r} points at module id {s.module_id}, which is not in MODULES")


def seed_statements(modules=MODULES, submodules=SUBMODULES):
    """The upserts that write the lists: modules first (submodules point at them). A row that already exists is
    updated to match the list; is_active is written too, so retiring is a change in the list."""
    check_lists(modules, submodules)
    m = insert(Module).values([
        dict(id=r.id, module_key=r.key, display_name=r.display_name, display_order=r.display_order,
             is_active=r.is_active) for r in modules])
    s = insert(Submodule).values([
        dict(id=r.id, module_id=r.module_id, submodule_key=r.key, display_name=r.display_name,
             display_order=r.display_order, is_active=r.is_active) for r in submodules])
    return (
        m.on_conflict_do_update(index_elements=["id"], set_={
            c: m.excluded[c] for c in ("module_key", "display_name", "display_order", "is_active")}),
        s.on_conflict_do_update(index_elements=["id"], set_={
            c: s.excluded[c] for c in ("module_id", "submodule_key", "display_name", "display_order", "is_active")}),
    )
