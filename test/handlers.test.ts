import { describe, expect, it, vi } from "vitest";
import { BudgetGuard, MemoryBudgetStore } from "../src/costGuard.js";
import type { ParseOutcome } from "../src/parser.js";
import { InMemoryPsa } from "../src/psa/mockPsa.js";
import { APPROVE_ACTION } from "../src/slack/blocks.js";
import {
  PendingStore,
  handleApprove,
  handleCancel,
  handleNote,
  type HandlerDeps,
} from "../src/slack/handlers.js";
import { ctx, entry } from "./helpers.js";

const usage = { input_tokens: 800, output_tokens: 150 };

function makeDeps(outcome: ParseOutcome, budgetUsd = 10) {
  const psa = new InMemoryPsa();
  const deps: HandlerDeps = {
    parse: vi.fn().mockResolvedValue(outcome),
    context: () => ctx,
    budget: new BudgetGuard(budgetUsd, new MemoryBudgetStore()),
    model: "claude-opus-5-5",
    psa,
    pending: new PendingStore(),
  };
  return { deps, psa };
}

function pendingIdFrom(blocks: unknown): string {
  const actions = (blocks as Array<{ type: string; elements?: Array<{ action_id?: string; value?: string }> }>)
    .find((b) => b.type === "actions");
  const value = actions?.elements?.find((e) => e.action_id === APPROVE_ACTION)?.value;
  if (!value) throw new Error("no approve button");
  return value;
}

describe("handleNote", () => {
  it("shows a preview and writes nothing before approval", async () => {
    const { deps, psa } = makeDeps({
      ok: true,
      usage,
      result: { entries: [entry(), entry({ clientAlias: "BB", hours: 0.5, workType: "shop" })], questions: [] },
    });

    const reply = await handleNote(deps, "U1", "ACME 2h onsite; BB .5 shop");

    expect(reply.text).toBe("Review 2 time entries");
    expect(JSON.stringify(reply.blocks)).toContain("Beta Builders");
    expect(psa.entries).toHaveLength(0);
  });

  it("drops unknown clients and invalid entries and explains why", async () => {
    const { deps } = makeDeps({
      ok: true,
      usage,
      result: {
        entries: [entry(), entry({ clientAlias: "Gamma" }), entry({ hours: 30 })],
        questions: ["Was the BB visit today?"],
      },
    });

    const reply = await handleNote(deps, "U1", "note");
    const text = JSON.stringify(reply.blocks);

    expect(reply.text).toBe("Review 1 time entry");
    expect(text).toContain('don\'t recognize the client \\"Gamma\\"');
    expect(text).toContain("outside the allowed");
    expect(text).toContain("Was the BB visit today?");
  });

  it("records spend even when parsing fails", async () => {
    const { deps } = makeDeps({ ok: false, reason: "Claude declined to process this note.", usage });
    const reply = await handleNote(deps, "U1", "note");
    expect(reply.text).toContain("couldn't log that");
    expect(deps.budget.spentThisMonth()).toBeGreaterThan(0);
  });

  it("refuses to call the model once the budget is spent", async () => {
    const { deps } = makeDeps({ ok: true, usage, result: { entries: [], questions: [] } }, 0.000001);
    deps.budget.record("claude-opus-5-5", usage);

    const reply = await handleNote(deps, "U1", "note");

    expect(reply.text).toContain("budget is used up");
    expect(deps.parse).not.toHaveBeenCalled();
  });
});

describe("approval flow", () => {
  async function preview() {
    const ctxDeps = makeDeps({ ok: true, usage, result: { entries: [entry()], questions: [] } });
    const reply = await handleNote(ctxDeps.deps, "U1", "ACME 2h onsite");
    return { ...ctxDeps, pendingId: pendingIdFrom(reply.blocks) };
  }

  it("writes entries to the PSA when the author approves", async () => {
    const { deps, psa, pendingId } = await preview();
    const reply = await handleApprove(deps, pendingId, "U1");
    expect(reply.text).toContain("Logged 1 time entry (TE-0001)");
    expect(psa.entries[0]).toMatchObject({ clientId: "C-1001", technicianId: "U1", hours: 2 });
  });

  it("blocks anyone else from approving", async () => {
    const { deps, psa, pendingId } = await preview();
    const reply = await handleApprove(deps, pendingId, "U2");
    expect(reply.text).toContain("Only the person who posted");
    expect(psa.entries).toHaveLength(0);
  });

  it("cannot be approved twice", async () => {
    const { deps, psa, pendingId } = await preview();
    await handleApprove(deps, pendingId, "U1");
    const second = await handleApprove(deps, pendingId, "U1");
    expect(second.text).toContain("expired");
    expect(psa.entries).toHaveLength(1);
  });

  it("cancel discards the batch", async () => {
    const { deps, psa, pendingId } = await preview();
    expect(handleCancel(deps, pendingId, "U1").text).toContain("Nothing was logged");
    expect((await handleApprove(deps, pendingId, "U1")).text).toContain("expired");
    expect(psa.entries).toHaveLength(0);
  });
});
