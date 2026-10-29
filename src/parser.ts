import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ClientDirectory } from "./clientDirectory.js";
import { ParseResultSchema, type ParseResult } from "./schema.js";

export interface ParseContext {
  /** Today's date in the team's time zone, YYYY-MM-DD. */
  today: string;
  timezone: string;
  clients: ClientDirectory;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export type ParseOutcome =
  | { ok: true; result: ParseResult; usage: TokenUsage }
  | { ok: false; reason: string; usage?: TokenUsage };

/** The only part of the SDK client this module needs, which keeps tests simple. */
export type MessagesClient = Pick<Anthropic, "messages">;

export function buildSystemPrompt(ctx: ParseContext): string {
  return [
    "You convert IT technicians' informal work notes into time entries.",
    `Today is ${ctx.today} (${ctx.timezone}). Resolve words like "yesterday" or "Monday" relative to today.`,
    "One note can describe several jobs; return one entry per client per day.",
    'Hours are written like "2h", ".5", or "90 min"; convert to decimal hours in quarter-hour steps.',
    "workType is onsite for site visits, remote for remote sessions, shop for bench work, travel for drive time.",
    "Write each summary as a short, professional sentence a client would see on an invoice.",
    "Copy the client shorthand exactly as written into clientAlias. Known clients:",
    ctx.clients.describeForPrompt(),
    "If anything is ambiguous (missing hours, unclear client, unclear date), still return your best entries and add a short question to questions. Never invent work that is not in the note.",
  ].join("\n");
}

/**
 * Sends one note to Claude and returns schema-validated entries.
 * Structured outputs guarantee the response shape; business rules are checked
 * separately in schema.ts, and client names are resolved in clientDirectory.ts.
 */
export async function parseNotes(
  client: MessagesClient,
  model: string,
  note: string,
  ctx: ParseContext,
): Promise<ParseOutcome> {
  const response = await client.messages.parse({
    model,
    max_tokens: 2000,
    system: buildSystemPrompt(ctx),
    messages: [{ role: "user", content: note }],
    output_config: {
      format: zodOutputFormat(ParseResultSchema),
      effort: "low",
    },
  });

  const usage: TokenUsage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  };

  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "Claude declined to process this note.", usage };
  }
  if (response.stop_reason === "max_tokens") {
    return { ok: false, reason: "The note was too long to process in one message.", usage };
  }
  if (!response.parsed_output) {
    return { ok: false, reason: "Could not read the response as time entries.", usage };
  }

  return { ok: true, result: response.parsed_output, usage };
}
