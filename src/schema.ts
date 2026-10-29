import { z } from "zod";

export const WORK_TYPES = ["remote", "onsite", "shop", "travel"] as const;

/** One time entry as Claude extracts it from a technician's note. */
export const TimeEntrySchema = z.object({
  date: z.string().describe("Calendar date the work happened, formatted YYYY-MM-DD"),
  clientAlias: z
    .string()
    .describe("Client name or shorthand exactly as the technician wrote it"),
  hours: z.number().describe("Hours worked, in quarter-hour steps"),
  workType: z.enum(WORK_TYPES),
  summary: z.string().describe("Short, client-facing description of the work"),
  mileage: z.number().nullable().describe("Miles driven, or null if not mentioned"),
});

/** The full structured response we ask Claude for. */
export const ParseResultSchema = z.object({
  entries: z.array(TimeEntrySchema),
  questions: z
    .array(z.string())
    .describe("Anything ambiguous that the technician should clarify before approving"),
});

export type TimeEntry = z.infer<typeof TimeEntrySchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;

/**
 * Business rules the model is asked to follow but that we never trust blindly.
 * Returns a list of human-readable problems; empty means the entry is valid.
 */
export function validateEntry(entry: TimeEntry, today: string): string[] {
  const problems: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date))) {
    problems.push(`"${entry.date}" is not a valid date`);
  } else if (entry.date > today) {
    problems.push(`${entry.date} is in the future`);
  }

  if (entry.hours <= 0 || entry.hours > 16) {
    problems.push(`${entry.hours}h is outside the allowed 0.25-16h range`);
  } else if (!Number.isInteger(entry.hours * 4)) {
    problems.push(`${entry.hours}h is not a quarter-hour increment`);
  }

  if (entry.mileage !== null && (entry.mileage < 0 || entry.mileage > 500)) {
    problems.push(`${entry.mileage} miles looks wrong`);
  }

  if (entry.summary.trim().length === 0) {
    problems.push("summary is empty");
  }

  return problems;
}
