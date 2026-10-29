import { describe, expect, it, vi } from "vitest";
import { buildSystemPrompt, parseNotes, type MessagesClient } from "../src/parser.js";
import { ctx, entry } from "./helpers.js";

/** Fake SDK client: returns a canned response so tests never call the API. */
function fakeClient(response: Record<string, unknown>) {
  const parse = vi.fn().mockResolvedValue({
    usage: { input_tokens: 800, output_tokens: 150 },
    stop_reason: "end_turn",
    parsed_output: null,
    ...response,
  });
  return { client: { messages: { parse } } as unknown as MessagesClient, parse };
}

describe("parseNotes", () => {
  it("returns parsed entries and token usage", async () => {
    const result = { entries: [entry()], questions: [] };
    const { client, parse } = fakeClient({ parsed_output: result });

    const outcome = await parseNotes(client, "claude-opus-5-5", "ACME 2h onsite", ctx);

    expect(outcome).toEqual({
      ok: true,
      result,
      usage: { input_tokens: 800, output_tokens: 150 },
    });
    const request = parse.mock.calls[0]![0];
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.output_config.effort).toBe("low");
    expect(request.messages).toEqual([{ role: "user", content: "ACME 2h onsite" }]);
  });

  it("reports a refusal without reading the content", async () => {
    const { client } = fakeClient({ stop_reason: "refusal" });
    const outcome = await parseNotes(client, "claude-opus-5-5", "note", ctx);
    expect(outcome).toMatchObject({ ok: false, reason: expect.stringContaining("declined") });
  });

  it("reports truncation", async () => {
    const { client } = fakeClient({ stop_reason: "max_tokens" });
    const outcome = await parseNotes(client, "claude-opus-5-5", "note", ctx);
    expect(outcome).toMatchObject({ ok: false, reason: expect.stringContaining("too long") });
  });

  it("reports a missing parsed output", async () => {
    const { client } = fakeClient({});
    const outcome = await parseNotes(client, "claude-opus-5-5", "note", ctx);
    expect(outcome.ok).toBe(false);
    expect(outcome.usage).toEqual({ input_tokens: 800, output_tokens: 150 });
  });
});

describe("buildSystemPrompt", () => {
  it("includes today's date and the known clients", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("Today is 2026-10-28");
    expect(prompt).toContain("Beta Builders (also written as: BETA, BB)");
    expect(prompt).toContain("Never invent work");
  });
});
