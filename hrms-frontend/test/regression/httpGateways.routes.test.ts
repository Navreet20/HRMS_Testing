import { createApiRequest, encodeQuery } from "@/shared";
import { createHttpDashboardGateway } from "@/modules/dashbord/gateway";
import { createHttpEmployeesGateway } from "@/modules/employees/gateway";
import { createHttpProjectsGateway } from "@/modules/projects/gateway";
import { createHttpCompanyGateway } from "@/modules/company/gateway";
import { createHttpSkillsGateway } from "@/modules/skills/gateway";
import { createHttpManageAccessGateway } from "@/modules/manageAccess/gateway";
import { createHttpClientsGateway } from "@/modules/clients/gateway";
import { createHttpVendorsGateway } from "@/modules/vendors/gateway";
import { createHttpBillingGateway } from "@/modules/billing/gateway";
import { createHttpPayrollsGateway } from "@/modules/payrolls/gateway";
import { createHttpRevenueGateway } from "@/modules/revenue/gateway";
import { createHttpScheduleGateway } from "@/modules/schedule/gateway";
import { createHttpOrgGateway } from "@/modules/org/gateway";
import type { ApiRequest } from "@/shared";

function spyRequest() {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const request = (async (method, path, body) => {
    calls.push({ method, path, body });
    return { ok: true };
  }) as ApiRequest;
  return { calls, request };
}

describe("module HTTP gateway routes", () => {
  it("dashboard GETs /dashboard", async () => {
    const { calls, request } = spyRequest();
    await createHttpDashboardGateway({ request }).getDashboardData();
    expect(calls[0]).toEqual({
      method: "GET",
      path: "/dashboard",
      body: undefined,
    });
  });

  it("employees lists and rejects via transitions", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.getAllEmployees();
    await gateway.rejectEmployee("emp-1", "Need docs & fix");
    expect(calls[0]?.path).toBe("/employees");
    expect(calls[1]?.method).toBe("POST");
    expect(calls[1]?.path).toBe(
      `/employees/${encodeURIComponent("emp-1")}/transitions`,
    );
    expect(calls[1]?.body).toEqual({
      action: "reject",
      comments: "Need docs & fix",
    });
  });

  it("employees inactive/search/pending use consolidated query params", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.getInactiveEmployees();
    await gateway.searchEmployees("Ada");
    await gateway.getPendingApprovals();
    expect(calls[0]?.path).toBe("/employees?status=INACTIVE");
    expect(calls[1]?.path).toBe(`/employees?q=${encodeQuery("Ada")}`);
    expect(calls[2]?.path).toBe("/employees?status=NEW");
  });

  it("employees listEmployees sends live directory filters", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.listEmployees({
      q: "Ada",
      departmentId: "dept-1",
      status: "ACTIVE",
      sort: "name",
      sortDir: "asc",
      page: 2,
      pageSize: 25,
    });
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.path).toBe(
      `/employees?q=${encodeQuery("Ada")}&departmentId=dept-1&status=ACTIVE&sort=name&sortDir=asc&page=2&pageSize=25`,
    );
  });

  it("employees lifecycle approve/reactivate/draft use transitions", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.approveEmployee("emp-1");
    await gateway.rehireEmployee("a@b.com", {});
    await gateway.draftEmployee("emp-1", { firstName: "Ada" });
    await gateway.createEmployeeDraft({
      firstName: "Ada",
      lastName: "Lovelace",
      dateOfBirth: "1990-05-05",
    });
    await gateway.previewEmployeeCode({
      firstName: "Jane",
      lastName: "Doe",
    });
    await gateway.inviteDraftEmployee("emp-1", {
      emailId: "ada@example.com",
      personalEmail: "ada.p@example.com",
    });
    await gateway.resendInviteEmployee("emp-1");
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: `/employees/${encodeURIComponent("emp-1")}/transitions`,
      body: { action: "approve" },
    });
    expect(calls[1]).toMatchObject({
      method: "POST",
      path: "/employees/transitions",
      body: { action: "rehire", emailId: "a@b.com" },
    });
    expect(calls[2]?.body).toMatchObject({
      action: "draft",
      firstName: "Ada",
    });
    expect(calls[3]).toMatchObject({
      method: "POST",
      path: "/employees/drafts",
    });
    expect(calls[4]).toMatchObject({
      method: "POST",
      path: "/employees/code-preview",
      body: { firstName: "Jane", lastName: "Doe" },
    });
    expect(calls[5]?.body).toMatchObject({
      action: "invite",
      emailId: "ada@example.com",
    });
    expect(calls[6]?.body).toEqual({ action: "resend_invite" });
  });

  it("employees document routes use list/upload/download/delete", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.listDocuments("emp-9");
    await gateway.uploadDocuments(
      "emp-9",
      [new File(["x"], "a.pdf", { type: "application/pdf" })],
      [{ fileName: "a.pdf", documentName: "a.pdf" }],
    );
    await gateway.downloadDocument("employees/emp-9/doc/a.pdf", "a.pdf");
    await gateway.deleteDocument("doc-1");
    expect(calls[0]?.path).toBe(
      `/employees/${encodeURIComponent("emp-9")}/documents`,
    );
    expect(calls[1]?.method).toBe("POST");
    expect(calls[1]?.path).toContain(
      `/employees/${encodeURIComponent("emp-9")}/documents?documents=`,
    );
    expect(calls[1]?.body).toBeInstanceOf(FormData);
    expect(calls[2]?.path).toBe(
      `/employees/documents/download?filePath=${encodeQuery("employees/emp-9/doc/a.pdf")}&fileName=${encodeQuery("a.pdf")}`,
    );
    expect(calls[3]?.method).toBe("DELETE");
    expect(calls[3]?.path).toBe(
      `/employees/documents/${encodeURIComponent("doc-1")}`,
    );
  });

  it("employees avatar routes use put/get/delete", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.uploadAvatar(
      "emp-9",
      new File(["x"], "a.png", { type: "image/png" }),
    );
    await gateway.fetchAvatarBlob("emp-9");
    await gateway.removeAvatar("emp-9");
    expect(calls[0]?.method).toBe("PUT");
    expect(calls[0]?.path).toBe(
      `/employees/${encodeURIComponent("emp-9")}/avatar`,
    );
    expect(calls[0]?.body).toBeInstanceOf(FormData);
    expect(calls[1]?.method).toBe("GET");
    expect(calls[1]?.path).toBe(
      `/employees/${encodeURIComponent("emp-9")}/avatar`,
    );
    expect(calls[2]?.method).toBe("DELETE");
    expect(calls[2]?.path).toBe(
      `/employees/${encodeURIComponent("emp-9")}/avatar`,
    );
  });

  it("employees profile-change routes submit/get/approve/reject", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    const body = { addressLine1: "1 Main", emergencyName: "Pat" };
    await gateway.submitProfileChange("emp-1", body);
    await gateway.getPendingProfileChange("emp-1");
    await gateway.approveProfileChange("emp-1", "chg-1");
    await gateway.rejectProfileChange("emp-1", "chg-1", "Missing proof");
    expect(calls[0]).toEqual({
      method: "POST",
      path: `/employees/${encodeURIComponent("emp-1")}/profile-changes`,
      body,
    });
    expect(calls[1]).toEqual({
      method: "GET",
      path: `/employees/${encodeURIComponent("emp-1")}/profile-changes/pending`,
      body: undefined,
    });
    expect(calls[2]).toEqual({
      method: "POST",
      path: `/employees/${encodeURIComponent("emp-1")}/profile-changes/${encodeURIComponent("chg-1")}/approve`,
      body: {},
    });
    expect(calls[3]).toEqual({
      method: "POST",
      path: `/employees/${encodeURIComponent("emp-1")}/profile-changes/${encodeURIComponent("chg-1")}/reject`,
      body: { comments: "Missing proof" },
    });
  });

  it("employees profile notification routes list and mark read", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.listProfileNotifications({ unreadOnly: true });
    await gateway.markProfileNotificationRead("n-1");
    expect(calls[0]).toEqual({
      method: "GET",
      path: "/employees/notifications?unreadOnly=true",
      body: undefined,
    });
    expect(calls[1]).toEqual({
      method: "PATCH",
      path: `/employees/notifications/${encodeURIComponent("n-1")}`,
      body: undefined,
    });
  });

  it("employees activity log list route", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.listActivityLog({
      q: "Ada",
      fromDate: "2026-09-01",
      toDate: "2026-09-02",
      page: 2,
      pageSize: 25,
    });
    expect(calls[0]).toEqual({
      method: "GET",
      path: "/employees/audit-trail?q=Ada&fromDate=2026-09-01&toDate=2026-09-02&page=2&pageSize=25",
      body: undefined,
    });
  });

  it("employees attach and detach profile skills without mutating /skills", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.listEmployeeSkills("emp-1");
    await gateway.attachEmployeeSkills("emp-1", { skillIds: ["skill-sql"] });
    await gateway.detachEmployeeSkill("emp-1", "skill-ts");
    await gateway.updateEmployeeSkill("emp-1", "skill-sql", {
      proficiency: "EXPERT",
      yearsExperience: 5,
    });
    const cert = new File(["cert"], "sql-cert.pdf", { type: "application/pdf" });
    await gateway.uploadSkillCertificate("emp-1", "skill-sql", cert);
    await gateway.deleteSkillCertificate("emp-1", "skill-sql");
    await gateway.downloadSkillCertificate("emp-1", "skill-sql");
    expect(calls[0]).toEqual({
      method: "GET",
      path: `/employees/${encodeURIComponent("emp-1")}/skills`,
      body: undefined,
    });
    expect(calls[1]).toEqual({
      method: "POST",
      path: `/employees/${encodeURIComponent("emp-1")}/skills`,
      body: { skillIds: ["skill-sql"] },
    });
    expect(calls[2]).toEqual({
      method: "DELETE",
      path: `/employees/${encodeURIComponent("emp-1")}/skills/${encodeURIComponent("skill-ts")}`,
      body: undefined,
    });
    expect(calls[3]).toEqual({
      method: "PATCH",
      path: `/employees/${encodeURIComponent("emp-1")}/skills/${encodeURIComponent("skill-sql")}`,
      body: { proficiency: "EXPERT", yearsExperience: 5 },
    });
    expect(calls[4]?.method).toBe("POST");
    expect(calls[4]?.path).toBe(
      `/employees/${encodeURIComponent("emp-1")}/skills/${encodeURIComponent("skill-sql")}/certificate`,
    );
    expect(calls[5]).toEqual({
      method: "DELETE",
      path: `/employees/${encodeURIComponent("emp-1")}/skills/${encodeURIComponent("skill-sql")}/certificate`,
      body: undefined,
    });
    expect(calls[6]).toEqual({
      method: "GET",
      path: `/employees/${encodeURIComponent("emp-1")}/skills/${encodeURIComponent("skill-sql")}/certificate`,
      body: undefined,
    });
    expect(calls.every((call) => call.path !== "/skills")).toBe(true);
  });

  it("projects creates via POST /projects and deletes by id", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpProjectsGateway({ request });
    await gateway.createProject({ name: "Alpha" });
    await gateway.deleteProject("proj-1");
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/projects",
    });
    expect(calls[1]?.method).toBe("DELETE");
    expect(calls[1]?.path).toBe(
      `/projects/${encodeURIComponent("proj-1")}`,
    );
  });

  it("projects loads master lists via GET /projects/meta", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpProjectsGateway({ request });
    await gateway.getProjectMeta();
    expect(calls[0]).toEqual({
      method: "GET",
      path: "/projects/meta",
    });
  });

  it("org catalogs list/create/update departments and locations", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpOrgGateway({ request });
    await gateway.listDepartments();
    await gateway.createDepartment({ departmentName: "Finance" });
    await gateway.updateDepartment("dept-1", { status: "Inactive" });
    await gateway.listLocations();
    await gateway.createLocation({ locationName: "HQ" });
    await gateway.updateLocation("loc-1", { status: "Active" });
    await gateway.listDesignations();
    await gateway.createDesignation({ title: "Analyst" });
    await gateway.updateDesignation("des-1", { title: "Senior Analyst" });
    expect(calls[0]).toEqual({
      method: "GET",
      path: "/departments",
      body: undefined,
    });
    expect(calls[1]).toMatchObject({
      method: "POST",
      path: "/departments",
    });
    expect(calls[2]).toEqual({
      method: "PATCH",
      path: `/departments/${encodeURIComponent("dept-1")}`,
      body: { status: "Inactive" },
    });
    expect(calls[3]?.path).toBe("/locations");
    expect(calls[4]?.method).toBe("POST");
    expect(calls[5]?.method).toBe("PATCH");
    expect(calls[6]?.path).toBe("/designations");
    expect(calls[7]?.method).toBe("POST");
    expect(calls[8]?.method).toBe("PATCH");
    expect(calls).toHaveLength(9);
  });

  it("company profile and current company", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpCompanyGateway({ request });
    await gateway.getCurrentCompany();
    await gateway.updateCompany("co-1", { companyName: "EAOVA" });
    await gateway.uploadLogo(
      "co-1",
      new File(["x"], "logo.png", { type: "image/png" }),
    );
    await gateway.fetchLogoBlob("co-1");
    await gateway.fetchCurrentLogoBlob();
    await gateway.removeLogo("co-1");
    expect(calls[0]?.path).toBe("/companies/current");
    expect(calls[1]).toEqual({
      method: "PATCH",
      path: `/companies/${encodeURIComponent("co-1")}`,
      body: { companyName: "EAOVA" },
    });
    expect(calls[2]).toMatchObject({
      method: "PUT",
      path: `/companies/${encodeURIComponent("co-1")}/logo`,
    });
    expect(calls[3]).toMatchObject({
      method: "GET",
      path: `/companies/${encodeURIComponent("co-1")}/logo`,
    });
    expect(calls[4]).toMatchObject({
      method: "GET",
      path: "/companies/current/logo",
    });
    expect(calls[5]).toMatchObject({
      method: "DELETE",
      path: `/companies/${encodeURIComponent("co-1")}/logo`,
    });
  });

  it("clients overview sends only the filters that are set", async () => {
    const { calls, request } = spyRequest();
    const clients = createHttpClientsGateway({ request });
    await clients.getClientsOverview!({});
    await clients.getClientsOverview!({
      q: "nex us",
      status: "",
      industry: "Retail",
      sort: "status",
      sortDir: "desc",
      page: 2,
      pageSize: 20,
    });
    expect(calls[0]).toMatchObject({ method: "GET", path: "/clients/overview" });
    expect(calls[1]?.path).toBe(
      "/clients/overview?q=nex+us&industry=Retail&sort=status&sortDir=desc&page=2&pageSize=20",
    );
  });

  it("logos ask for their version so the URL can be cached", async () => {
    const { calls, request } = spyRequest();
    const clients = createHttpClientsGateway({ request });
    await clients.fetchLogoBlob("cust-1");
    await clients.fetchLogoBlob("cust-1", "clients/cust-1/logo/a b.png");
    expect(calls[0]?.path).toBe("/clients/cust-1/logo");
    expect(calls[1]?.path).toBe(
      "/clients/cust-1/logo?v=clients%2Fcust-1%2Flogo%2Fa%20b.png",
    );
  });

  it("clients and vendors map CRUD paths", async () => {
    const { calls, request } = spyRequest();
    const clients = createHttpClientsGateway({ request });
    const vendors = createHttpVendorsGateway({ request });
    await clients.getClients();
    await clients.getIndustries();
    await clients.createClient({ clientName: "Acme" });
    await clients.uploadLogo(
      "cust-1",
      new File(["x"], "logo.png", { type: "image/png" }),
    );
    await clients.fetchLogoBlob("cust-1");
    await clients.removeLogo("cust-1");
    await clients.deleteClient("cust-1");
    await clients.archiveClient("cust-1");
    await clients.restoreClient("cust-1");
    await vendors.getVendors();
    await vendors.createVendor({ vendorName: "Supply Co" });
    await vendors.deleteVendor("ven-1");
    expect(calls[0]?.path).toBe("/clients");
    expect(calls[1]?.path).toBe("/clients/industries");
    expect(calls[2]).toMatchObject({
      method: "POST",
      path: "/clients",
    });
    expect(calls[3]).toMatchObject({
      method: "PUT",
      path: "/clients/cust-1/logo",
    });
    expect(calls[4]).toMatchObject({
      method: "GET",
      path: "/clients/cust-1/logo",
    });
    expect(calls[5]).toMatchObject({
      method: "DELETE",
      path: "/clients/cust-1/logo",
    });
    expect(calls[6]?.method).toBe("DELETE");
    expect(calls[7]).toMatchObject({
      method: "POST",
      path: "/clients/cust-1/archive",
    });
    expect(calls[8]).toMatchObject({
      method: "POST",
      path: "/clients/cust-1/restore",
    });
    expect(calls[9]?.path).toBe("/vendors");
    expect(calls[10]).toMatchObject({
      method: "POST",
      path: "/vendors",
    });
    expect(calls[11]?.method).toBe("DELETE");
  });

  it("billing and payrolls use REST expense/payroll routes", async () => {
    const { calls, request } = spyRequest();
    const billing = createHttpBillingGateway({ request });
    const payrolls = createHttpPayrollsGateway({ request });
    await billing.getAllExpenses();
    await billing.createExpense([
      { employeeId: "e1", expenseCost: 10, expenseType: "Other" },
    ]);
    await payrolls.getAllPayroll();
    await payrolls.createPayroll([
      { employeeId: "e1", paymentDate: "2026-01-01", amount: 100 },
    ]);
    expect(calls[0]?.path).toBe("/expenses");
    expect(calls[1]).toMatchObject({
      method: "POST",
      path: "/expenses",
    });
    expect(calls[2]?.path).toBe("/payrolls");
    expect(calls[3]).toMatchObject({
      method: "POST",
      path: "/payrolls",
    });
  });

  it("employees writes create and access update", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpEmployeesGateway({ request });
    await gateway.createEmployee({ firstName: "Ada", emailId: "a@b.c" });
    await gateway.updateEmployeeAccess("emp-1", { role: "HR" });
    await gateway.deleteEmployee("emp-1", "2026-12-31");
    await gateway.hardDeleteEmployee("emp-2");
    expect(calls[0]).toMatchObject({ method: "POST", path: "/employees" });
    expect(calls[1]).toMatchObject({
      method: "PATCH",
      path: `/employees/${encodeURIComponent("emp-1")}`,
    });
    expect(calls[2]?.method).toBe("DELETE");
    expect(calls[2]?.path).toContain("endDate=");
    expect(calls[3]).toMatchObject({
      method: "DELETE",
      path: `/employees/${encodeURIComponent("emp-2")}?hard=true`,
    });
  });

  it("company update maps PATCH /companies/{id}", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpCompanyGateway({ request });
    await gateway.updateCompany("co-1", { companyName: "Co2" });
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      path: `/companies/${encodeURIComponent("co-1")}`,
    });
  });

  it("skills lists and mutates /skills", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpSkillsGateway({ request });
    await gateway.listSkills();
    await gateway.createSkill({ skillName: "Python" });
    await gateway.updateSkill("sk-1", { status: "Inactive" });
    expect(calls[0]).toEqual({
      method: "GET",
      path: "/skills",
      body: undefined,
    });
    expect(calls[1]).toMatchObject({ method: "POST", path: "/skills" });
    expect(calls[2]?.path).toBe(`/skills/${encodeURIComponent("sk-1")}`);
    expect(calls[2]?.method).toBe("PATCH");
    expect(calls).toHaveLength(3);
  });

  it("manageAccess searches and upserts /rbac grants", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpManageAccessGateway({ request });
    await gateway.listModules();
    await gateway.searchEmployees("dev@");
    await gateway.listGrants("emp-1");
    await gateway.upsertGrants("emp-1", {
      moduleId: 3,
      accessLevel: "full_access",
    });
    expect(calls[0]).toEqual({
      method: "GET",
      path: "/rbac/modules",
      body: undefined,
    });
    expect(calls[1]?.path).toBe(
      `/rbac/employees/search?email=${encodeQuery("dev@")}`,
    );
    expect(calls[2]?.path).toBe(
      `/rbac/employees/${encodeURIComponent("emp-1")}/grants`,
    );
    expect(calls[3]).toMatchObject({
      method: "PUT",
      path: `/rbac/employees/${encodeURIComponent("emp-1")}/grants`,
      body: { moduleId: 3, accessLevel: "full_access" },
    });
  });

  it("manageAccess patches access level and revokes grants", async () => {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const request = (async (method: string, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      return {
        grantId: "g1",
        employeeId: "emp-1",
        moduleId: 3,
        moduleName: "Clients",
        hasSubmodules: false,
        submoduleId: null,
        submoduleName: null,
        accessLevel: "read_only",
        grantedBy: null,
        grantedDate: null,
        status: method === "POST" ? "Revoked" : "Active",
      };
    }) as ApiRequest;
    const gateway = createHttpManageAccessGateway({ request });
    await gateway.updateGrantAccessLevel("emp-1", "g1", "read_only");
    await gateway.revokeGrant("emp-1", "g1");
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      path: `/rbac/employees/${encodeURIComponent("emp-1")}/grants/${encodeURIComponent("g1")}`,
      body: { accessLevel: "read_only" },
    });
    expect(calls[1]).toMatchObject({
      method: "POST",
      path: `/rbac/employees/${encodeURIComponent("emp-1")}/grants/${encodeURIComponent("g1")}/revoke`,
    });
  });

  it("revenue uses client invoice summary", async () => {
    const { calls, request } = spyRequest();
    await createHttpRevenueGateway({ request }).getClientInvoiceSummary();
    await createHttpRevenueGateway({ request }).sendOverdueInvoiceReminder(
      "INV-1",
      "a@b.c",
    );
    expect(calls[0]?.path).toBe("/clients/invoices/summary");
    expect(calls[1]).toMatchObject({
      method: "POST",
      path: "/clients/invoices/reminders",
    });
  });

  it("schedule GETs, POSTs, PATCHes, and DELETEs /schedule", async () => {
    const { calls, request } = spyRequest();
    const gateway = createHttpScheduleGateway({ request });
    await gateway.listEvents();
    await gateway.getEvent("evt-1");
    await gateway.createEvent({ title: "Kickoff" });
    await gateway.updateEvent("evt-1", { title: "Kickoff (updated)" });
    await gateway.deleteEvent("evt-1");

    expect(calls[0]).toEqual({ method: "GET", path: "/schedule", body: undefined });
    expect(calls[1]).toEqual({
      method: "GET",
      path: `/schedule/${encodeURIComponent("evt-1")}`,
      body: undefined,
    });
    expect(calls[2]).toEqual({
      method: "POST",
      path: "/schedule",
      body: { title: "Kickoff" },
    });
    expect(calls[3]).toEqual({
      method: "PATCH",
      path: `/schedule/${encodeURIComponent("evt-1")}`,
      body: { title: "Kickoff (updated)" },
    });
    expect(calls[4]?.method).toBe("DELETE");
    expect(calls[4]?.path).toBe(`/schedule/${encodeURIComponent("evt-1")}`);
  });
});
describe("createApiRequest", () => {
  it("prefixes /api and forwards auth + JSON body", async () => {
    const seen: {
      url?: string;
      method?: string;
      headers?: HeadersInit;
      body?: BodyInit | null;
    } = {};

    const fetchImpl: typeof fetch = async (input, init) => {
      seen.url = String(input);
      seen.method = init?.method;
      seen.headers = init?.headers;
      seen.body = init?.body ?? null;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const request = createApiRequest({
      getToken: () => "tok-1",
      fetchImpl,
    });

    await request("POST", "/employees", { firstName: "Ada" });

    expect(seen.url).toBe("/api/employees");
    expect(seen.method).toBe("POST");
    expect(seen.body).toBe(JSON.stringify({ firstName: "Ada" }));
    expect(seen.headers).toMatchObject({
      Authorization: "Bearer tok-1",
      "Content-Type": "application/json",
    });
  });

  it("maps 401 through gateway error helper path", async () => {
    const request: ApiRequest = async () => {
      throw new Error("401 Unauthorized");
    };
    await expect(
      createHttpDashboardGateway({ request }).getDashboardData(),
    ).rejects.toThrow(/Unauthorized/i);
  });
});
