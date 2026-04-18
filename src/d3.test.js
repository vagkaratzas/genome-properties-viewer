import { describe, it, expect } from "vitest";
import { entries, schemeCategory20b } from "./d3";

describe("entries() shim", () => {
  it("converts a plain object to [{key, value}] pairs", () => {
    const result = entries({ a: 1, b: 2 });
    expect(result).toEqual([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
  });

  it("returns an empty array for an empty object", () => {
    expect(entries({})).toEqual([]);
  });

  it("returns an empty array for null input", () => {
    expect(entries(null)).toEqual([]);
  });

  it("returns an empty array for undefined input", () => {
    expect(entries(undefined)).toEqual([]);
  });

  it("handles nested values without recursing", () => {
    const nested = { x: { y: 1 } };
    const result = entries(nested);
    expect(result).toEqual([{ key: "x", value: { y: 1 } }]);
  });
});

describe("schemeCategory20b", () => {
  it("is an array of 20 hex color strings", () => {
    expect(Array.isArray(schemeCategory20b)).toBe(true);
    expect(schemeCategory20b).toHaveLength(20);
  });

  it("each entry is a 7-char hex string starting with #", () => {
    for (const color of schemeCategory20b) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
