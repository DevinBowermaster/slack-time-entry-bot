import type { TimeEntry } from "../schema.js";

/** A time entry whose client shorthand has been matched to a real client. */
export interface ResolvedEntry extends TimeEntry {
  clientId: string;
  clientName: string;
}

/**
 * Anything that can store time entries: Autotask, ConnectWise, HaloPSA,
 * a spreadsheet, or the in-memory mock used for demos and tests.
 */
export interface PsaAdapter {
  createTimeEntry(entry: ResolvedEntry, technicianId: string): Promise<{ id: string }>;
}
