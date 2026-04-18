const { test, expect } = require("@playwright/test");

// ── helpers ───────────────────────────────────────────────────────────────────

/** Wait until the taxonomy tree has rendered at least one node. */
async function waitForTree(page) {
  await page.waitForSelector(".taxon_tree .node", { timeout: 15000 });
}

/** Wait until the preloaded species data (JSON_MERGED) has been parsed.
 *  The taxonomy tree can appear before this fetch completes. */
async function waitForData(page) {
  await page.waitForFunction(
    () => Object.keys(window.__viewer.data).length > 0,
    { timeout: 15000 }
  );
}

/** Load the first species leaf found in the taxonomy by dispatching the same
 *  'speciesRequested' event that a real leaf-node click produces.
 *
 *  The test tree is 9 levels deep, so clicking through the UI to reach an
 *  actual species leaf would require navigating ~9 branch-expansion clicks —
 *  impractical for a smoke test. Dispatching the event directly keeps the test
 *  focused on the viewer's response to species activation, not on tree
 *  navigation, which is covered by the "click expands branch" test. */
async function loadFirstSpecies(page) {
  await waitForData(page);
  await page.evaluate(() => {
    const nodes = window.__viewer.gp_taxonomy.nodes;
    const leaf = Object.values(nodes).find(
      (n) => n.taxid !== "root" && (!n.children || n.children.length === 0)
    );
    if (leaf) {
      window.__viewer.gp_taxonomy.dispatcher.call(
        "speciesRequested",
        window.__viewer.gp_taxonomy,
        leaf.taxid
      );
    }
  });
  // SVG <g> elements are in the DOM tree but may not be "visible" in the CSS
  // sense, so use state:'attached' rather than the default visibility check.
  await page.waitForSelector(".column", { state: "attached", timeout: 10000 });
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe("Genome Properties Viewer smoke tests", () => {
  let jsErrors;

  test.beforeEach(async ({ page }) => {
    jsErrors = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await page.goto("/");
  });

  // ── 1. Page loads ──────────────────────────────────────────────────────────
  test("page loads without JavaScript errors", async ({ page }) => {
    await page.waitForSelector("svg.gp-viewer");
    await page.waitForTimeout(500);
    expect(jsErrors).toHaveLength(0);
  });

  // ── 2. Taxonomy tree renders ───────────────────────────────────────────────
  test("taxonomy tree renders nodes after JSON loads", async ({ page }) => {
    await waitForTree(page);
    const nodeCount = await page.locator(".taxon_tree .node").count();
    expect(nodeCount).toBeGreaterThan(0);
    expect(jsErrors).toHaveLength(0);
  });

  // ── 3. Clicking a tree node expands its children ──────────────────────────
  test("clicking a tree node expands its children", async ({ page }) => {
    await waitForTree(page);
    const before = await page.locator(".taxon_tree .node").count();

    // The first node is the root (no parent), which the click handler skips.
    // Click the second node (first child of root) to trigger expansion.
    await page.locator(".taxon_tree .node").nth(1).click();

    // The tree re-renders after a 100 ms setTimeout + 500 ms transition.
    // New <g class="node"> elements are inserted synchronously on render,
    // so we just wait for the count to increase.
    await page.waitForFunction(
      (n) => document.querySelectorAll(".taxon_tree .node").length > n,
      before,
      { timeout: 3000 }
    );
    expect(jsErrors).toHaveLength(0);
  });

  // ── 4. Species loads into the heatmap ─────────────────────────────────────
  test("activating a species creates GP columns in the heatmap", async ({
    page,
  }) => {
    await loadFirstSpecies(page);
    const colCount = await page.locator(".column").count();
    expect(colCount).toBeGreaterThan(0);
    expect(jsErrors).toHaveLength(0);
  });

  // ── 5. Loaded taxonomy node gets .loaded class ────────────────────────────
  test("activated taxonomy node is marked as loaded", async ({ page }) => {
    await waitForTree(page);
    await loadFirstSpecies(page);
    // After loading, the node manager marks the leaf with .loaded
    const loadedCount = await page
      .locator(".taxon_tree .node.loaded")
      .count();
    expect(loadedCount).toBeGreaterThan(0);
    expect(jsErrors).toHaveLength(0);
  });

  // ── 6. Zoom in increases cell_side ────────────────────────────────────────
  test("clicking the zoom-in (+) button increases cell size", async ({
    page,
  }) => {
    await loadFirstSpecies(page);

    const before = await page.evaluate(
      () => window.__viewer.options.cell_side
    );
    await page.locator(".gpv-zoomer circle").first().click();
    const after = await page.evaluate(
      () => window.__viewer.options.cell_side
    );

    expect(after).toBeGreaterThan(before);
    expect(jsErrors).toHaveLength(0);
  });

  // ── 7. Zoom out decreases cell_side ───────────────────────────────────────
  test("clicking the zoom-out (-) button decreases cell size", async ({
    page,
  }) => {
    await loadFirstSpecies(page);

    // Default cell_side is 20 (the minimum). Zoom in first so zoom-out has room.
    await page.locator(".gpv-zoomer circle").first().click();
    const before = await page.evaluate(
      () => window.__viewer.options.cell_side
    );
    await page.locator(".gpv-zoomer circle").last().click();
    const after = await page.evaluate(
      () => window.__viewer.options.cell_side
    );

    expect(after).toBeLessThan(before);
    expect(jsErrors).toHaveLength(0);
  });

  // ── 8. Step expand toggler shows step columns ─────────────────────────────
  test("clicking a step-toggler expands step columns", async ({ page }) => {
    await loadFirstSpecies(page);
    await page.waitForSelector(".step-toggler", {
      state: "attached",
      timeout: 5000,
    });

    await page.locator(".step-toggler").first().click();

    await page.waitForSelector(".step", { state: "attached", timeout: 5000 });
    const stepCount = await page.locator(".step").count();
    expect(stepCount).toBeGreaterThan(0);
    expect(jsErrors).toHaveLength(0);
  });
});
