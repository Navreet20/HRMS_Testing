"""Guards that RBAC module keys stay in sync across catalog, routes, and frontend."""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

from app.modules.rbac import catalog
from app.modules.rbac.access import require_module_access
from app.modules.rbac.catalog import SESSION_MODULE_KEYS, SESSION_SUBMODULE_KEYS

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_APP_DIR = _BACKEND_ROOT / "app"
_FRONTEND_GRANTS = (
    _BACKEND_ROOT.parent / "hrms-frontend" / "src" / "shared" / "accessGrants.ts"
)
_ACCESS_CALLS = {"require_module_access", "resolve_module_access_level"}


def test_require_module_access_rejects_unknown_keys() -> None:
    with pytest.raises(ValueError, match="Unknown RBAC module key"):
        require_module_access("payroll")
    with pytest.raises(ValueError, match="Unknown RBAC submodule key"):
        require_module_access("employeePortal", submodule_key="payroll")


def test_session_keys_cover_catalog_and_derived_employee_portal() -> None:
    assert {entry.key for entry in catalog.DEFAULT_RBAC_CATALOG} < SESSION_MODULE_KEYS
    assert SESSION_MODULE_KEYS - {e.key for e in catalog.DEFAULT_RBAC_CATALOG} == {
        catalog.MODULE_KEY_EMPLOYEE_PORTAL
    }
    assert {catalog.SUBMODULE_KEY_SELF, catalog.SUBMODULE_KEY_MANAGE} <= (
        SESSION_SUBMODULE_KEYS
    )


def _key_arg(call: ast.Call, *, position: int | None, keyword: str) -> ast.expr | None:
    """Argument by keyword, or by position when the parameter is positional."""
    for kw in call.keywords:
        if kw.arg == keyword:
            return kw.value
    if position is not None and len(call.args) > position:
        return call.args[position]
    return None


def _resolve_key(node: ast.expr) -> str | None:
    """Literal or catalog constant → key string; None for runtime variables."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Name) and node.id.isupper():
        value = getattr(catalog, node.id, None)
        assert isinstance(value, str), f"{node.id} is not a catalog key constant"
        return value
    return None


def _access_call_keys() -> list[tuple[str, int, str, str]]:
    """(file, line, kind, key) for every module/submodule key passed to access checks."""
    found: list[tuple[str, int, str, str]] = []
    for path in sorted(_APP_DIR.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name not in _ACCESS_CALLS:
                continue
            # require_module_access(module_key, ...); resolve_* takes keywords only.
            position = 0 if name == "require_module_access" else None
            rel = str(path.relative_to(_BACKEND_ROOT))
            for kind, arg in (
                ("module", _key_arg(node, position=position, keyword="module_key")),
                ("submodule", _key_arg(node, position=None, keyword="submodule_key")),
            ):
                key = _resolve_key(arg) if arg is not None else None
                if key is not None:
                    found.append((rel, node.lineno, kind, key))
    return found


def test_every_route_access_check_uses_a_known_key() -> None:
    found = _access_call_keys()
    assert found, "expected require_module_access / resolve_module_access_level calls"
    unknown = [
        f"{file}:{line} {kind} key {key!r}"
        for file, line, kind, key in found
        if key not in (SESSION_MODULE_KEYS if kind == "module" else SESSION_SUBMODULE_KEYS)
    ]
    assert not unknown, "Keys missing from rbac/catalog.py:\n" + "\n".join(unknown)


@pytest.mark.skipif(
    not _FRONTEND_GRANTS.is_file(),
    reason="hrms-frontend not checked out next to hrms-backend",
)
def test_frontend_grant_module_keys_match_backend() -> None:
    source = _FRONTEND_GRANTS.read_text(encoding="utf-8")
    match = re.search(r"GRANT_MODULE_KEYS\s*=\s*\[(.*?)\]\s*as const", source, re.S)
    assert match, "GRANT_MODULE_KEYS not found in frontend accessGrants.ts"
    frontend_keys = set(re.findall(r"""["']([A-Za-z]+)["']""", match.group(1)))
    assert frontend_keys == SESSION_MODULE_KEYS


@pytest.mark.skipif(
    not _FRONTEND_GRANTS.exists(),
    reason="hrms-frontend not checked out next to hrms-backend",
)
def test_frontend_grant_submodule_keys_match_backend() -> None:
    source = _FRONTEND_GRANTS.read_text(encoding="utf-8")
    match = re.search(r"GRANT_SUBMODULE_KEYS\s*=\s*\[(.*?)\]\s*as const", source, re.S)
    assert match, "GRANT_SUBMODULE_KEYS not found in frontend accessGrants.ts"
    frontend_keys = set(re.findall(r"""["']([A-Za-z]+)["']""", match.group(1)))
    assert frontend_keys == SESSION_SUBMODULE_KEYS
