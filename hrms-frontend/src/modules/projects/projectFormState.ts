import { resolveClientCategory } from "@/modules/clients/clientCategory";
import {
  emptyStakeholderDraft,
  type ClientStakeholderDraft,
} from "@/modules/clients/createClientDraft";
import type {
  BillingType,
  ClientOption,
  ProjectClientStakeholder,
  ProjectDraft,
  ProjectRecord,
  ProjectStatus,
} from "./types";

export interface ProjectFormState {
  clientId: string;
  /** End customer; only kept for Intermediary clients. */
  endClient: string;
  name: string;
  code: string;
  projectType: string;
  region: string;
  billingType: BillingType | "";
  projectManagerIds: string[];
  accountOwnerIds: string[];
  clientStakeholders: ClientStakeholderDraft[];
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  actualEndDate: string;
  description: string;
}

export const INITIAL_PROJECT_FORM: ProjectFormState = {
  clientId: "",
  endClient: "",
  name: "",
  code: "",
  projectType: "",
  region: "",
  billingType: "",
  projectManagerIds: [],
  accountOwnerIds: [],
  clientStakeholders: [emptyStakeholderDraft()],
  status: "ACTIVE",
  startDate: "",
  endDate: "",
  actualEndDate: "",
  description: "",
};

export function formFromProject(project: ProjectRecord): ProjectFormState {
  return {
    clientId: project.clientId ?? "",
    endClient: project.endClient ?? "",
    name: project.name,
    code: project.code,
    projectType: project.projectType ?? "",
    region: project.region ?? "",
    billingType: project.billingType ?? "",
    projectManagerIds: project.projectManagers.map((row) => row.employeeId),
    accountOwnerIds: project.accountOwners.map((row) => row.employeeId),
    clientStakeholders:
      project.clientStakeholders.length > 0
        ? project.clientStakeholders.map((row) =>
            emptyStakeholderDraft({
              id: row.id,
              name: row.name,
              title: row.title,
              department: row.department,
              email: row.email,
              phoneNumber: row.phoneNumber,
            }),
          )
        : [emptyStakeholderDraft()],
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    actualEndDate: project.actualEndDate ?? "",
    description: project.description ?? "",
  };
}

export function isIntermediaryClient(
  client: ClientOption | null | undefined,
): boolean {
  return client != null && resolveClientCategory(client) === "intermediary";
}

/** Billing does not apply to internal-client projects. */
export function isInternalProjectClient(
  client: ClientOption | null | undefined,
): boolean {
  return client != null && resolveClientCategory(client) === "internal";
}

export function buildProjectDraft(
  form: ProjectFormState,
  clients: readonly ClientOption[],
): ProjectDraft {
  const client = clients.find((row) => row.id === form.clientId);
  return {
    name: form.name,
    code: form.code,
    kind: "COMMERCIAL",
    startDate: form.startDate,
    endDate: form.endDate,
    actualEndDate: form.actualEndDate,
    clientId: form.clientId || null,
    clientName: client?.name ?? null,
    vendorId: null,
    vendorName: null,
    // Unknown client (not in the picker list): keep what was saved.
    endClient:
      !client || isIntermediaryClient(client) ? form.endClient.trim() : "",
    invoicePeriod: null,
    projectType: form.projectType,
    region: client?.isInternal ? "" : form.region,
    billingType: isInternalProjectClient(client) ? "" : form.billingType,
    status: form.status,
    description: form.description,
    projectManagerIds: form.projectManagerIds,
    accountOwnerIds: form.accountOwnerIds,
    clientStakeholders: form.clientStakeholders.map(
      (row): ProjectClientStakeholder => ({
        id: row.id,
        name: row.name,
        title: row.title,
        department: row.department,
        email: row.email,
        phoneNumber: row.phoneNumber,
      }),
    ),
    workContact: { firstName: "", lastName: "", mobile: "", email: "" },
  };
}
