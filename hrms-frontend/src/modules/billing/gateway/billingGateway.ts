export interface BillingGateway {
  getAllExpenses(): Promise<unknown>;
  getExpenseByEmployeeId(employeeId: string): Promise<unknown>;
  createExpense(body: unknown): Promise<unknown>;
  updateExpense(expensesId: string, body: unknown): Promise<unknown>;
  getEmployeePayrollAndExpenses(): Promise<unknown>;
  getAllClientInvoices(): Promise<unknown>;
  getClientInvoiceSummary(): Promise<unknown>;
}
