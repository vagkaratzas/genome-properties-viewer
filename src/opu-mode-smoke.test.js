// @vitest-environment jsdom
/**
 * Smoke test: OPU mode label-leaves counts.
 *
 * Verifies that internal taxonomy nodes display the correct number of
 * downstream OPU organisms after switching to OPU mode (filter_to_taxids).
 * The count must reflect only OPU taxa (isFromFile), not the full taxonomy.
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as d3 from "./d3";
import GenomePropertiesTaxonomy from "./gp-taxonomy";

// Taxonomy: root → Bacteria (2) with 2 phyla (so prune_inner_nodes won't collapse it)
//                             ↘ Archaea (4) — single branch
// Bacteria has number_of_leaves=2 (the 2 real leaf species below it).
// Two OPU organisms will be placed under Bacteria (taxid "2").
const MOCK_TAX = {
  id: "root",
  taxid: "root",
  name: "root",
  lineage: "",
  number_of_leaves: 3,
  expanded: true,
  children: [
    {
      id: "2",
      taxid: "2",
      name: "Bacteria",
      lineage: "Bacteria",
      number_of_leaves: 2,
      children: [
        {
          id: "200",
          taxid: "200",
          name: "Proteobacteria",
          lineage: "Bacteria;Proteobacteria",
          number_of_leaves: 1,
          children: [
            {
              id: "201",
              taxid: "201",
              name: "some_leaf",
              lineage: "Bacteria;Proteobacteria;some_leaf",
              number_of_leaves: 1,
              children: [],
            },
          ],
        },
        {
          id: "300",
          taxid: "300",
          name: "Firmicutes",
          lineage: "Bacteria;Firmicutes",
          number_of_leaves: 1,
          children: [
            {
              id: "301",
              taxid: "301",
              name: "firm_leaf",
              lineage: "Bacteria;Firmicutes;firm_leaf",
              number_of_leaves: 1,
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: "4",
      taxid: "4",
      name: "Archaea",
      lineage: "Archaea",
      number_of_leaves: 1,
      children: [
        {
          id: "401",
          taxid: "401",
          name: "arch_leaf",
          lineage: "Archaea;arch_leaf",
          number_of_leaves: 1,
          children: [],
        },
      ],
    },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find a .node <g> whose bound datum has d.data.id === taxId.
 * Returns a D3 selection or null.
 */
function findNodeGroup(container, taxId) {
  let found = null;
  container.selectAll("g.node").each((d, i, nodes) => {
    if (d && d.data && String(d.data.id) === String(taxId)) {
      found = d3.select(nodes[i]);
    }
  });
  return found;
}

/**
 * Get the text content of the .label-leaves element inside a .node <g> whose
 * data key (d.data.id) matches `taxId`.
 */
function labelLeavesText(container, taxId) {
  const node = findNodeGroup(container, taxId);
  if (!node) return null;
  const el = node.select(".label-leaves").node();
  return el ? el.textContent : null;
}

/**
 * Return true if a .node <g> with the given taxId key is rendered in the DOM.
 */
function nodeGroupExists(container, taxId) {
  return findNodeGroup(container, taxId) !== null;
}

function makeTaxSvg() {
  // Attach a real SVG to the document so D3 can append to it.
  const container = d3
    .select(document.body)
    .append("div")
    .attr("id", "tax-test");
  const svg = container.append("svg");
  const tax = new GenomePropertiesTaxonomy({
    path: "/mock/taxonomy.json",
    width: 300,
    height: 600,
  });
  tax.draw_tree_panel(svg);
  return { tax, container };
}

describe("OPU mode smoke — label-leaves counts", () => {
  let tax;
  let container;

  beforeEach(() => {
    document.body.innerHTML = "";
    ({ tax, container } = makeTaxSvg());
    tax.load_taxonomy_obj(JSON.parse(JSON.stringify(MOCK_TAX)));
    // load_taxonomy_obj calls update_tree(500); drain synchronously
    // by calling update_tree(0) ourselves after setup.
  });

  it("shows full taxonomy leaf count in normal mode", () => {
    // Bacteria (taxid "2") has number_of_leaves=2 in the fixture.
    // In normal mode prune_inner_nodes does NOT collapse Bacteria (it has 2 children),
    // so it should render as a visible internal node with label-leaves = "2".
    tax.update_tree(0);
    const bacteriaLabel = labelLeavesText(container, "2");
    expect(bacteriaLabel).toBe("2");
  });

  describe("after entering OPU mode (filter_to_taxids=true)", () => {
    const OPU_A = "OPU_Alpha";
    const OPU_B = "OPU_Beta";

    beforeEach(() => {
      // Register 2 OPU organisms and place both under Bacteria (taxid "2").
      tax.register_opu_node(OPU_A);
      tax.register_opu_node(OPU_B);
      tax.place_opu_organism(OPU_A, "2");
      tax.place_opu_organism(OPU_B, "2");
      tax.filter_to_taxids(true);
      tax.update_tree(0);
    });

    it("root label-leaves shows the total OPU count (2)", () => {
      expect(labelLeavesText(container, "root")).toBe("2");
    });

    it("Bacteria label-leaves shows its OPU count (2)", () => {
      expect(labelLeavesText(container, "2")).toBe("2");
    });

    it("Archaea is pruned out and not rendered", () => {
      // Archaea has no OPU taxa — it should not appear in the DOM.
      expect(nodeGroupExists(container, "4")).toBe(false);
    });

    it("OPU leaf nodes are rendered as unloaded circles", () => {
      // Both OPU leaves should exist in the DOM (path via Bacteria is visible).
      expect(nodeGroupExists(container, OPU_A)).toBe(true);
      expect(nodeGroupExists(container, OPU_B)).toBe(true);
    });

    describe("after loading one OPU organism", () => {
      beforeEach(() => {
        // Simulate enabling OPU_A (sets loaded=true on the node).
        tax.set_organisms_loaded(OPU_A, true);
        tax.update_tree(0);
      });

      it("root label-leaves still shows 2 (total OPU taxa, not just selected)", () => {
        expect(labelLeavesText(container, "root")).toBe("2");
      });

      it("Bacteria label-leaves still shows 2", () => {
        expect(labelLeavesText(container, "2")).toBe("2");
      });
    });

    describe("after exiting OPU mode (filter_to_taxids=false)", () => {
      beforeEach(() => {
        tax.remove_opu_organisms();
        tax.filter_to_taxids(false);
        tax.update_tree(0);
      });

      it("root label-leaves reverts to full taxonomy count", () => {
        // Root has number_of_leaves=3 in the fixture (3 real leaf species).
        expect(labelLeavesText(container, "root")).toBe("3");
      });
    });
  });
});
