import type { ProjectDraft } from "./types";

/** Body for POST/PATCH /projects from a ProjectDraft. */
export function toProjectWire(draft: ProjectDraft) {
  return {
    clientId: draft.clientId,
    projectName: draft.name.trim(),
    projectCode: draft.code.trim() || null,
    projectType: draft.projectType.trim() || null,
    region: draft.region.trim() || null,
    projectStartdate: draft.startDate || null,
    projectEnddate: draft.endDate || null,
    plannedEndDate: draft.endDate || null,
    actualEndDate: draft.actualEndDate.trim() || null,
    billingType: draft.billingType || null,
    status: draft.status || "ACTIVE",
    endClientName: draft.endClient.trim() || null,
    invoicePeriod: draft.invoicePeriod,
    description: draft.description.trim() || null,
    projectManagerIds: [...draft.projectManagerIds],
    accountOwnerIds: [...draft.accountOwnerIds],
    clientStakeholders: draft.clientStakeholders
      .filter((row) => row.name.trim())
      .map((row) => ({
        id: row.id || undefined,
        name: row.name.trim(),
        title: row.title.trim() || null,
        department: row.department.trim() || null,
        email: row.email.trim() || null,
        phoneNumber: row.phoneNumber.trim() || null,
      })),
  };
}
