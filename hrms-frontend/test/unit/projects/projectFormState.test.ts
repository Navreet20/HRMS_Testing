import {
  buildProjectDraft,
  formFromProject,
  INITIAL_PROJECT_FORM,
  isIntermediaryClient,
} from "@/modules/projects/projectFormState";
import { toProjectWire } from "@/modules/projects/projectWire";
import { validateProjectDraft } from "@/modules/projects/selectors";
import type { ClientOption } from "@/modules/projects/types";
import { FIXTURE_PROJECTS_DATA } from "../../support/projects/fixtures";

const CLIENTS: readonly ClientOption[] = [
  { id: "c-int", name: "Human Resources", isInternal: true, clientCategory: "internal" },
  { id: "c-dir", name: "Walmart", clientCategory: "direct" },
  { id: "c-mid", name: "J&J", clientCategory: "intermediary" },
  { id: "c-old", name: "Legacy Co" },
];

function formFor(clientId: string, endClient = "Acme Pharma") {
  return {
    ...INITIAL_PROJECT_FORM,
    clientId,
    endClient,
    name: "Rollout",
    code: "ROLL1",
    billingType: "Monthly" as const,
    region: "NA",
  };
}

describe("project end customer", () => {
  it("treats only Intermediary clients as intermediary, with legacy clients as Direct", () => {
    expect(isIntermediaryClient(CLIENTS[2])).toBe(true);
    expect(isIntermediaryClient(CLIENTS[0])).toBe(false);
    expect(isIntermediaryClient(CLIENTS[1])).toBe(false);
    expect(isIntermediaryClient(CLIENTS[3])).toBe(false);
    expect(isIntermediaryClient(null)).toBe(false);
  });

  it("saves the end customer for an Intermediary client", () => {
    const draft = buildProjectDraft(formFor("c-mid", "  Acme Pharma  "), CLIENTS);
    expect(draft.endClient).toBe("Acme Pharma");
    expect(toProjectWire(draft).endClientName).toBe("Acme Pharma");
  });

  it("clears the end customer for Direct and Internal clients", () => {
    expect(buildProjectDraft(formFor("c-dir"), CLIENTS).endClient).toBe("");
    expect(toProjectWire(buildProjectDraft(formFor("c-dir"), CLIENTS)).endClientName).toBeNull();
    expect(buildProjectDraft(formFor("c-int"), CLIENTS).endClient).toBe("");
  });

  it("keeps the current Internal and Direct region behavior", () => {
    expect(buildProjectDraft(formFor("c-int"), CLIENTS).region).toBe("");
    expect(buildProjectDraft(formFor("c-dir"), CLIENTS).region).toBe("NA");
    expect(buildProjectDraft(formFor("c-mid"), CLIENTS).region).toBe("NA");
  });

  it("keeps a saved end customer when the client is not in the picker list", () => {
    expect(buildProjectDraft(formFor("c-missing"), CLIENTS).endClient).toBe(
      "Acme Pharma",
    );
  });

  it("loads the saved end customer into the edit form", () => {
    const project = { ...FIXTURE_PROJECTS_DATA.projects[0]!, endClient: "Acme Pharma" };
    expect(formFromProject(project).endClient).toBe("Acme Pharma");
  });

  it("limits the end customer to 100 characters", () => {
    const draft = buildProjectDraft(formFor("c-mid", "A".repeat(101)), CLIENTS);
    expect(
      validateProjectDraft(draft, []).map((error) => error.field),
    ).toContain("endClient");
  });
});

describe("project billing type", () => {
  function billingErrors(clientId: string) {
    const draft = buildProjectDraft(
      { ...formFor(clientId), billingType: "" },
      CLIENTS,
    );
    return validateProjectDraft(draft, [], undefined, { clients: CLIENTS })
      .filter((error) => error.field === "billingType")
      .map((error) => error.message);
  }

  it("does not save or require a billing type for Internal clients", () => {
    expect(buildProjectDraft(formFor("c-int"), CLIENTS).billingType).toBe("");
    expect(toProjectWire(buildProjectDraft(formFor("c-int"), CLIENTS)).billingType).toBeNull();
    expect(billingErrors("c-int")).toEqual([]);
  });

  it("still requires a billing type for Direct and Intermediary clients", () => {
    expect(buildProjectDraft(formFor("c-dir"), CLIENTS).billingType).toBe("Monthly");
    expect(buildProjectDraft(formFor("c-mid"), CLIENTS).billingType).toBe("Monthly");
    expect(billingErrors("c-dir")).toEqual(["Billing type is required."]);
    expect(billingErrors("c-mid")).toEqual(["Billing type is required."]);
    expect(billingErrors("c-old")).toEqual(["Billing type is required."]);
  });
});
