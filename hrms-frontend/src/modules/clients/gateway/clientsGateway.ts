/** Filters, order and page for the Clients directory (applied by the server). */
export interface ClientsOverviewParams {
  readonly q?: string;
  readonly status?: string;
  readonly industry?: string;
  readonly sort?: "name" | "status";
  readonly sortDir?: "asc" | "desc";
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ClientsGateway {
  getClients(): Promise<unknown>;
  /** One page of clients with their project counts; absent on offline gateways. */
  getClientsOverview?(params: ClientsOverviewParams): Promise<unknown>;
  getClientById(clientId: string): Promise<unknown>;
  /** The client and its own projects in one call; absent on offline gateways. */
  getClientDetail?(clientId: string): Promise<unknown>;
  /** Id, name, status and internal flag of every client, for pickers. */
  getClientOptions?(): Promise<unknown>;
  getIndustries(): Promise<unknown>;
  getInactiveClients(): Promise<unknown>;
  searchClients(clientName: string): Promise<unknown>;
  createClient(body: unknown): Promise<unknown>;
  updateClient(clientId: string, body: unknown): Promise<unknown>;
  deleteClient(clientId: string): Promise<unknown>;
  archiveClient(clientId: string): Promise<unknown>;
  restoreClient(clientId: string): Promise<unknown>;
  uploadLogo(clientId: string, file: File): Promise<unknown>;
  removeLogo(clientId: string): Promise<unknown>;
  /** `version` is the logo's object key; it makes the URL cacheable for a year. */
  fetchLogoBlob(clientId: string, version?: string): Promise<Blob>;
  getClientInvoices(clientId: string): Promise<unknown>;
  getAllClientInvoices(): Promise<unknown>;
  createClientInvoice(clientId: string, body: unknown): Promise<unknown>;
  updateClientInvoice(
    clientInvoiceId: string,
    body: unknown,
  ): Promise<unknown>;
}
