export interface ScheduleGateway {
  listEvents(): Promise<unknown>;
  getEvent(id: string): Promise<unknown>;
  createEvent(body: unknown): Promise<unknown>;
  updateEvent(id: string, body: unknown): Promise<unknown>;
  deleteEvent(id: string): Promise<unknown>;
}
