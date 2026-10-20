export interface DashboardGateway {
  getDashboardData(): Promise<unknown>;
}
