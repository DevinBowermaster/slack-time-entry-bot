import { randomUUID } from "node:crypto";
import type { KnownBlock } from "@slack/types";
import type { BudgetGuard } from "../costGuard.js";
import type { ParseContext, ParseOutcome } from "../parser.js";
import type { PsaAdapter, ResolvedEntry } from "../psa/types.js";
import { validateEntry } from "../schema.js";
import { previewBlocks } from "./blocks.js";

export interface HandlerDeps {
  parse: (note: string, ctx: ParseContext) => Promise<ParseOutcome>;
  context: () => ParseContext;
  budget: BudgetGuard;
  model: string;
  psa: PsaAdapter;
  pending: PendingStore;
}

export interface Reply {
  text: string;
  blocks?: KnownBlock[];
}

interface PendingBatch {
  userId: string;
  entries: ResolvedEntry[];
  createdAt: number;
}

/** Holds parsed entries between the preview and the Approve click. */
export class PendingStore {
  private readonly items = new Map<string, PendingBatch>();
  constructor(private readonly ttlMs = 60 * 60 * 1000) {}

  add(batch: Omit<PendingBatch, "createdAt">): string {
    const id = randomUUID();
    this.items.set(id, { ...batch, createdAt: Date.now() });
    return id;
  }

  take(id: string): PendingBatch | undefined {
    const batch = this.items.get(id);
    this.items.delete(id);
    if (!batch || Date.now() - batch.createdAt > this.ttlMs) return undefined;
    return batch;
  }

  peek(id: string): PendingBatch | undefined {
    return this.items.get(id);
  }
}

/** A technician posted a note: parse it, check it, and show an approval card. */
export async function handleNote(deps: HandlerDeps, userId: string, note: string): Promise<Reply> {
  if (!deps.budget.canSpend()) {
    return { text: "The monthly AI budget is used up, so I can't read notes until next month." };
  }

  const ctx = deps.context();
  const outcome = await deps.parse(note, ctx);
  if (outcome.usage) deps.budget.record(deps.model, outcome.usage);
  if (!outcome.ok) return { text: `Sorry, I couldn't log that. ${outcome.reason}` };

  const resolved: ResolvedEntry[] = [];
  const problems: string[] = [];
  for (const entry of outcome.result.entries) {
    const client = ctx.clients.resolve(entry.clientAlias);
    if (!client) {
      problems.push(`I don't recognize the client "${entry.clientAlias}".`);
      continue;
    }
    const issues = validateEntry(entry, ctx.today);
    if (issues.length > 0) {
      problems.push(`${client.name}: ${issues.join("; ")}.`);
      continue;
    }
    resolved.push({ ...entry, clientId: client.id, clientName: client.name });
  }

  if (resolved.length === 0) {
    const detail = [...problems, ...outcome.result.questions].join(" ");
    return { text: `I couldn't find any time entries to log. ${detail}`.trim() };
  }

  const pendingId = deps.pending.add({ userId, entries: resolved });
  const questions = [...problems, ...outcome.result.questions];
  return {
    text: `Review ${resolved.length} time entr${resolved.length === 1 ? "y" : "ies"}`,
    blocks: previewBlocks(pendingId, resolved, questions),
  };
}

/** Approve click: only the technician who posted the note can approve it. */
export async function handleApprove(
  deps: HandlerDeps,
  pendingId: string,
  userId: string,
): Promise<Reply> {
  const batch = deps.pending.peek(pendingId);
  if (!batch) return { text: "This preview expired. Post the note again to log it." };
  if (batch.userId !== userId) return { text: "Only the person who posted this note can approve it." };

  deps.pending.take(pendingId);
  const ids: string[] = [];
  for (const entry of batch.entries) {
    const { id } = await deps.psa.createTimeEntry(entry, userId);
    ids.push(id);
  }
  return { text: `:white_check_mark: Logged ${ids.length} time entr${ids.length === 1 ? "y" : "ies"} (${ids.join(", ")}).` };
}

export function handleCancel(deps: HandlerDeps, pendingId: string, userId: string): Reply {
  const batch = deps.pending.peek(pendingId);
  if (batch && batch.userId !== userId) {
    return { text: "Only the person who posted this note can cancel it." };
  }
  deps.pending.take(pendingId);
  return { text: "Cancelled. Nothing was logged." };
}
