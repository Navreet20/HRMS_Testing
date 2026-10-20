import { useEffect, useState } from "react";

import { StatusBadge } from "@/shared/ui/StatusBadge";
import { WORK_MODE_LABELS, WORK_MODES } from "../constants";
import {
  activeSkills,
  filterDocumentTypesForCountry,
  nationalityForDocumentTypes,
  nationalIdFormatHint,
  nationalIdFormatPlaceholder,
  nationalIdMaxInputLength,
  clampNationalIdNumberInput,
  nationalIdNumberError,
  resolveNationalIdDocumentTypeId,
  isMaskedNationalIdNumber,
} from "../employeeCatalog";
import { emptyOrgCatalogHint } from "../orgCatalogHints";
import type {
  EmployeeSkillEntry,
  NationalIdDocumentTypeOption,
  SkillCatalogOption,
} from "../types";
import { EmployeesSearchCombobox } from "./EmployeesSearchCombobox";
import { EmployeesSelect } from "./EmployeesSelect";
import { ui } from "../uiClasses";

interface EmployeeNationalIdFieldsProps {
  readonly workMode?: string;
  readonly nationality: string;
  readonly nationalIdNumber?: string;
  readonly documentTypeId: string;
  readonly documentTypeCode?: string;
  readonly last4: string;
  readonly types: readonly NationalIdDocumentTypeOption[];
  readonly catalogError?: string | null;
  readonly readOnly?: boolean;
  readonly showWorkMode?: boolean;
  readonly showDocumentFields?: boolean;
  /** Format hints, last4 note, and inline validation (entry + review edit). */
  readonly showFieldHints?: boolean;
  readonly onWorkModeChange?: (workMode: string) => void;
  readonly onDocumentTypeIdChange: (documentTypeId: string) => void;
  readonly onNationalIdNumberChange?: (nationalIdNumber: string) => void;
}

interface CatalogSkillPickerProps {
  readonly selectedIds: readonly string[];
  readonly catalog: readonly SkillCatalogOption[];
  readonly catalogError?: string | null;
  readonly readOnly?: boolean;
  readonly skillEntries?: readonly EmployeeSkillEntry[];
  readonly onChange: (
    skillIds: readonly string[],
    skillNames: readonly string[],
  ) => void;
}

function entryStatusTone(
  entry: EmployeeSkillEntry,
): "neutral" | "info" {
  if (entry.kind === "employee_only") {
    return "info";
  }
  return "neutral";
}

function entryStatusLabel(entry: EmployeeSkillEntry): string {
  if (entry.kind === "employee_only") {
    return "Custom (not in catalog)";
  }
  return entry.status;
}

/** Work mode (employment) + national ID type and optional full number. */
export function EmployeeNationalIdFields({
  workMode = "",
  nationality,
  nationalIdNumber = "",
  documentTypeId,
  documentTypeCode = "",
  last4,
  types,
  catalogError = null,
  readOnly = false,
  showWorkMode = true,
  showDocumentFields = true,
  showFieldHints = true,
  onWorkModeChange,
  onDocumentTypeIdChange,
  onNationalIdNumberChange,
}: EmployeeNationalIdFieldsProps) {
  const country = nationalityForDocumentTypes(nationality);
  const filtered = filterDocumentTypesForCountry(types, country);
  const selectValue = resolveNationalIdDocumentTypeId({
    documentTypeId,
    documentTypeCode,
    types: filtered,
  });
  const selectedType =
    filtered.find((row) => row.documentTypeId === selectValue) ?? null;
  const formatHint = nationalIdFormatHint(selectedType, country);
  const formatPlaceholder = nationalIdFormatPlaceholder(selectedType, country);
  const maxInputLength = selectedType
    ? nationalIdMaxInputLength(selectedType.documentTypeCode, country)
    : undefined;
  const rawNumber = nationalIdNumber.trim();
  const numberFormatError =
    showFieldHints &&
    onNationalIdNumberChange &&
    rawNumber &&
    !isMaskedNationalIdNumber(rawNumber)
      ? nationalIdNumberError({
          nationalIdNumber,
          documentTypeId: selectValue || null,
          documentTypeCode,
          types,
          nationality,
        })
      : null;

  useEffect(() => {
    if (types.length === 0) {
      return;
    }
    const resolvedFromCode = documentTypeCode
      ? resolveNationalIdDocumentTypeId({
          documentTypeId: "",
          documentTypeCode,
          types,
        })
      : "";
    const effectiveValue = selectValue || resolvedFromCode;
    if (effectiveValue && effectiveValue !== documentTypeId) {
      onDocumentTypeIdChange(effectiveValue);
      return;
    }
    if (documentTypeId && !effectiveValue) {
      onDocumentTypeIdChange("");
    }
  }, [
    documentTypeCode,
    documentTypeId,
    onDocumentTypeIdChange,
    selectValue,
    types,
  ]);

  const typeHint = catalogError
    ? catalogError
    : !country
      ? "Select nationality first"
      : filtered.length === 0
        ? emptyOrgCatalogHint("nationalIdType")
        : null;

  return (
    <>
      {showWorkMode ? (
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Work mode</span>
          <EmployeesSearchCombobox
            value={workMode}
            disabled={readOnly}
            placeholder="Search work mode"
            emptyLabel="Select work mode"
            noMatchesMessage="No matching work modes"
            aria-label="Work mode"
            options={WORK_MODES.map((mode) => ({
              value: mode,
              label: WORK_MODE_LABELS[mode],
            }))}
            onChange={onWorkModeChange ?? (() => undefined)}
          />
        </label>
      ) : null}
      {showDocumentFields ? (
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Government ID type</span>
          <EmployeesSearchCombobox
            value={selectValue}
            disabled={readOnly || filtered.length === 0}
            inputClassName={
              readOnly || filtered.length === 0 ? ui.fieldInputSystem : undefined
            }
            placeholder="Search government ID type"
            emptyLabel="Select government ID type"
            noMatchesMessage="No matching ID types"
            aria-label="Government ID type"
            options={filtered.map((row) => ({
              value: row.documentTypeId,
              label: row.documentTypeLabel,
            }))}
            onChange={onDocumentTypeIdChange}
          />
          {showFieldHints && typeHint ? (
            <span className={ui.muted}>{typeHint}</span>
          ) : showFieldHints && last4 ? (
            <span className={ui.fieldHint}>
              Government ID on file ends in {last4}. The full number is not shown.
            </span>
          ) : null}
        </label>
      ) : null}
      {showDocumentFields && onNationalIdNumberChange ? (
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Government ID number</span>
          <input
            value={nationalIdNumber}
            disabled={readOnly || !selectValue}
            className={
              readOnly || !selectValue ? ui.fieldInputSystem : undefined
            }
            autoComplete="off"
            aria-label="Government ID number"
            aria-invalid={numberFormatError ? true : undefined}
            maxLength={maxInputLength}
            placeholder={
              selectValue
                ? last4
                  ? "Leave blank to keep ID on file"
                  : formatPlaceholder
                    ? `e.g. ${formatPlaceholder}`
                    : "Enter the ID number"
                : "Select a government ID type first"
            }
            onChange={(event) => {
              const next = selectedType
                ? clampNationalIdNumberInput(
                    selectedType.documentTypeCode,
                    event.target.value,
                    country,
                  )
                : event.target.value;
              onNationalIdNumberChange(next);
            }}
          />
          {showFieldHints ? (
            <span className={ui.fieldHint}>
              Optional. Stored securely. Only the last four characters are shown
              after save.
              {formatHint ? ` Format: ${formatHint}.` : ""}
            </span>
          ) : null}
          {showFieldHints && numberFormatError ? (
            <span className={ui.fieldError} role="alert">
              {numberFormatError}
            </span>
          ) : null}
        </label>
      ) : null}
    </>
  );
}

/** Pick catalog skills by name; selected values stay as hidden skill ids. */
export function CatalogSkillPicker({
  selectedIds,
  catalog,
  catalogError = null,
  readOnly = false,
  skillEntries = [],
  onChange,
}: CatalogSkillPickerProps) {
  const active = activeSkills(catalog);
  const selected = new Set(selectedIds);
  const available = active.filter((row) => !selected.has(row.skillId));
  const extendedEntries = skillEntries.filter((entry) => entry.kind !== "catalog");
  const [pickerValue, setPickerValue] = useState("");

  function emit(nextIds: readonly string[]) {
    const names = nextIds
      .map(
        (id) => active.find((row) => row.skillId === id)?.skillName ?? "",
      )
      .filter(Boolean);
    onChange(nextIds, names);
  }

  return (
    <div className={ui.field}>
      <span className={ui.fieldLabel}>Skills</span>
      {readOnly ? null : (
        <EmployeesSelect
          value={pickerValue}
          disabled={available.length === 0}
          placeholder="Add a skill"
          aria-label="Add a skill"
          catalogLock
          options={available.map((row) => ({
            value: row.skillId,
            label: row.skillName,
          }))}
          onChange={(nextValue) => {
            if (!nextValue) {
              return;
            }
            if (selected.has(nextValue)) {
              return;
            }
            emit([...selectedIds, nextValue]);
            setPickerValue("");
          }}
        />
      )}
      {selectedIds.length > 0 ? (
        <ul>
          {selectedIds.map((skillId) => {
            const name =
              active.find((row) => row.skillId === skillId)?.skillName ??
              skillId;
            return (
              <li key={skillId}>
                {name}
                {readOnly ? null : (
                  <>
                    {" "}
                    <button
                      type="button"
                      className={ui.btnGhost}
                      onClick={() =>
                        emit(selectedIds.filter((id) => id !== skillId))
                      }
                    >
                      Remove
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {extendedEntries.length > 0 ? (
        <ul>
          {extendedEntries.map((entry) => (
            <li key={entry.id}>
              {entry.skillName}{" "}
              <StatusBadge
                label={entryStatusLabel(entry)}
                tone={entryStatusTone(entry)}
              />
              {entry.proficiency || entry.yearsExperience != null ? (
                <span className={ui.fieldHint}>
                  {" "}
                  {[entry.proficiency, entry.yearsExperience != null ? `${entry.yearsExperience} yrs` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {catalogError ? (
        <span className={ui.muted}>{catalogError}</span>
      ) : active.length === 0 ? (
        <span className={ui.muted}>
          {emptyOrgCatalogHint("skill")}
        </span>
      ) : (
        <span className={ui.fieldHint}>
          Pick from the catalog. These are job skills, not endorsements.
        </span>
      )}
    </div>
  );
}
