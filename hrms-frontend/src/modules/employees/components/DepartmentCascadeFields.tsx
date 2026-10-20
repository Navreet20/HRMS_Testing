"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  departmentPathLabel,
  selectChildDepartments,
  selectRootDepartments,
} from "../selectors";
import type { OrgDepartmentOption } from "../types";
import { cx, ui } from "../uiClasses";
import { COMBOBOX_FOCUS } from "@/shared/ui/fieldChrome";

interface DepartmentCascadeFieldsProps {
  readonly departments: readonly OrgDepartmentOption[];
  readonly departmentId: string | null | undefined;
  readonly readOnly: boolean;
  readonly required?: boolean;
  readonly hint?: ReactNode;
  readonly onChange: (patch: {
    readonly departmentId: string | null;
    readonly departmentName: string | null;
  }) => void;
}

interface MenuBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

function menuBoxFromInput(input: HTMLElement): MenuBox {
  const rect = input.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width,
  };
}

function CascadeFieldLabel({
  children,
  required = false,
}: {
  readonly children: string;
  readonly required?: boolean;
}) {
  return (
    <span className={ui.fieldLabel}>
      {children}
      {required ? (
        <span className={ui.fieldRequired} aria-hidden="true">
          {" *"}
        </span>
      ) : null}
    </span>
  );
}

function departmentById(
  departments: readonly OrgDepartmentOption[],
  id: string | null | undefined,
): OrgDepartmentOption | undefined {
  if (!id) {
    return undefined;
  }
  return departments.find((row) => row.departmentId === id);
}

/**
 * Single-field department picker: type in the field to search, or browse parents
 * and drill into children. Closed value shows Parent / Child path.
 */
export function DepartmentCascadeFields({
  departments,
  departmentId,
  readOnly,
  required = false,
  hint,
  onChange,
}: DepartmentCascadeFieldsProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [browseParentId, setBrowseParentId] = useState<string | null>(null);
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);

  const roots = useMemo(
    () => selectRootDepartments(departments),
    [departments],
  );

  const browseParent = departmentById(departments, browseParentId);
  const levelRows = useMemo(() => {
    if (!browseParentId) {
      return roots;
    }
    return selectChildDepartments(departments, browseParentId);
  }, [browseParentId, departments, roots]);

  const searchMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    return departments
      .filter((row) =>
        row.departmentName.toLowerCase().includes(needle),
      )
      .slice()
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }, [departments, query]);

  const pathLabel = departmentPathLabel(departments, departmentId);
  const searching = query.trim().length > 0;

  useLayoutEffect(() => {
    if (!open || !inputRef.current) {
      setMenuBox(null);
      return;
    }
    function update() {
      if (!inputRef.current) {
        return;
      }
      setMenuBox(menuBoxFromInput(inputRef.current));
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, levelRows.length, searchMatches.length, browseParentId, searching]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setBrowseParentId(null);
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function assignDepartment(id: string) {
    onChange({
      departmentId: id,
      departmentName: departmentPathLabel(departments, id) || null,
    });
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearDepartment() {
    onChange({ departmentId: null, departmentName: null });
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleRowActivate(row: OrgDepartmentOption) {
    const children = selectChildDepartments(departments, row.departmentId);
    if (!searching && children.length > 0) {
      setBrowseParentId(row.departmentId);
      setQuery("");
      return;
    }
    assignDepartment(row.departmentId);
  }

  if (readOnly) {
    return (
      <div className={ui.viewField}>
        <span className={ui.viewFieldLabel}>Department</span>
        <p
          className={
            pathLabel ? ui.viewFieldValue : ui.viewFieldValueMuted
          }
        >
          {pathLabel || "—"}
        </p>
        {hint}
      </div>
    );
  }

  const closedDisplayValue = pathLabel || "";
  const displayValue = open ? query : closedDisplayValue;
  const looksSelected = Boolean(closedDisplayValue);
  const listRows = searching ? searchMatches : levelRows;

  const menu =
    open && menuBox && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            ref={menuRef}
            className={ui.selectMenu}
            role="listbox"
            aria-label="Department"
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
          >
            {!searching && browseParentId ? (
              <li role="presentation">
                <button
                  type="button"
                  className={ui.selectOption}
                  onClick={() => {
                    const parentId = browseParent?.parentDepartmentId;
                    const hasParent =
                      Boolean(parentId) &&
                      departments.some(
                        (row) => row.departmentId === parentId,
                      );
                    setBrowseParentId(hasParent ? parentId! : null);
                  }}
                >
                  ←{" "}
                  {browseParent?.parentDepartmentId
                    ? departmentById(
                        departments,
                        browseParent.parentDepartmentId,
                      )?.departmentName ?? "All departments"
                    : "All departments"}
                </button>
              </li>
            ) : null}
            {!searching && browseParent && browseParentId ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={departmentId === browseParentId}
                  className={
                    departmentId === browseParentId
                      ? ui.selectOptionSelected
                      : ui.selectOption
                  }
                  onClick={() => assignDepartment(browseParentId)}
                >
                  {browseParent.departmentName}
                </button>
              </li>
            ) : null}
            {!searching && !browseParentId ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={!departmentId}
                  className={
                    !departmentId
                      ? ui.selectOptionSelected
                      : ui.selectOption
                  }
                  onClick={clearDepartment}
                >
                  Select department
                </button>
              </li>
            ) : null}
            {listRows.map((row) => {
              const children = selectChildDepartments(
                departments,
                row.departmentId,
              );
              const canDrill = !searching && children.length > 0;
              const isSelected = row.departmentId === departmentId;
              const label =
                searching || browseParentId
                  ? departmentPathLabel(departments, row.departmentId) ||
                    row.departmentName
                  : row.departmentName;
              return (
                <li key={row.departmentId} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={
                      isSelected ? ui.selectOptionSelected : ui.selectOption
                    }
                    onClick={() => handleRowActivate(row)}
                  >
                    {canDrill ? `${label} ›` : label}
                  </button>
                </li>
              );
            })}
            {listRows.length === 0 ? (
              <li className={ui.muted} role="presentation">
                <span className="block px-[0.6rem] py-2 text-[0.88rem]">
                  No matches
                </span>
              </li>
            ) : null}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={ui.field}>
      <CascadeFieldLabel required={required}>Department</CascadeFieldLabel>
      <div
        className={cx(
          "emp-search-combobox",
          open ? ui.selectOpen : ui.select,
        )}
        ref={rootRef}
      >
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Department"
          aria-required={required || undefined}
          placeholder="Search department"
          data-menu-open={open ? "true" : undefined}
          className={cx(
            "emp-search-combobox__input",
            COMBOBOX_FOCUS,
            looksSelected ? ui.selectTrigger : ui.selectTriggerEmpty,
            !open && "focus-visible:!outline-none",
          )}
          value={displayValue}
          autoComplete="off"
          onClick={() => {
            if (!open) {
              setOpen(true);
              setQuery("");
            }
          }}
          onChange={(event) => {
            setOpen(true);
            setBrowseParentId(null);
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (
              !open &&
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              setOpen(true);
              setBrowseParentId(null);
              setQuery(event.key);
              event.preventDefault();
              return;
            }
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              setOpen(true);
              setQuery("");
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (open && searching && searchMatches[0]) {
                assignDepartment(searchMatches[0].departmentId);
              }
            }
          }}
        />
        {required ? (
          <input
            className={ui.selectRequired}
            tabIndex={-1}
            aria-hidden="true"
            required
            value={departmentId ?? ""}
            onChange={() => undefined}
          />
        ) : null}
        {menu}
      </div>
      {hint}
    </div>
  );
}
