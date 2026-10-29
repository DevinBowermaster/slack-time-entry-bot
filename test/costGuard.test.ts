import { describe, expect, it } from "vitest";
import { BudgetGuard, MemoryBudgetStore, costUsd } from "../src/costGuard.js";

describe("costUsd", () => {
  it("prices input and output tokens per million", () => {
    expect(costUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 0, output_tokens: 1_000_000 })).toBe(0.5);
  });

  it("throws for an unpriced model so the cap can't be silently bypassed", () => {
    expect(() => costUsd("unknown-model", { input_tokens: 1, output_tokens: 1 })).toThrow(
      /No price configured/,
    );
  });
});

describe("BudgetGuard", () => {
  const usage = { input_tokens: 500_000, output_tokens: 100_000 }; // $4.00 on Opus 5.5

  it("blocks spending once the monthly cap is reached", () => {
    const guard = new BudgetGuard(5, new MemoryBudgetStore(), () => new Date("2026-10-15"));
    expect(guard.canSpend()).toBe(true);
    guard.record("claude-opus-5-5", usage);
    expect(guard.canSpend()).toBe(true);
    guard.record("claude-opus-5-5", usage);
    expect(guard.spentThisMonth()).toBeCloseTo(8);
    expect(guard.canSpend()).toBe(false);
  });

  it("resets at the start of a new month", () => {
    const store = new MemoryBudgetStore();
    let now = new Date("2026-10-31");
    const guard = new BudgetGuard(5, store, () => now);
    guard.record("claude-opus-5-5", usage);
    guard.record("claude-opus-5-5", usage);
    expect(guard.canSpend()).toBe(false);
    now = new Date("2026-11-01T12:00:00Z");
    expect(guard.spentThisMonth()).toBe(0);
    expect(guard.canSpend()).toBe(true);
  });
});
