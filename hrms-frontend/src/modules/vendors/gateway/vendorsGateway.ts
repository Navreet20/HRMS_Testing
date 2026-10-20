export interface VendorsGateway {
  getVendors(): Promise<unknown>;
  getVendorById(vendorId: string): Promise<unknown>;
  getInactiveVendors(): Promise<unknown>;
  searchVendors(vendorName: string): Promise<unknown>;
  createVendor(body: unknown): Promise<unknown>;
  updateVendor(vendorId: string, body: unknown): Promise<unknown>;
  deleteVendor(vendorId: string): Promise<unknown>;
  getAllVendorInvoices(): Promise<unknown>;
  createVendorInvoice(vendorId: string, body: unknown): Promise<unknown>;
  updateVendorInvoice(vendorInvoiceId: string, body: unknown): Promise<unknown>;
}
