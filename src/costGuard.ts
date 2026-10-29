import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { TokenUsage } from "./parser.js";

/** Published per-million-token prices in USD (input, output). */
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function costUsd(model: string, usage: TokenUsage): number {
  const price = PRICES_PER_MTOK[model];
  if (!price) {
    throw new Error(`No price configured for model "${model}". Add it to PRICES_PER_MTOK.`);
  }
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
}

export interface BudgetStore {
  load(): { month: string; spentUsd: number } | undefined;
  save(state: { month: string; spentUsd: number }): void;
}

export class MemoryBudgetStore implements BudgetStore {
  private state: { month: string; spentUsd: number } | undefined;
  load() {
    return this.state;
  }
  save(state: { month: string; spentUsd: number }) {
    this.state = state;
  }
}

export class FileBudgetStore implements BudgetStore {
  constructor(private readonly path: string) {}
  load() {
    if (!existsSync(this.path)) return undefined;
    return JSON.parse(readFileSync(this.path, "utf8")) as { month: string; spentUsd: number };
  }
  save(state: { month: string; spentUsd: number }) {
    writeFileSync(this.path, JSON.stringify(state));
  }
}

/**
 * Hard monthly spend cap. Every Claude call is checked before it is made and
 * recorded after, so a runaway loop or a chatty channel cannot run up a bill.
 */
export class BudgetGuard {
  constructor(
    private readonly limitUsd: number,
    private readonly store: BudgetStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private currentMonth(): string {
    return this.now().toISOString().slice(0, 7);
  }

  spentThisMonth(): number {
    const state = this.store.load();
    return state && state.month === this.currentMonth() ? state.spentUsd : 0;
  }

  canSpend(): boolean {
    return this.spentThisMonth() < this.limitUsd;
  }

  record(model: string, usage: TokenUsage): number {
    const cost = costUsd(model, usage);
    this.store.save({ month: this.currentMonth(), spentUsd: this.spentThisMonth() + cost });
    return cost;
  }
}
