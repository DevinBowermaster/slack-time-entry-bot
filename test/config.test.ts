import { describe, expect, it } from "vitest";
import { loadConfig, todayIn } from "../src/config.js";

const base = { SLACK_BOT_TOKEN: "xoxb-test", SLACK_APP_TOKEN: "xapp-test" };

describe("loadConfig", () => {
  it("applies safe defaults", () => {
    const config = loadConfig(base);
    expect(config.CLAUDE_MODEL).toBe("claude-opus-5-5");
    expect(config.MONTHLY_BUDGET_USD).toBe(10);
  });

  it("rejects tokens of the wrong type with a readable message", () => {
    expect(() => loadConfig({ ...base, SLACK_BOT_TOKEN: "xapp-oops" })).toThrow(/SLACK_BOT_TOKEN/);
  });

  it("rejects a non-positive budget", () => {
    expect(() => loadConfig({ ...base, MONTHLY_BUDGET_USD: "0" })).toThrow(/MONTHLY_BUDGET_USD/);
  });
});

describe("todayIn", () => {
  it("uses the team's time zone, not UTC", () => {
    const lateEvening = new Date("2026-10-29T03:00:00Z"); // 9pm Oct 28 in Boise
    expect(todayIn("America/Boise", lateEvening)).toBe("2026-10-28");
    expect(todayIn("UTC", lateEvening)).toBe("2026-10-29");
  });
});
