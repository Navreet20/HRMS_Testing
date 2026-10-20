export interface PayrollsGateway {
  getAllPayroll(): Promise<unknown>;
  getPayrollByEmployeeId(employeeId: string): Promise<unknown>;
  createPayroll(body: unknown): Promise<unknown>;
  updatePayroll(payrollId: string, body: unknown): Promise<unknown>;
  getW2Employees(): Promise<unknown>;
  getEmployeePayrollAndExpenses(): Promise<unknown>;
}
