import { normalizeDashboardData } from "@/shared/live/normalizers";

describe("normalizeDashboardData", () => {
  it("maps GET /dashboard { company, employee, client, vendor, project } counts", () => {
    const data = normalizeDashboardData({
      company: { total: 2, active: 1 },
      employee: { total: 10, active: 8 },
      client: { total: 5, active: 4 },
      vendor: { total: 3, active: 3 },
      project: { total: 7, active: 6 },
    });

    expect(data.metrics.company).toEqual({ total: 2, active: 1 });
    expect(data.metrics.employees).toEqual({ total: 10, active: 8 });
    expect(data.metrics.clients).toEqual({ total: 5, active: 4 });
    expect(data.metrics.vendors).toEqual({ total: 3, active: 3 });
    expect(data.metrics.projects).toEqual({ total: 7, active: 6 });
    expect(data.attendance).toEqual([]);
    expect(data.schedule).toEqual([]);
  });

  it("clamps active to total and keeps legacy numeric fallbacks", () => {
    const data = normalizeDashboardData({
      company: { total: 1, active: 9 },
      activeEmployees: 4,
      projects: 2,
    });

    expect(data.metrics.company).toEqual({ total: 1, active: 1 });
    expect(data.metrics.employees).toEqual({ total: 4, active: 4 });
    expect(data.metrics.projects).toEqual({ total: 2, active: 2 });
  });

  it("returns empty metrics for empty payload", () => {
    const data = normalizeDashboardData({});
    expect(data.metrics.company).toEqual({ total: 0, active: 0 });
    expect(data.metrics.employees).toEqual({ total: 0, active: 0 });
    expect(data.metrics.projects).toEqual({ total: 0, active: 0 });
  });
});
