import { describe, it, expect } from "vitest";
import { refreshGPTotals } from "./gp-totals";

function makeViewer(organisms, propsValues) {
  return {
    organisms,
    props: propsValues.map(([property, values]) => ({ property, values })),
  };
}

describe("refreshGPTotals", () => {
  it("counts YES, NO and PARTIAL correctly across organisms", () => {
    const viewer = makeViewer(
      ["111", "222", "333"],
      [["GenProp0001", { 111: "YES", 222: "YES", 333: "NO", TOTAL: {} }]]
    );
    refreshGPTotals(viewer);
    expect(viewer.props[0].values.TOTAL).toEqual({ YES: 2, NO: 1, PARTIAL: 0 });
  });

  it("handles all PARTIAL", () => {
    const viewer = makeViewer(
      ["111", "222"],
      [["GenProp0001", { 111: "PARTIAL", 222: "PARTIAL", TOTAL: {} }]]
    );
    refreshGPTotals(viewer);
    expect(viewer.props[0].values.TOTAL).toEqual({ YES: 0, NO: 0, PARTIAL: 2 });
  });

  it("handles a single organism", () => {
    const viewer = makeViewer(
      ["111"],
      [["GenProp0001", { 111: "YES", TOTAL: {} }]]
    );
    refreshGPTotals(viewer);
    expect(viewer.props[0].values.TOTAL).toEqual({ YES: 1, NO: 0, PARTIAL: 0 });
  });

  it("updates TOTAL for every prop in viewer.props", () => {
    const viewer = makeViewer(
      ["111", "222"],
      [
        ["GenProp0001", { 111: "YES", 222: "NO", TOTAL: {} }],
        ["GenProp0002", { 111: "NO", 222: "NO", TOTAL: {} }],
        ["GenProp0003", { 111: "PARTIAL", 222: "YES", TOTAL: {} }],
      ]
    );
    refreshGPTotals(viewer);
    expect(viewer.props[0].values.TOTAL).toEqual({ YES: 1, NO: 1, PARTIAL: 0 });
    expect(viewer.props[1].values.TOTAL).toEqual({ YES: 0, NO: 2, PARTIAL: 0 });
    expect(viewer.props[2].values.TOTAL).toEqual({ YES: 1, NO: 0, PARTIAL: 1 });
  });

  it("ignores values for organisms not in viewer.organisms", () => {
    // "999" is in values but not in organisms — should not be counted
    const viewer = makeViewer(
      ["111"],
      [["GenProp0001", { 111: "YES", 999: "NO", TOTAL: {} }]]
    );
    refreshGPTotals(viewer);
    expect(viewer.props[0].values.TOTAL).toEqual({ YES: 1, NO: 0, PARTIAL: 0 });
  });

  it("overwrites a stale TOTAL on each call", () => {
    const viewer = makeViewer(
      ["111"],
      [["GenProp0001", { 111: "NO", TOTAL: { YES: 99, NO: 0, PARTIAL: 0 } }]]
    );
    refreshGPTotals(viewer);
    expect(viewer.props[0].values.TOTAL).toEqual({ YES: 0, NO: 1, PARTIAL: 0 });
  });

  it("handles an empty organisms array — all counts are 0", () => {
    const viewer = makeViewer([], [["GenProp0001", { 111: "YES", TOTAL: {} }]]);
    refreshGPTotals(viewer);
    expect(viewer.props[0].values.TOTAL).toEqual({ YES: 0, NO: 0, PARTIAL: 0 });
  });

  it("handles an empty props array without error", () => {
    const viewer = makeViewer(["111"], []);
    expect(() => refreshGPTotals(viewer)).not.toThrow();
  });
});
