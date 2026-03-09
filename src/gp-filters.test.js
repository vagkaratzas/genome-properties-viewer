import { describe, it, expect, beforeEach } from "vitest";
import { filterByLegend, filterByHierarchy, filterByText } from "./gp-filters";

// Helper to build a minimal viewer with organisms and props.
// prop.values keys are taxIds; organisms is the active subset.
function makeViewer({
  organisms,
  props,
  legend_filters,
  gp_hierarchy,
  filter_text,
} = {}) {
  return {
    organisms: organisms || [],
    props: props || [],
    legend_filters: legend_filters || null,
    gp_hierarchy: gp_hierarchy || { hierarchy_switch: [] },
    filter_text: filter_text || null,
  };
}

function makeProps(organisms) {
  // Returns 4 props:
  //   prop_all_yes  — all organisms have YES
  //   prop_some_no  — one organism has NO, rest YES
  //   prop_partial  — all have PARTIAL
  //   prop_mixed    — yes/no/partial mix
  const [o1, o2, o3] = organisms;
  return [
    {
      property: "GenProp0001",
      name: "all yes prop",
      values: { [o1]: "YES", [o2]: "YES", [o3]: "YES", TOTAL: {} },
      parent_top_properties: null,
    },
    {
      property: "GenProp0002",
      name: "some no prop",
      values: { [o1]: "YES", [o2]: "NO", [o3]: "YES", TOTAL: {} },
      parent_top_properties: null,
    },
    {
      property: "GenProp0003",
      name: "all partial prop",
      values: { [o1]: "PARTIAL", [o2]: "PARTIAL", [o3]: "PARTIAL", TOTAL: {} },
      parent_top_properties: null,
    },
    {
      property: "GenProp0004",
      name: "mixed prop",
      values: { [o1]: "YES", [o2]: "NO", [o3]: "PARTIAL", TOTAL: {} },
      parent_top_properties: null,
    },
  ];
}

const ORGS = ["111", "222", "333"];

// ────────────────────────────────────────────────────────────
// filterByLegend
// ────────────────────────────────────────────────────────────
describe("filterByLegend", () => {
  let props;
  beforeEach(() => {
    props = makeProps(ORGS);
  });

  it("does nothing when legend_filters is null", () => {
    const viewer = makeViewer({ organisms: ORGS, props, legend_filters: null });
    filterByLegend(viewer);
    expect(viewer.props).toHaveLength(4);
  });

  it("∀ YES — keeps only props where all organisms have YES", () => {
    const viewer = makeViewer({
      organisms: ORGS,
      props,
      legend_filters: { YES: "∀" },
    });
    filterByLegend(viewer);
    expect(viewer.props.map((p) => p.property)).toEqual(["GenProp0001"]);
  });

  it("∃ NO — keeps props where at least one organism has NO", () => {
    const viewer = makeViewer({
      organisms: ORGS,
      props,
      legend_filters: { NO: "∃" },
    });
    filterByLegend(viewer);
    expect(viewer.props.map((p) => p.property)).toEqual([
      "GenProp0002",
      "GenProp0004",
    ]);
  });

  it("∄ PARTIAL — keeps props where NO organism has PARTIAL", () => {
    const viewer = makeViewer({
      organisms: ORGS,
      props,
      legend_filters: { PARTIAL: "∄" },
    });
    filterByLegend(viewer);
    expect(viewer.props.map((p) => p.property)).toEqual([
      "GenProp0001",
      "GenProp0002",
    ]);
  });

  it("only considers organisms present in viewer.organisms (ignores extra)", () => {
    // Only organism "111" is active; GenProp0002 has YES for "111"
    const viewer = makeViewer({
      organisms: ["111"],
      props,
      legend_filters: { YES: "∀" },
    });
    filterByLegend(viewer);
    // All props have YES for "111" except prop_some_no (YES), prop_partial (PARTIAL), prop_mixed (YES)
    // Actually: o1=YES for all except prop_partial (PARTIAL) and prop_all_yes(YES), prop_some_no(YES), prop_mixed(YES)
    expect(viewer.props.map((p) => p.property)).toEqual([
      "GenProp0001",
      "GenProp0002",
      "GenProp0004",
    ]);
  });
});

// ────────────────────────────────────────────────────────────
// filterByHierarchy
// ────────────────────────────────────────────────────────────
describe("filterByHierarchy", () => {
  it("passes through props with null parent_top_properties", () => {
    const props = [{ property: "A", parent_top_properties: null }];
    const viewer = makeViewer({
      props,
      gp_hierarchy: { hierarchy_switch: [{ id: "TopA", enable: false }] },
    });
    filterByHierarchy(viewer);
    expect(viewer.props).toHaveLength(1);
  });

  it("keeps props whose parent is enabled", () => {
    const props = [
      { property: "A", parent_top_properties: ["TopA"] },
      { property: "B", parent_top_properties: ["TopB"] },
    ];
    const viewer = makeViewer({
      props,
      gp_hierarchy: {
        hierarchy_switch: [
          { id: "TopA", enable: true },
          { id: "TopB", enable: false },
        ],
      },
    });
    filterByHierarchy(viewer);
    expect(viewer.props.map((p) => p.property)).toEqual(["A"]);
  });

  it("removes props whose every parent is disabled", () => {
    const props = [{ property: "A", parent_top_properties: ["TopX"] }];
    const viewer = makeViewer({
      props,
      gp_hierarchy: {
        hierarchy_switch: [{ id: "TopX", enable: false }],
      },
    });
    filterByHierarchy(viewer);
    expect(viewer.props).toHaveLength(0);
  });

  it("keeps prop if ANY of its parents is enabled", () => {
    const props = [{ property: "A", parent_top_properties: ["TopA", "TopB"] }];
    const viewer = makeViewer({
      props,
      gp_hierarchy: {
        hierarchy_switch: [
          { id: "TopA", enable: false },
          { id: "TopB", enable: true },
        ],
      },
    });
    filterByHierarchy(viewer);
    expect(viewer.props).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────
// filterByText
// ────────────────────────────────────────────────────────────
describe("filterByText", () => {
  const props = [
    { property: "GenProp0001", name: "Carbon fixation" },
    { property: "GenProp0002", name: "Nitrogen metabolism" },
    { property: "GenProp0003", name: "Photosynthesis" },
  ];

  it("does nothing when filter_text is null", () => {
    const viewer = makeViewer({ props: [...props], filter_text: null });
    filterByText(viewer);
    expect(viewer.props).toHaveLength(3);
  });

  it("does nothing when filter_text is empty string", () => {
    const viewer = makeViewer({ props: [...props], filter_text: "" });
    filterByText(viewer);
    expect(viewer.props).toHaveLength(3);
  });

  it("filters by name case-insensitively", () => {
    const viewer = makeViewer({ props: [...props], filter_text: "carbon" });
    filterByText(viewer);
    expect(viewer.props.map((p) => p.property)).toEqual(["GenProp0001"]);
  });

  it("filters by property id case-insensitively", () => {
    const viewer = makeViewer({
      props: [...props],
      filter_text: "genprop0002",
    });
    filterByText(viewer);
    expect(viewer.props.map((p) => p.property)).toEqual(["GenProp0002"]);
  });

  it("returns empty when no match", () => {
    const viewer = makeViewer({ props: [...props], filter_text: "zzznomatch" });
    filterByText(viewer);
    expect(viewer.props).toHaveLength(0);
  });

  it("matches partial substrings", () => {
    const viewer = makeViewer({ props: [...props], filter_text: "sis" });
    filterByText(viewer);
    // "Photosynthesis" and "Carbon fixation"? No. Just "Photosynthesis"
    expect(viewer.props.map((p) => p.property)).toEqual(["GenProp0003"]);
  });
});
