import { z } from "zod";

const EnvSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-"),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  MONTHLY_BUDGET_USD: z.coerce.number().positive().default(10),
  CLIENTS_FILE: z.string().default("data/clients.example.json"),
  BUDGET_FILE: z.string().default("data/budget.json"),
  TIMEZONE: z.string().default("America/Boise"),
});

export type Config = z.infer<typeof EnvSchema>;

/** Fails fast at startup with a readable message instead of failing mid-request. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}
