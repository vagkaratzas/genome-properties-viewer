# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (Rollup → bin/d3.custom.min.js)
npm run build

# Watch + live-reload dev server (browser-sync on port 3000)
npm run serve

# Lint (ESLint with airbnb-base + prettier config)
npm run test:lint

# Format source files
npm run prettier

# Regenerate reference.md from JSDoc
npm run jsdoc

# Regenerate taxonomy.json from the database
npm run create-taxonomy-file
```

There are no unit tests. Linting is the only automated quality check, enforced via Husky pre-commit and pre-push hooks.

## Architecture

This is a D3.js-based heatmap viewer bundled with Rollup. The entry point is `index.js`, which re-exports `GenomePropertiesViewer`, `d3`, and `uploadLocalGPFile`. Rollup produces `bin/d3.custom.min.js` as an IIFE with the global name `gpv`.

**`src/d3.js`** is a hand-curated re-export of only the required d3 sub-packages (d3-selection, d3-hierarchy, d3-scale, etc.) plus a compatibility shim: `d3.entries()` (since d3 v6 dropped it) and a custom `schemeCategory20b` color array.

### Core classes and their responsibilities

| File | Class/Exports | Role |
|---|---|---|
| `src/gp-viewer.js` | `GenomePropertiesViewer` | Root component. Owns `viewer.data`, `viewer.organisms`, layout, scroll state, and wires all sub-components together. |
| `src/gp-taxonomy.js` | `GenomePropertiesTaxonomy` | Renders the collapsible taxonomy tree (left panel) using `d3.hierarchy`. Manages `organisms` list and ordering. |
| `src/gp-hierarchy.js` | `GenomePropertiesHierarchy` | Manages the GP category hierarchy for filter toggles. Colors each top-level GP category via `d3.scaleOrdinal`. |
| `src/gp-controller.js` | `GenomePropertiesController` | Binds HTML UI controls (search, labels, legend filters) to viewer methods. Draws the tooltip and legend. |
| `src/gp-tax-node.js` | `TaxonomyNodeManager` | Draws individual tree nodes and handles click interactions within the taxonomy tree. |
| `src/gp-uploader.js` | `FileGetter`, various exports | Handles all data loading: JSON preload, TSV/GP file parsing, InterProScan file upload via server POST, and progress modal. |

### Utility modules (functions, not classes)

- **`gp-filters.js`** — `filterByLegend`, `filterByHierarchy`, `filterByText`: filter `viewer.props` in place.
- **`gp-scroller.js`** — `transformByScroll` is the de-facto **full render refresh** (called by `viewer.refresh()`). Also draws/updates the horizontal scrollbar.
- **`gp-ui-utils.js`** — Gradient masks (fade effect at heatmap edges) and the draggable tree-width divider.
- **`gp-totals.js`** — The per-organism pie-chart totals row at the top of the heatmap.
- **`gp-steps.js`** — Expand/collapse individual GP step columns within a property.
- **`zoomer.js`** — SVG zoom panel (slider + +/− buttons) to control `cell_side`.
- **`gp-taxonomy-sorter.js`** — The sort-mode button above the tree.
- **`modal.js`** — Generic modal/overlay dialog used for loading progress and file upload.

### Data model

`viewer.data` is a flat map of `gpId → GP object`:
```js
{
  property: "GenProp0001",
  name: "...",
  values: {
    "1234": "YES" | "NO" | "PARTIAL",   // keyed by taxId
    TOTAL: { YES: N, NO: N, PARTIAL: N }
  },
  steps: [{ step: 1, values: { taxId: true|false } }],
  parent_top_properties: ["GenProp0XXX", ...],
  isShowingSteps: false
}
```

`viewer.organisms` is the ordered list of currently visible taxIds. Both are populated by `gp-uploader.js`.

### Rendering cycle

- `viewer.update_viewer()` — full update: runs all filters, recomputes layout, enters/exits D3 columns and rows.
- `viewer.refresh()` → `transformByScroll(viewer)` — lightweight scroll/zoom repaint without re-running filters.

Inter-component communication uses `d3.dispatch` (not DOM events). Each class exposes `.on(typename, callback)` for event subscription.

### Loading sequence

1. `FileGetter.getJSON(hierarchy_path)` → `gp_hierarchy.load_hierarchy_from_data()`
2. Then `FileGetter.getJSON(model_species_path)` → `preloadSpecies(viewer, data)` (sets `viewer.data`)
3. In parallel: `FileGetter.getJSON(server_tax)` → `gp_taxonomy.load_taxonomy_obj()`
4. Species are activated on tree-node click via `enableSpeciesFromPreLoaded()`.

Test data files are in `test-files/`. `JSON_MERGED` is the preloaded species dataset; `SUMMARY_FILE_*` are per-organism TSV files; `hierarchy.json` defines the GP category tree.

### ESLint rules of note

- `camelcase` is off (snake_case is used throughout).
- `no-param-reassign` is off (viewer object is mutated directly by all utility functions).
- `for...in` (`ForInStatement`) is forbidden — use `Object.keys/values/entries`.
- `no-restricted-syntax` allows `for...of` but not `for...in`.
