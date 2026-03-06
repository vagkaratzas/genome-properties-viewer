// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import GenomePropertiesTaxonomy from "./gp-taxonomy";

// Minimal two-leaf taxonomy fixture
const MOCK_TAX_DATA = {
  id: "root",
  taxid: "root",
  name: "Root",
  lineage: "",
  children: [
    {
      id: "9606",
      taxid: 9606,
      name: "Homo sapiens",
      lineage: "Eukaryota;Metazoa",
      children: [],
    },
    {
      id: "10090",
      taxid: 10090,
      name: "Mus musculus",
      lineage: "Eukaryota;Metazoa",
      children: [],
    },
  ],
};

function makeTaxonomy() {
  return new GenomePropertiesTaxonomy({
    path: "/mock/taxonomy.json",
    width: 200,
    height: 600,
  });
}

// load_taxonomy_obj calls update_tree which requires tree_g (an SVG selection).
// For data-focused tests we spy on update_tree to keep the tests free of SVG rendering.
function loadWithMockedRender(tax, data) {
  vi.spyOn(tax, "update_tree").mockImplementation(() => {});
  tax.load_taxonomy_obj(JSON.parse(JSON.stringify(data)));
}

describe("GenomePropertiesTaxonomy", () => {
  let tax;

  beforeEach(() => {
    tax = makeTaxonomy();
  });

  // ── load_taxonomy_obj ─────────────────────────────────────
  describe("load_taxonomy_obj", () => {
    it("sets this.root to the loaded data", () => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      expect(tax.root.id).toBe("root");
    });

    it("sets root.parent to null", () => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      expect(tax.root.parent).toBeNull();
    });

    it("sets root.expanded to true", () => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      expect(tax.root.expanded).toBe(true);
    });

    it("populates this.nodes for every node in the tree", () => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      // Object keys are always strings, even when the original value was a number
      expect(Object.keys(tax.nodes)).toEqual(
        expect.arrayContaining(["root", "9606", "10090"]),
      );
    });

    it("marks leaf nodes as not expanded", () => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      expect(tax.nodes[9606].expanded).toBe(false);
      expect(tax.nodes[10090].expanded).toBe(false);
    });

    it("populates this.organisms with leaf taxids", () => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      expect(tax.organisms).toEqual(expect.arrayContaining([9606, 10090]));
    });

    it("fires the taxonomyLoaded event with the root", () => {
      let receivedRoot = null;
      tax.on("taxonomyLoaded", (root) => {
        receivedRoot = root;
      });
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      expect(receivedRoot.id).toBe("root");
    });

    it("calls update_tree to trigger rendering", () => {
      const spy = vi.spyOn(tax, "update_tree").mockImplementation(() => {});
      tax.load_taxonomy_obj(JSON.parse(JSON.stringify(MOCK_TAX_DATA)));
      expect(spy).toHaveBeenCalledWith(500);
    });
  });

  // ── get_tax_list ──────────────────────────────────────────
  describe("get_tax_list", () => {
    it("returns the taxids of loaded organisms in the same order as this.organisms", () => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      const list = tax.get_tax_list();
      expect(list).toEqual(expect.arrayContaining([9606, 10090]));
      expect(list).toHaveLength(2);
    });
  });

  // ── set_organisms_loaded ──────────────────────────────────
  describe("set_organisms_loaded", () => {
    beforeEach(() => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
    });

    it("marks an existing node as loaded", () => {
      tax.set_organisms_loaded(9606, false);
      expect(tax.nodes[9606].loaded).toBe(true);
    });

    it("creates a new node for an id not in the taxonomy", () => {
      tax.set_organisms_loaded(99999, true);
      expect(tax.nodes[99999]).toBeDefined();
      expect(tax.nodes[99999].loaded).toBe(true);
    });

    it("appends the new node to root.children when id is unknown", () => {
      const childrenBefore = tax.root.children.length;
      tax.set_organisms_loaded(99999, true);
      expect(tax.root.children).toHaveLength(childrenBefore + 1);
    });

    it("stores isFromFile on the newly created node", () => {
      tax.set_organisms_loaded(99999, true);
      expect(tax.nodes[99999].isFromFile).toBe(true);
    });
  });

  // ── remove_organism_loaded ────────────────────────────────
  describe("remove_organism_loaded", () => {
    beforeEach(() => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      tax.set_organisms_loaded(9606, false);
    });

    it("sets loaded to false for the given taxId", () => {
      tax.remove_organism_loaded(9606, false);
      expect(tax.nodes[9606].loaded).toBe(false);
    });

    it("does not remove the node from this.nodes when isFromFile=false", () => {
      tax.remove_organism_loaded(9606, false);
      expect(tax.nodes[9606]).toBeDefined();
    });

    it("removes the node from this.nodes when isFromFile=true", () => {
      tax.set_organisms_loaded(77777, true);
      tax.remove_organism_loaded(77777, true);
      expect(tax.nodes[77777]).toBeUndefined();
    });

    it("removes the node from root.children when isFromFile=true", () => {
      tax.set_organisms_loaded(77777, true);
      tax.remove_organism_loaded(77777, true);
      const ids = tax.root.children.map((c) => c.taxid || c.id);
      expect(ids).not.toContain(77777);
    });
  });

  // ── sortBy ────────────────────────────────────────────────
  describe("sortBy", () => {
    beforeEach(() => {
      loadWithMockedRender(tax, MOCK_TAX_DATA);
      // Manually set orders as update_tree was mocked
      tax.orders = {
        tax_id: [0, 1],
        org_name: [1, 0],
      };
    });

    it("updates current_order to the chosen sort array", () => {
      tax.sortBy("org_name");
      expect(tax.current_order).toEqual([1, 0]);
    });

    it("fires the changeOrder event with the new order", () => {
      let received = null;
      tax.on("changeOrder", (order) => {
        received = order;
      });
      tax.sortBy("tax_id");
      expect(received).toEqual([0, 1]);
    });
  });

  // ── on() ─────────────────────────────────────────────────
  describe("on()", () => {
    it("returns the instance for chaining", () => {
      expect(tax.on("changeOrder", () => {})).toBe(tax);
    });
  });
});
