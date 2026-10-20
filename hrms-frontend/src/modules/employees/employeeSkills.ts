import {
  formatSkillExperience,
  mapSkillCertificateFields,
  parseSkillProficiency,
} from "./employeeCatalog";
import type { EmployeeSkillEntry } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseEmployeeSkillsResponse(raw: unknown): {
  readonly skillIds: string[];
  readonly skillNames: string[];
  readonly skillEntries: EmployeeSkillEntry[];
} {
  if (!Array.isArray(raw)) {
    return { skillIds: [], skillNames: [], skillEntries: [] };
  }

  const skillIds: string[] = [];
  const skillNames: string[] = [];
  const skillEntries: EmployeeSkillEntry[] = [];

  for (const item of raw) {
    const row = asRecord(item);
    const kindRaw = String(row.kind ?? "catalog");
    if (kindRaw === "pending_proposal") {
      continue;
    }
    const skillName = String(row.skillName ?? "").trim();
    if (!skillName) {
      continue;
    }
    const kind =
      kindRaw === "employee_only" ? "employee_only" : "catalog";
    const skillId = String(row.skillId ?? "");
    const years = row.yearsExperience ?? row.years_experience;
    const entry: EmployeeSkillEntry = {
      id: String(
        row.employeeSkillId ?? row.skillId ?? `${kind}-${skillName}`,
      ),
      skillId,
      skillName,
      kind,
      status: String(row.status ?? "Active"),
      proficiency: parseSkillProficiency(row.proficiency),
      yearsExperience: formatSkillExperience(years),
      ...mapSkillCertificateFields(row),
    };
    skillEntries.push(entry);

    if (entry.kind === "catalog" && skillId) {
      skillIds.push(skillId);
      skillNames.push(skillName);
    }
  }

  return { skillIds, skillNames, skillEntries };
}
