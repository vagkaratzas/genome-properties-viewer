// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as d3 from "./d3";
import { drawScrollXBar, updateScrollBars } from "./gp-scroller";

function makeViewer() {
  const svg = d3.select(document.body).append("svg");
  const mainGroup = svg.append("g");

  return {
    mainGroup,
    organisms: ["111", "222", "333"],
    props: [],
    options: {
      cell_side: 20,
      width: 800,
      dimensions: {
        tree: { width: 200 },
        scroller: { short_side: 10 },
        total: { short_side: 20 },
      },
    },
    current_scroll: { x: 0, y: 0 },
    skip_scroll_refreshing: false,
    x: vi.fn(() => 0),
    update_viewer: vi.fn(),
    gp_taxonomy: { y: 0 },
  };
}

describe("drawScrollXBar", () => {
  let viewer;
  let svgNode;

  beforeEach(() => {
    viewer = makeViewer();
    svgNode = document.body.querySelector("svg");
    drawScrollXBar(viewer);
  });

  afterEach(() => {
    document.body.querySelector("svg").remove();
  });

  it("sets viewer.scrollbar_x_g to a d3 selection", () => {
    expect(viewer.scrollbar_x_g).toBeDefined();
    expect(viewer.scrollbar_x_g.node()).not.toBeNull();
  });

  it("appends a g.gpv-scrollbar group", () => {
    expect(svgNode.querySelector("g.gpv-scrollbar")).not.toBeNull();
  });

  it("positions the scrollbar group below the organisms rows", () => {
    // localY = (1 + organisms.length) * cell_side = 4 * 20 = 80
    const transform = viewer.scrollbar_x_g.attr("transform");
    expect(transform).toBe("translate(200, 80)");
  });

  it("starts with opacity 0", () => {
    expect(viewer.scrollbar_x_g.attr("opacity")).toBe("0");
  });

  it("appends a rect.gpv-scrollbar-bg background element", () => {
    expect(svgNode.querySelector("rect.gpv-scrollbar-bg")).not.toBeNull();
  });

  it("sets viewer.scrollbar_x_bg to the background rect selection", () => {
    expect(viewer.scrollbar_x_bg).toBeDefined();
    expect(viewer.scrollbar_x_bg.node()).toBe(
      svgNode.querySelector("rect.gpv-scrollbar-bg")
    );
  });

  it("background rect spans the heatmap width (total width minus tree width)", () => {
    // 800 - 200 = 600
    expect(viewer.scrollbar_x_bg.attr("width")).toBe("600");
  });

  it("appends a rect.gpv-scrollbar-handle drag handle", () => {
    expect(svgNode.querySelector("rect.gpv-scrollbar-handle")).not.toBeNull();
  });

  it("sets viewer.scrollbar_x to the handle rect selection", () => {
    expect(viewer.scrollbar_x).toBeDefined();
    expect(viewer.scrollbar_x.node()).toBe(
      svgNode.querySelector("rect.gpv-scrollbar-handle")
    );
  });

  it("handle rect has ew-resize cursor", () => {
    expect(viewer.scrollbar_x.style("cursor")).toBe("ew-resize");
  });
});

describe("updateScrollBars", () => {
  let viewer;

  beforeEach(() => {
    viewer = makeViewer();
    drawScrollXBar(viewer);
  });

  afterEach(() => {
    document.body.querySelector("svg").remove();
  });

  it("updates the scrollbar group transform to reflect current organism count", () => {
    // localY = (1 + 3) * 20 = 80
    updateScrollBars(viewer, 5, 0);
    expect(viewer.scrollbar_x_g.attr("transform")).toBe("translate(200, 80)");
  });

  it("sets scrollbar opacity to 1 when there are props", () => {
    viewer.props = [{ property: "A" }, { property: "B" }];
    updateScrollBars(viewer, 2, 0);
    expect(viewer.scrollbar_x_g.attr("opacity")).toBe("1");
  });

  it("sets scrollbar opacity to 0 when there are no props", () => {
    viewer.props = [];
    updateScrollBars(viewer, 0, 0);
    expect(viewer.scrollbar_x_g.attr("opacity")).toBe("0");
  });

  it("updates the background rect to available_x width", () => {
    // available_x = width - tree.width - total.short_side = 800 - 200 - 20 = 580
    updateScrollBars(viewer, 5, 0);
    expect(viewer.scrollbar_x_bg.attr("width")).toBe("580");
  });
});
