import { describe, expect, it } from "vitest";
import { ClientDirectory } from "../src/clientDirectory.js";
import { clients } from "./helpers.js";

describe("ClientDirectory", () => {
  it("resolves aliases case-insensitively", () => {
    expect(clients.resolve("acme")?.id).toBe("C-1001");
    expect(clients.resolve("  BB ")?.name).toBe("Beta Builders");
  });

  it("resolves full names and ids", () => {
    expect(clients.resolve("acme dental")?.id).toBe("C-1001");
    expect(clients.resolve("C-1002")?.name).toBe("Beta Builders");
  });

  it("returns undefined for unknown clients instead of guessing", () => {
    expect(clients.resolve("Gamma Corp")).toBeUndefined();
  });

  it("loads and validates the example file", () => {
    const dir = ClientDirectory.fromFile("data/clients.example.json");
    expect(dir.clients.length).toBeGreaterThan(0);
    expect(dir.resolve("DELTA")?.name).toBe("Delta Logistics");
  });

  it("lists clients for the prompt", () => {
    expect(clients.describeForPrompt()).toContain("Acme Dental (also written as: ACME)");
  });
});
