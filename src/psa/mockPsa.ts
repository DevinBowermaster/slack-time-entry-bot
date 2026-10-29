import type { PsaAdapter, ResolvedEntry } from "./types.js";

/** In-memory PSA so the bot runs end to end without a real ticketing system. */
export class InMemoryPsa implements PsaAdapter {
  readonly entries: Array<ResolvedEntry & { id: string; technicianId: string }> = [];

  async createTimeEntry(entry: ResolvedEntry, technicianId: string): Promise<{ id: string }> {
    const id = `TE-${String(this.entries.length + 1).padStart(4, "0")}`;
    this.entries.push({ ...entry, id, technicianId });
    return { id };
  }
}
