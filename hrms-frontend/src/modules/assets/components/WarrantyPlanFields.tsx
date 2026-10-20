"use client";

import { empUi as ui } from "@/shared/ui/empUi";
import {
  ProfileSelectField,
  ProfileTextField,
} from "@/modules/employees/components/profileFields";
import { WARRANTY_PLAN_SELECT_OPTIONS } from "../constants";
import type { AssetDraft, AssetDraftErrors } from "../types";

interface WarrantyPlanFieldsProps {
  readonly warrantyPlanType: AssetDraft["warrantyPlanType"];
  readonly warrantyPlan: string;
  readonly fieldErrors?: AssetDraftErrors;
  readonly onChange: (
    patch: Partial<Pick<AssetDraft, "warrantyPlanType" | "warrantyPlan">>,
  ) => void;
}

/** Optional extra-plan type first; plan/contract number only after a type is chosen. */
export function WarrantyPlanFields({
  warrantyPlanType,
  warrantyPlan,
  fieldErrors,
  onChange,
}: WarrantyPlanFieldsProps) {
  return (
    <>
      <ProfileSelectField
        label="Extra warranty plan"
        readOnly={false}
        value={warrantyPlanType}
        ariaLabel="Extra warranty plan"
        placeholder="None / Standard manufacturer warranty"
        options={WARRANTY_PLAN_SELECT_OPTIONS}
        error={fieldErrors?.warrantyPlanType ?? null}
        onChange={(nextType) =>
          onChange({
            warrantyPlanType: nextType as AssetDraft["warrantyPlanType"],
            warrantyPlan: nextType ? warrantyPlan : "",
          })
        }
      />
      {warrantyPlanType ? (
        <ProfileTextField
          label="Plan / contract no."
          value={warrantyPlan}
          maxLength={100}
          ariaLabel="Plan / contract no."
          hint={
            <p className={ui.fieldHint}>
              From the confirmation email or contract — not the device serial.
            </p>
          }
          error={fieldErrors?.warrantyPlan ?? null}
          onChange={(nextPlan) => onChange({ warrantyPlan: nextPlan })}
        />
      ) : null}
    </>
  );
}
