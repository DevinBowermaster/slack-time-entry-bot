import { describe, expect, it } from "vitest";
import { validateEntry } from "../src/schema.js";
import { entry } from "./helpers.js";

const today = "2026-10-28";

describe("validateEntry", () => {
  it("accepts a normal entry", () => {
    expect(validateEntry(entry(), today)).toEqual([]);
  });

  it.each([0, -1, 17])("rejects %s hours as out of range", (hours) => {
    expect(validateEntry(entry({ hours }), today)).toEqual([
      expect.stringContaining("outside the allowed"),
    ]);
  });

  it("rejects hours that are not quarter-hour increments", () => {
    expect(validateEntry(entry({ hours: 1.1 }), today)).toEqual([
      expect.stringContaining("quarter-hour"),
    ]);
  });

  it("accepts quarter-hour increments", () => {
    for (const hours of [0.25, 0.5, 0.75, 1.5, 7.75]) {
      expect(validateEntry(entry({ hours }), today)).toEqual([]);
    }
  });

  it("rejects future dates", () => {
    expect(validateEntry(entry({ date: "2026-10-29" }), today)).toEqual([
      expect.stringContaining("in the future"),
    ]);
  });

  it("rejects malformed dates", () => {
    expect(validateEntry(entry({ date: "10/28/2026" }), today)).toEqual([
      expect.stringContaining("not a valid date"),
    ]);
  });

  it("rejects implausible mileage but allows null", () => {
    expect(validateEntry(entry({ mileage: 900 }), today)).toHaveLength(1);
    expect(validateEntry(entry({ mileage: null }), today)).toEqual([]);
  });

  it("rejects an empty summary", () => {
    expect(validateEntry(entry({ summary: "  " }), today)).toEqual(["summary is empty"]);
  });
});
