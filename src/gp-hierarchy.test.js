import { describe, it, expect, beforeEach } from "vitest";
import GenomePropertiesHierarchy from "./gp-hierarchy";

// Minimal hierarchy fixture:
//
//   root
//   ├── TopA
//   │   ├── ChildA1
//   │   └── ChildA2
//   └── TopB
//       └── ChildB1 (also child of ChildA1 — shared node)
const MOCK_HIERARCHY = {
  id: "root",
  name: "Root",
  children: [
    {
      id: "TopA",
      name: "Top A",
      children: [
        {
          id: "ChildA1",
          name: "Child A1",
          children: [{ id: "ChildB1", name: "Shared", children: [] }],
        },
        { id: "ChildA2", name: "Child A2", children: [] },
      ],
    },
    {
      id: "TopB",
      name: "Top B",
      children: [{ id: "ChildB1", name: "Shared", children: [] }],
    },
  ],
};

describe("GenomePropertiesHierarchy", () => {
  let hier;

  beforeEach(() => {
    hier = new GenomePropertiesHierarchy();
    hier.load_hierarchy_from_data(JSON.parse(JSON.stringify(MOCK_HIERARCHY)));
  });

  // ── add_node_recursively / load_hierarchy_from_data ──────────
  describe("load_hierarchy_from_data", () => {
    it("populates this.nodes for every node in the tree", () => {
      expect(Object.keys(hier.nodes)).toEqual(
        expect.arrayContaining([
          "root",
          "TopA",
          "TopB",
          "ChildA1",
          "ChildA2",
          "ChildB1",
        ]),
      );
    });

    it("sets this.root to the data object", () => {
      expect(hier.root.id).toBe("root");
    });

    it("creates hierarchy_switch with one entry per top-level child, enabled by default", () => {
      expect(hier.hierarchy_switch).toHaveLength(2);
      expect(hier.hierarchy_switch.every((s) => s.enable)).toBe(true);
      expect(hier.hierarchy_switch.map((s) => s.id)).toEqual(
        expect.arrayContaining(["TopA", "TopB"]),
      );
    });

    it("creates a color scale with the top-level ids as domain", () => {
      expect(typeof hier.color).toBe("function");
      expect(hier.color("TopA")).toBeTruthy();
      expect(hier.color("TopB")).toBeTruthy();
    });
  });

  describe("add_node_recursively", () => {
    it("assigns a parents array to each node", () => {
      expect(Array.isArray(hier.nodes.TopA.parents)).toBe(true);
      expect(Array.isArray(hier.nodes.ChildA1.parents)).toBe(true);
    });

    it("root node gets an empty parents array", () => {
      expect(hier.nodes.root.parents).toHaveLength(0);
    });

    it("shared node (ChildB1) collects parents from both paths", () => {
      const b1 = hier.nodes.ChildB1;
      const parentIds = b1.parents.map((p) => p.id);
      expect(parentIds).toContain("ChildA1");
      expect(parentIds).toContain("TopB");
    });
  });

  // ── get_top_level_gp ─────────────────────────────────────────
  describe("get_top_level_gp", () => {
    it("returns null for the root node", () => {
      expect(hier.get_top_level_gp(hier.root)).toBeNull();
    });

    it("returns the node itself for a direct child of root", () => {
      const topA = hier.nodes.TopA;
      const result = hier.get_top_level_gp(topA);
      expect(result).toBeInstanceOf(Set);
      expect([...result].map((n) => n.id)).toEqual(["TopA"]);
    });

    it("returns the top-level ancestor for a deep node", () => {
      const childA2 = hier.nodes.ChildA2;
      const result = hier.get_top_level_gp(childA2);
      expect([...result].map((n) => n.id)).toEqual(["TopA"]);
    });

    it("returns both top-level ancestors for a shared node", () => {
      const b1 = hier.nodes.ChildB1;
      const result = hier.get_top_level_gp(b1);
      const ids = [...result].map((n) => n.id).sort();
      expect(ids).toEqual(["TopA", "TopB"]);
    });
  });

  // ── get_top_level_gp_by_id ───────────────────────────────────
  describe("get_top_level_gp_by_id", () => {
    it("returns ids of the top-level ancestors", () => {
      const ids = hier.get_top_level_gp_by_id("ChildA2");
      expect(ids).toEqual(["TopA"]);
    });

    it("returns multiple ids for a shared node", () => {
      const ids = hier.get_top_level_gp_by_id("ChildB1").sort();
      expect(ids).toEqual(["TopA", "TopB"]);
    });

    it("returns an empty array for an unknown id", () => {
      expect(hier.get_top_level_gp_by_id("NonExistent")).toEqual([]);
    });
  });

  // ── toggle_switch ─────────────────────────────────────────────
  describe("toggle_switch", () => {
    it("flips enable from true to false", () => {
      hier.toggle_switch({ id: "TopA" });
      const entry = hier.hierarchy_switch.find((s) => s.id === "TopA");
      expect(entry.enable).toBe(false);
    });

    it("flips enable back to true on second call", () => {
      hier.toggle_switch({ id: "TopA" });
      hier.toggle_switch({ id: "TopA" });
      const entry = hier.hierarchy_switch.find((s) => s.id === "TopA");
      expect(entry.enable).toBe(true);
    });

    it("dispatches switchChanged event with the updated switch array", () => {
      let received = null;
      hier.on("switchChanged", (data) => {
        received = data;
      });
      hier.toggle_switch({ id: "TopB" });
      expect(received).toBe(hier.hierarchy_switch);
    });

    it("does not affect other switches", () => {
      hier.toggle_switch({ id: "TopA" });
      const topB = hier.hierarchy_switch.find((s) => s.id === "TopB");
      expect(topB.enable).toBe(true);
    });
  });

  // ── on() / hierarchyLoaded event ─────────────────────────────
  describe("on() / hierarchyLoaded event", () => {
    it("fires hierarchyLoaded when load_hierarchy_from_data is called", () => {
      const h = new GenomePropertiesHierarchy();
      let fired = false;
      h.on("hierarchyLoaded", () => {
        fired = true;
      });
      h.load_hierarchy_from_data(JSON.parse(JSON.stringify(MOCK_HIERARCHY)));
      expect(fired).toBe(true);
    });

    it("on() returns the instance for chaining", () => {
      const result = hier.on("switchChanged", () => {});
      expect(result).toBe(hier);
    });
  });
});
