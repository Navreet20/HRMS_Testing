export interface RevenueGateway {
  getClientInvoiceSummary(): Promise<unknown>;
  getSummaryDetailsByClient(clientId: string): Promise<unknown>;
  getAllClientInvoices(): Promise<unknown>;
  sendOverdueInvoiceReminder(
    clientInvoiceNumber: string,
    email: string,
  ): Promise<unknown>;
}
