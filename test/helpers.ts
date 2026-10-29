import { ClientDirectory } from "../src/clientDirectory.js";
import type { ParseContext } from "../src/parser.js";
import type { TimeEntry } from "../src/schema.js";

export const clients = new ClientDirectory([
  { id: "C-1001", name: "Acme Dental", aliases: ["ACME"] },
  { id: "C-1002", name: "Beta Builders", aliases: ["BETA", "BB"] },
]);

export const ctx: ParseContext = { today: "2026-10-28", timezone: "America/Boise", clients };

export function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    date: "2026-10-28",
    clientAlias: "ACME",
    hours: 2,
    workType: "onsite",
    summary: "Replaced network switch",
    mileage: 12,
    ...overrides,
  };
}
