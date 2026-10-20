"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";

import { catalogUi as ui } from "@/shared/ui/catalogUi";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  CatalogSearchSelect,
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { AppCheckbox } from "@/shared/ui";
import {
  createInputFromDraft,
  daysUpdateFromDraft,
  draftFromPolicy,
  emptyAddPolicyDraft,
  emptyLineDraft,
  POLICY_NAME_TAKEN_MESSAGE,
  policyTypeOptionsForCreate,
  validateAddPolicyDraft,
  validateEditPolicyDaysDraft,
  yearSelectOptions,
} from "../selectors";
import type {
  AddPolicyDraft,
  LeavePolicyCreateInput,
  LeavePolicyDaysUpdateInput,
  LeavePolicyRecord,
  LeaveTypeOption,
  PolicyLineDraft,
} from "../types";

export interface AddPolicyDialogProps {
  readonly open: boolean;
  readonly leaveTypes: readonly LeaveTypeOption[];
  /** When set, dialog opens in edit mode prefilled from this policy. */
  readonly policy?: LeavePolicyRecord | null;
  /** Lowercased existing policy names for live duplicate checks. */
  readonly existingPolicyNames?: ReadonlySet<string>;
  readonly busy?: boolean;
  readonly actionError?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: LeavePolicyCreateInput) => void;
  readonly onUpdateDays?: (input: LeavePolicyDaysUpdateInput) => void;
  readonly onClearActionError?: () => void;
}

const fieldErrorClass = "m-0 text-[0.85rem] leading-[1.35] text-emp-critical";
const hintClass = "m-0 text-[0.85rem] leading-[1.35] text-emp-muted";
const addLeaveTypeLinkClass =
  "m-0 inline-flex cursor-pointer items-center border-0 bg-transparent p-0 text-emp-accent hover:underline disabled:cursor-not-allowed disabled:opacity-55 disabled:no-underline";

export function AddPolicyDialog({
  open,
  leaveTypes,
  policy = null,
  existingPolicyNames = new Set(),
  busy = false,
  actionError = null,
  onClose,
  onSubmit,
  onUpdateDays,
  onClearActionError,
}: AddPolicyDialogProps) {
  const titleId = useId();
  const isEdit = policy !== null;
  const [draft, setDraft] = useState<AddPolicyDraft>(emptyAddPolicyDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [scrollToLineKey, setScrollToLineKey] = useState<string | null>(null);

  const selectableTypes = useMemo(() => {
    const base = policyTypeOptionsForCreate(leaveTypes);
    if (!policy) {
      return base;
    }
    const byId = new Map(base.map((row) => [row.leaveTypeId, row]));
    for (const line of policy.lines) {
      if (!byId.has(line.leaveTypeId)) {
        byId.set(line.leaveTypeId, {
          leaveTypeId: line.leaveTypeId,
          leaveTypeName: line.leaveTypeName,
          description: line.description,
          status: "Active",
        });
      }
    }
    return [...byId.values()];
  }, [leaveTypes, policy]);
  const allowedTypeIds = useMemo(
    () => new Set(selectableTypes.map((row) => row.leaveTypeId)),
    [selectableTypes],
  );
  const yearOptions = useMemo(() => {
    const options = [...yearSelectOptions()];
    if (!policy) {
      return options;
    }
    for (const year of [policy.policyStartYear, policy.policyEndYear]) {
      const value = String(year);
      if (!options.some((option) => option.value === value)) {
        options.push({ value, label: value });
      }
    }
    options.sort((a, b) => Number(a.value) - Number(b.value));
    return options;
  }, [policy]);
  const allLeaveTypesAdded =
    selectableTypes.length > 0 &&
    draft.lines.length >= selectableTypes.length;
  const canAddLeaveType = !isEdit && !busy && !allLeaveTypesAdded;
  const canRemoveLeaveType = !isEdit && draft.lines.length > 1;

  const liveNameConflict = useMemo(() => {
    if (isEdit) {
      return null;
    }
    const trimmed = draft.policyName.trim();
    if (!trimmed) {
      return null;
    }
    return existingPolicyNames.has(trimmed.toLowerCase())
      ? POLICY_NAME_TAKEN_MESSAGE
      : null;
  }, [draft.policyName, existingPolicyNames, isEdit]);

  const footerActionError =
    actionError &&
    actionError.trim().toLowerCase() !==
      POLICY_NAME_TAKEN_MESSAGE.toLowerCase()
      ? actionError
      : null;
  const serverNameConflict =
    !isEdit &&
    actionError &&
    actionError.trim().toLowerCase() ===
      POLICY_NAME_TAKEN_MESSAGE.toLowerCase()
      ? POLICY_NAME_TAKEN_MESSAGE
      : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(policy ? draftFromPolicy(policy) : emptyAddPolicyDraft());
    setShowErrors(false);
    setScrollToLineKey(null);
  }, [open, policy]);

  useEffect(() => {
    if (!scrollToLineKey) {
      return;
    }
    const node = document.querySelector<HTMLElement>(
      `[data-policy-line-key="${scrollToLineKey}"]`,
    );
    if (node) {
      const dialogBody = node
        .closest("form.emp-form")
        ?.querySelector<HTMLElement>(":scope > div");
      dialogBody?.scrollTo({ top: 0, behavior: "smooth" });
      const focusTarget = node.querySelector<HTMLElement>(
        "select, input:not([type='checkbox'])",
      );
      focusTarget?.focus({ preventScroll: true });
    }
    setScrollToLineKey(null);
  }, [scrollToLineKey, draft.lines]);

  if (!open) {
    return null;
  }

  const errors = isEdit
    ? validateEditPolicyDaysDraft(draft)
    : validateAddPolicyDraft(draft, allowedTypeIds, existingPolicyNames);
  const hasIncompleteEntitlements = draft.lines.some((line) => {
    const prefix = `line-${line.key}`;
    return Boolean(
      errors[`${prefix}-leaveTypeId`] ||
        errors[`${prefix}-daysAllowed`] ||
        errors[`${prefix}-maxRolloverDays`],
    );
  });
  const visible = showErrors ? errors : {};
  const policyNameError =
    liveNameConflict ||
    serverNameConflict ||
    visible.policyName ||
    null;

  function updateField<K extends keyof AddPolicyDraft>(
    field: K,
    value: AddPolicyDraft[K],
  ) {
    if (isEdit) {
      return;
    }
    if (field === "policyName") {
      onClearActionError?.();
    }
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateLine(key: string, patch: Partial<PolicyLineDraft>) {
    if (isEdit) {
      if (patch.daysAllowed === undefined) {
        return;
      }
      const daysAllowed = patch.daysAllowed;
      setDraft((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.key === key ? { ...line, daysAllowed } : line,
        ),
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.key === key ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addLine() {
    if (!canAddLeaveType) {
      return;
    }
    if (hasIncompleteEntitlements) {
      setShowErrors(true);
      return;
    }
    const nextLine = emptyLineDraft();
    setDraft((current) => ({
      ...current,
      lines: [nextLine, ...current.lines],
    }));
    setScrollToLineKey(nextLine.key);
  }

  function removeLine(key: string) {
    if (isEdit) {
      return;
    }
    setDraft((current) => {
      if (current.lines.length <= 1) {
        return current;
      }
      return {
        ...current,
        lines: current.lines.filter((line) => line.key !== key),
      };
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    if (isEdit) {
      onUpdateDays?.(daysUpdateFromDraft(draft));
      return;
    }
    onSubmit(createInputFromDraft(draft));
  }

  return (
    <CatalogModal
      title={isEdit ? "Edit leave policy" : "Add leave policy"}
      titleId={titleId}
      size="wide"
      subtitle={
        isEdit
          ? "Leave types and year range are fixed; only days allowed can change."
          : undefined
      }
      backdrop="create"
      accentTop
      onClose={onClose}
      onSubmit={handleSubmit}
      bodyClassName="grid content-start gap-5"
      footer={
        <CatalogDialogFooter>
          {footerActionError ? (
            <p className={`${ui.error} mr-auto mb-0`} role="alert">
              {footerActionError}
            </p>
          ) : null}
          <CatalogButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </CatalogButton>
          <CatalogButton type="submit" disabled={busy}>
            {busy
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Save policy"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <section className="grid gap-3">
        <h3 className={ui.dialogSectionTitle}>Basic information</h3>
        <div className="grid gap-3 min-[48rem]:grid-cols-[minmax(0,1.6fr)_minmax(7.5rem,0.7fr)_minmax(7.5rem,0.7fr)]">
          <label className={ui.field}>
            <FieldLabel required>Policy name</FieldLabel>
            <CatalogTextInput
              required
              value={draft.policyName}
              placeholder="e.g. Standard Policy"
              aria-label="Policy name"
              aria-invalid={Boolean(policyNameError) || undefined}
              readOnly={isEdit}
              disabled={isEdit || busy}
              data-dialog-initial-focus={isEdit ? undefined : ""}
              onChange={(event) =>
                updateField("policyName", event.target.value)
              }
            />
            {policyNameError ? (
              <p className={fieldErrorClass} role="alert">
                {policyNameError}
              </p>
            ) : null}
          </label>
          <label className={ui.field}>
            <FieldLabel required>Start year</FieldLabel>
            <CatalogSearchSelect
              required
              value={draft.policyStartYear}
              aria-label="Start year"
              placeholder="Select start year"
              searchPlaceholder="Search years"
              allowEmpty={false}
              disabled={isEdit || busy}
              options={yearOptions}
              onChange={(policyStartYear) =>
                updateField("policyStartYear", policyStartYear)
              }
            />
            {visible.policyStartYear ? (
              <p className={fieldErrorClass}>{visible.policyStartYear}</p>
            ) : null}
          </label>
          <label className={ui.field}>
            <FieldLabel required>End year</FieldLabel>
            <CatalogSearchSelect
              required
              value={draft.policyEndYear}
              aria-label="End year"
              placeholder="Select end year"
              searchPlaceholder="Search years"
              allowEmpty={false}
              disabled={isEdit || busy}
              options={yearOptions}
              onChange={(policyEndYear) =>
                updateField("policyEndYear", policyEndYear)
              }
            />
            {visible.policyEndYear ? (
              <p className={fieldErrorClass}>{visible.policyEndYear}</p>
            ) : null}
          </label>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <h3 className={`${ui.dialogSectionTitle} mb-0 !w-auto shrink-0`}>
            Leave entitlements
          </h3>
          {!isEdit ? (
            <button
              type="button"
              className={`${addLeaveTypeLinkClass} ml-auto shrink-0`}
              onClick={addLine}
              disabled={!canAddLeaveType}
              title={
                allLeaveTypesAdded
                  ? "All leave types have already been added"
                  : hasIncompleteEntitlements
                    ? "Complete required fields on existing leave types first"
                    : undefined
              }
            >
              + Add leave type
            </button>
          ) : null}
        </div>
        {!isEdit && allLeaveTypesAdded ? (
          <p className={hintClass} role="status">
            All leave types have been added. Remove a row to change
            entitlements, or save the policy.
          </p>
        ) : null}
        {visible.lines ? (
          <p className={fieldErrorClass}>{visible.lines}</p>
        ) : null}

        <div className="grid gap-3">
          {draft.lines.map((line, index) => {
            const prefix = `line-${line.key}`;
            const usedElsewhere = new Set(
              draft.lines
                .filter((row) => row.key !== line.key && row.leaveTypeId)
                .map((row) => row.leaveTypeId),
            );
            // Create: always show toggle. Edit: only when rollover is already on.
            const showRollover = !isEdit || line.rolloverAllowed;
            const showSideActions = showRollover || canRemoveLeaveType;
            return (
              <div
                key={line.key}
                data-policy-line-key={line.key}
                className="grid gap-3 rounded-emp border border-emp-line bg-emp-surface p-3"
              >
                <div
                  className={
                    showSideActions
                      ? "grid gap-3 min-[40rem]:grid-cols-[minmax(0,1fr)_auto] min-[40rem]:items-end"
                      : "grid gap-3"
                  }
                >
                  <label className={ui.field}>
                    <FieldLabel required>Leave type</FieldLabel>
                    <CatalogSearchSelect
                      required
                      value={line.leaveTypeId}
                      aria-label={`Leave type ${index + 1}`}
                      placeholder="Select leave type"
                      searchPlaceholder="Search leave types"
                      allowEmpty={!isEdit}
                      disabled={isEdit || busy}
                      options={selectableTypes
                        .filter(
                          (type) =>
                            type.leaveTypeId === line.leaveTypeId ||
                            !usedElsewhere.has(type.leaveTypeId),
                        )
                        .map((type) => ({
                          value: type.leaveTypeId,
                          label: type.description
                            ? `${type.leaveTypeName} — ${type.description}`
                            : type.leaveTypeName,
                          searchText:
                            `${type.leaveTypeName} ${type.description}`.trim(),
                        }))}
                      onChange={(leaveTypeId) =>
                        updateLine(line.key, { leaveTypeId })
                      }
                    />
                    {visible[`${prefix}-leaveTypeId`] ? (
                      <p className={fieldErrorClass}>
                        {visible[`${prefix}-leaveTypeId`]}
                      </p>
                    ) : null}
                  </label>
                  {showSideActions ? (
                    <div className="flex items-center gap-2 pb-[0.15rem]">
                      {showRollover ? (
                        <AppCheckbox
                          checked={line.rolloverAllowed}
                          disabled={isEdit || busy}
                          label="Rollover allowed"
                          onChange={(rolloverAllowed) =>
                            updateLine(line.key, {
                              rolloverAllowed,
                              maxRolloverDays: rolloverAllowed
                                ? line.maxRolloverDays
                                : "",
                            })
                          }
                        />
                      ) : null}
                      {canRemoveLeaveType ? (
                        <button
                          type="button"
                          className={ui.iconBtnDanger}
                          onClick={() => removeLine(line.key)}
                          disabled={busy}
                          aria-label={`Remove leave type row ${index + 1}`}
                        >
                          <Trash2
                            size={16}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 min-[40rem]:grid-cols-2">
                  <label className={ui.field}>
                    <FieldLabel required>Days allowed</FieldLabel>
                    <CatalogTextInput
                      required
                      inputMode="decimal"
                      value={line.daysAllowed}
                      placeholder="10.0"
                      aria-label={`Days allowed for leave type ${index + 1}`}
                      aria-invalid={
                        Boolean(visible[`${prefix}-daysAllowed`]) || undefined
                      }
                      data-dialog-initial-focus={
                        isEdit && index === 0 ? "" : undefined
                      }
                      disabled={busy}
                      onChange={(event) =>
                        updateLine(line.key, {
                          daysAllowed: event.target.value,
                        })
                      }
                    />
                    {visible[`${prefix}-daysAllowed`] ? (
                      <p className={fieldErrorClass}>
                        {visible[`${prefix}-daysAllowed`]}
                      </p>
                    ) : null}
                  </label>
                  {line.rolloverAllowed ? (
                    <label className={ui.field}>
                      <FieldLabel required>Max rollover days</FieldLabel>
                      <CatalogTextInput
                        required
                        inputMode="decimal"
                        value={line.maxRolloverDays}
                        placeholder="3.0"
                        aria-label={`Max rollover days for leave type ${index + 1}`}
                        aria-invalid={
                          Boolean(visible[`${prefix}-maxRolloverDays`]) ||
                          undefined
                        }
                        readOnly={isEdit}
                        disabled={isEdit || busy}
                        onChange={(event) =>
                          updateLine(line.key, {
                            maxRolloverDays: event.target.value,
                          })
                        }
                      />
                      {visible[`${prefix}-maxRolloverDays`] ? (
                        <p className={fieldErrorClass}>
                          {visible[`${prefix}-maxRolloverDays`]}
                        </p>
                      ) : null}
                    </label>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="m-0 rounded-emp border border-emp-accent/25 bg-emp-accent-soft px-3 py-2 text-[0.85rem] leading-normal text-emp-text">
          Unpaid leave is available to all employees with no day limit and is
          not added to a policy.
        </p>
      </section>
    </CatalogModal>
  );
}
