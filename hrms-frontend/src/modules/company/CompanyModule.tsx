import { useEffect, useReducer, useState } from "react";

import { mutationErrorMessage } from "@/shared";
import { EMPTY_COMPANY_DATA, normalizeCompanyModuleData } from "@/shared/live";
import { normalizeLocations, type LocationRecord } from "@/modules/org";
import { createDefaultActor, DEFAULT_COMPANY_THEME } from "./constants";
import { CompanyPanel, type CompanyPendingLogo } from "./components";
import { useCompanyLogoUrl } from "./hooks/useCompanyLogoUrl";
import { companyReducer, createCompanyState } from "./reducer";
import {
  canCreateCompany,
  canEditCompany,
  canEditCompanyConfiguration,
  canViewCompany,
  isCompanyActor,
  isCompanyTheme,
  selectCompanyProfile,
  validateCompanyDraft,
} from "./selectors";
import { normalizeCompanyWebsite } from "./website";
import type {
  CompanyDraft,
  CompanyModuleProps,
  CompanyRecord,
  TimesheetHoursFormat,
} from "./types";

function companyIdFromSave(saved: unknown): string | null {
  if (!saved || typeof saved !== "object") {
    return null;
  }
  const row = saved as Record<string, unknown>;
  const id = row.companyId ?? row.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

const NEW_COMPANY_TEMPLATE: CompanyRecord = {
  id: "__new__",
  name: "",
  type: "LLC",
  email: "",
  phone: "",
  website: "",
  logoObjectKey: null,
  logoDataUrl: null,
  headquartersLocationId: null,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  status: "ACTIVE",
  timesheetReminderWeekday: 1,
  timesheetExpectedWeeklyHours: 40,
  timesheetHoursFormat: "clock",
};

import { companyUi as ui } from "./uiClasses";

function toCompanyWire(draft: CompanyDraft) {
  return {
    companyName: draft.name,
    companyType: draft.type,
    companyEmail: draft.email,
    companyPhone: draft.phone,
    companyWebsite: normalizeCompanyWebsite(draft.website) ?? draft.website,
    headquartersLocationId: draft.headquartersLocationId,
  };
}

/**
 * Company profile for the single-company platform.
 */
export function CompanyModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_COMPANY_DATA,
  gateway,
  accessGrants,
  orgGateway,
  theme,
  defaultTheme = DEFAULT_COMPANY_THEME,
  onDataChange,
  onNavigate,
  role,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
}: CompanyModuleProps) {
  const resolvedDefaultActor = defaultActor ?? createDefaultActor(role);
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActor = actor ?? resolvedDefaultActor;
  const activeActor = isCompanyActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;

  const [state, dispatch] = useReducer(
    companyReducer,
    createCompanyState(defaultData),
  );

  const [notice, setNotice] = useState<string | null>(null);
  const [locations, setLocations] = useState<readonly LocationRecord[]>([]);

  const isDataControlled = data !== undefined;
  const activeData = data ?? state.data;
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isCompanyTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_COMPANY_THEME;

  const canView = canViewCompany(activeActor, accessGrants);
  const canEdit = canEditCompany(activeActor, accessGrants);
  const canConfigure = canEditCompanyConfiguration(activeActor, accessGrants);
  const profile = selectCompanyProfile(activeData);
  const canCreate = !profile && canCreateCompany(activeActor, accessGrants);
  const storedLogoSrc = useCompanyLogoUrl(
    profile?.id,
    profile?.logoObjectKey,
    gateway?.fetchLogoBlob,
  );
  const logoSrc =
    storedLogoSrc ??
    (profile?.logoDataUrl?.startsWith("data:") ? profile.logoDataUrl : null);

  async function refreshProfile(): Promise<void> {
    if (!gateway) {
      return;
    }
    const raw = await gateway.getCurrentCompany();
    dispatch({
      type: "REPLACE_DATA",
      data: normalizeCompanyModuleData(raw),
    });
  }

  useEffect(() => {
    if (isDataControlled) return;
    onDataChange?.(state.data);
  }, [isDataControlled, onDataChange, state.data]);

  // Live host often mounts before /company finishes loading; hydrate when data arrives.
  useEffect(() => {
    if (isDataControlled) return;
    if (defaultData.companies.length === 0) return;
    const currentIds = state.data.companies.map((c) => c.id).join("|");
    const nextIds = defaultData.companies.map((c) => c.id).join("|");
    if (currentIds === nextIds && state.data.companies.length > 0) return;
    dispatch({ type: "REPLACE_DATA", data: defaultData });
  }, [defaultData, isDataControlled, state.data.companies]);

  useEffect(() => {
    if (!orgGateway) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await orgGateway.listLocations();
        if (!cancelled) {
          setLocations(normalizeLocations(raw));
        }
      } catch {
        if (!cancelled) {
          setLocations([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgGateway]);

  async function handleCreate(
    draft: CompanyDraft,
    logo?: CompanyPendingLogo,
  ): Promise<boolean> {
    if (!canCreate || isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      return false;
    }

    const errors = validateCompanyDraft(draft, activeData.companies);
    if (errors.length > 0) {
      setNotice(errors[0]!.message);
      return false;
    }

    const normalized: CompanyDraft = {
      ...draft,
      website: normalizeCompanyWebsite(draft.website) ?? draft.website.trim(),
    };

    if (!gateway) {
      setNotice("Company create requires a live API connection.");
      return false;
    }

    try {
      const saved = await gateway.createCompany(toCompanyWire(normalized));
      const companyId = companyIdFromSave(saved);
      if (companyId && logo?.file) {
        try {
          await gateway.uploadLogo(companyId, logo.file);
        } catch (logoError) {
          await refreshProfile();
          setNotice(
            `Created company profile "${normalized.name}", but the logo could not be uploaded: ${mutationErrorMessage(logoError)}`,
          );
          return true;
        }
      }
      await refreshProfile();
      setNotice(`Created company profile "${normalized.name}".`);
    } catch (error) {
      setNotice(mutationErrorMessage(error));
      return false;
    }
    return true;
  }

  async function handleSave(draft: CompanyDraft): Promise<boolean> {
    if (!profile || isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      return false;
    }

    const errors = validateCompanyDraft(draft, activeData.companies, profile.id);
    if (errors.length > 0) {
      setNotice(errors[0]!.message);
      return false;
    }

    const normalized: CompanyDraft = {
      ...draft,
      website: normalizeCompanyWebsite(draft.website) ?? draft.website.trim(),
    };

    if (gateway) {
      try {
        await gateway.updateCompany(profile.id, toCompanyWire(normalized));
        await refreshProfile();
        setNotice(`Updated company profile "${normalized.name}".`);
      } catch (error) {
        setNotice(mutationErrorMessage(error));
        return false;
      }
      return true;
    }

    dispatch({
      type: "UPDATE_COMPANY",
      companyId: profile.id,
      patch: normalized,
    });
    setNotice(`Updated company profile "${normalized.name}".`);
    return true;
  }

  async function handleSaveConfiguration(config: {
    timesheetReminderWeekday: number;
    timesheetHoursFormat: TimesheetHoursFormat;
  }): Promise<boolean> {
    if (!profile || isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      return false;
    }
    if (gateway) {
      try {
        await gateway.updateCompany(profile.id, {
          timesheetReminderWeekday: config.timesheetReminderWeekday,
          timesheetHoursFormat: config.timesheetHoursFormat,
        });
        await refreshProfile();
        setNotice("Updated timesheet configuration.");
      } catch (error) {
        setNotice(mutationErrorMessage(error));
        return false;
      }
      return true;
    }
    dispatch({
      type: "REPLACE_DATA",
      data: {
        companies: activeData.companies.map((company) =>
          company.id === profile.id
            ? {
                ...company,
                timesheetReminderWeekday: config.timesheetReminderWeekday,
                timesheetHoursFormat: config.timesheetHoursFormat,
              }
            : company,
        ),
      },
    });
    setNotice("Updated timesheet configuration.");
    return true;
  }

  async function handleUploadLogo(file: File): Promise<boolean> {
    if (!profile || isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      return false;
    }
    if (gateway) {
      try {
        await gateway.uploadLogo(profile.id, file);
        await refreshProfile();
        setNotice("Updated company logo.");
        return true;
      } catch (error) {
        setNotice(mutationErrorMessage(error));
        return false;
      }
    }
    return true;
  }

  async function handleRemoveLogo(): Promise<boolean> {
    if (!profile || isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      return false;
    }
    if (gateway) {
      try {
        await gateway.removeLogo(profile.id);
        await refreshProfile();
        setNotice("Removed company logo.");
        return true;
      } catch (error) {
        setNotice(mutationErrorMessage(error));
        return false;
      }
    }
    return true;
  }

  return (
    <section
      className={ui.root}
      data-theme={activeTheme}
      aria-label="Company module"
    >
      {state.ui.lastError ? (
        <p className={ui.error} role="alert">
          {state.ui.lastError}
        </p>
      ) : null}

      {notice ? (
        <div className={ui.notice} role="status">
          <p className={ui.noticeText}>{notice}</p>
          <button
            type="button"
            className={ui.btnGhostCompact}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!canView ? (
        <p className={ui.empty}>
          You do not have access to the company profile.
        </p>
      ) : !profile && canCreate ? (
        <CompanyPanel
          key="create-company"
          company={NEW_COMPANY_TEMPLATE}
          data={activeData}
          locations={locations}
          canEdit
          canConfigure={false}
          onSave={handleCreate}
          onSaveConfiguration={async () => false}
          onOpenLocations={
            onNavigate ? () => onNavigate("/company/locations") : undefined
          }
        />
      ) : !profile ? (
        <p className={ui.empty}>
          No company profile is configured for this workspace.
        </p>
      ) : (
        <CompanyPanel
          key={`${profile.id}-${profile.name}`}
          company={profile}
          data={activeData}
          locations={locations}
          canEdit={canEdit}
          canConfigure={canConfigure}
          onSave={handleSave}
          onSaveConfiguration={handleSaveConfiguration}
          logoSrc={logoSrc}
          onUploadLogo={canEdit ? handleUploadLogo : undefined}
          onRemoveLogo={canEdit ? handleRemoveLogo : undefined}
          onOpenLocations={
            onNavigate ? () => onNavigate("/company/locations") : undefined
          }
        />
      )}
    </section>
  );
}
