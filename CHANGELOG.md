# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- **ERZ step-level data pipeline**: new script `scripts/create-erz-steps.py` reads `*.micro` SQLite databases (one per ERZ sample, produced by genome-properties-calc) and outputs `ERZ_STEPS.json` — a map of passing step numbers per ERZ sample per property (`{ erzCode: { GenPropXXXX: [stepNums] } }`). DB encoding: `numeric_assignment` 0=YES, 1=PARTIAL, 2=NO; only rows present in `step_assignments` represent passing steps. Run via `npm run create-erz-steps`.
- **`create-erz-merged.js`** extended to consume `ERZ_STEPS.json`: when the file is present, individual step pass/fail is set from the real step numbers rather than derived from the property-level result. Falls back to the previous behaviour (YES→1, else→0) when no step file is found. New optional CLI args: `[stepsPath]` (4th) and `[outputPath]` (5th, previously 4th).
- **Browser smoke tests** (Playwright): 8 end-to-end tests in `tests/smoke.spec.js` covering page load, taxonomy tree rendering and expansion, species activation, zoom in/out, and step-column expansion. A minimal static file server (`tests/serve.js`) and a test harness page (`tests/index.html`) serve the built bundle and test-data fixtures. Run with `npm run test:e2e`.
  - `playwright.config.js`: Playwright configuration (single Chromium project, headless, local webServer on port 4321).
  - `playwright-report/` and `test-results/` added to `.gitignore`.
- **Unit tests** (Vitest): 123 tests across 8 test files covering pure-logic modules (node environment) and DOM-dependent modules (jsdom environment).
  - Phase 1 — node environment: `src/d3.test.js`, `src/gp-filters.test.js`, `src/gp-hierarchy.test.js`, `src/gp-uploader.test.js`
  - Phase 2 — jsdom environment: `src/modal.test.js`, `src/gp-totals.test.js`, `src/gp-scroller.test.js`, `src/gp-taxonomy.test.js`
  - `npm test` — run all tests once
  - `npm run test:watch` — watch mode
  - `npm run test:coverage` — generate a coverage report under `coverage/`
- `vitest.config.js`: Vitest configuration (node environment default, v8 coverage provider). jsdom tests opt in per-file via `// @vitest-environment jsdom`.
- `jsdom` added as a dev dependency (Vitest peer for the jsdom environment).
- `coverage/` added to `.gitignore`.
- `README.md`: new *Development → Testing* section documenting how to run tests and linting.

### Security / Dependencies

- **Dropped IE 11 support** and removed the entire Babel transpilation stack (`@babel/cli`, `@babel/core`, `@babel/preset-env`, `rollup-plugin-babel`, `src/.babelrc`). IE 11 was retired in June 2022; keeping the stack served no purpose and introduced multiple critical and high-severity vulnerabilities (`@babel/traverse`, `@babel/helpers`, `@babel/runtime`, `@nicolo-ribaudo/chokidar-2`). The bundle now ships native ES2020+.
- Removed `regenerator-runtime` (production dependency) and `regenerator` (dev dependency) — these were polyfills for the now-removed Babel transpilation.
- Removed `js-autocomplete-tremby` (production dependency) — was never imported in any source file.
- Replaced deprecated `rollup-plugin-node-resolve` (v5, unmaintained) with the official `@rollup/plugin-node-resolve` (v16). Renamed `rollup.config.js` → `rollup.config.mjs` to make its ES module syntax explicit.
- Updated all **D3 sub-packages** from v2 to v3 (equivalent to D3 v7), resolving the `d3-color` ReDoS vulnerability: `d3-array`, `d3-dispatch`, `d3-drag`, `d3-dsv`, `d3-hierarchy`, `d3-scale`, `d3-scale-chromatic`, `d3-selection`, `d3-shape`, `d3-timer`, `d3-transition`.
- Updated **build / dev toolchain**: `rollup` 2→4, `eslint` 7→10, `eslint-config-airbnb-base` 14→15, `eslint-config-prettier` 8→10, `eslint-plugin-import` 2.22→2.32, `husky` 5→9, `prettier` 2→3, `browser-sync` 2→3, `jsdoc-to-markdown` 7→9.
- **Migrated ESLint to flat config** (`eslint.config.mjs`). ESLint v9/10 uses a new config format that is incompatible with `.eslintrc.*` files. Migration used the official `@eslint/eslintrc` FlatCompat adapter to wrap `eslint-config-airbnb-base` (which has not yet released a native flat-config version), preserving all existing rules. Deleted `.eslintrc.js`. Added `@eslint/eslintrc` and `globals` as dev dependencies.
- Updated husky hook scripts to v9 format (removed the `_/husky.sh` helper sourcing; hooks are now plain shell scripts). Updated `prepare` script from `husky install` to `husky`.
- **Remaining 3 vulnerabilities** (high): all in `browser-sync`'s `immutable` transitive dependency. The suggested fix (`npm audit fix --force`) would downgrade browser-sync to v1.9.2, which reintroduces far worse issues. These are accepted as browser-sync is a local-only dev server, never deployed.

### Removed

- `gp-uploader.js`: `FileGetter` was importing `select` from d3 to set `this.base`, which was never read after construction. Removed `this.base`, the `select` import, and the now-unused `element` constructor parameter.
- `gp-viewer.js`: `this.gp_values` array was assigned but never referenced anywhere. Removed.
- `gp-steps.js`: Redundant direct `import { symbol, symbolCross } from "d3-shape"` removed; these are already re-exported through `src/d3.js` and the file already imports `* as d3`. Replaced the two bare calls with `d3.symbol()` / `d3.symbolCross`.
- `src/d3.js`: Removed five unused re-exports — `stack` (d3-shape), `stratify` and `cluster` (d3-hierarchy), `zoom` (d3-zoom), `interpolate` (d3-interpolate). None were referenced in any source file.
- `package.json`: Removed explicit `d3-zoom` and `d3-interpolate` dependencies, which were only ever used for the now-removed re-exports.

### Performance

- `gp-uploader.js`: Replaced O(n) byte-by-byte string concatenation loop with `TextDecoder.decode()` when converting the fetched `ArrayBuffer` to text. This is significantly faster for large JSON/TSV files and correctly handles multi-byte UTF-8 characters (the old loop was effectively Latin-1).
- `gp-viewer.js` / `gp-scroller.js`: Filter pipeline (`filterByHierarchy`, `filterByText`, `filterByLegend`, `sort_props`, `refreshGPTotals`) no longer re-runs on every scroll or zoom event. `update_viewer()` accepts a `skip_filter` flag; `transformByScroll` passes `true` so scroll/zoom repaints reuse the cached filtered prop list rather than rebuilding it from scratch every frame.

### Changed

- `src/taxonomy/taxonomy_retriever.js` moved to `scripts/retrieve_taxonomy.js` to consolidate all standalone Node.js data scripts in one place. The config path inside the script is now resolved via `__dirname` (was a hardcoded `./src/taxonomy/config.json`), making it work regardless of the working directory from which `npm run create-taxonomy-file` is invoked.
- `.gitignore`: updated ignored credentials path from `/src/taxonomy/config.json` to `scripts/config.json`.
- `.eslintrc.js`: removed the now-redundant explicit `taxonomy_retriever.js` ignore entry — `scripts/*` already covers it.
- Renamed misspelled identifiers throughout the source (no behaviour change):
  - `dipatcher` → `dispatcher` (property on `GenomePropertiesTaxonomy`, `GenomePropertiesHierarchy`, `GenomePropertiesController`, and callers in `gp-tax-node.js`, `gp-ui-utils.js`)
  - `spaciesRequested` → `speciesRequested` (dispatch event name)
  - `multipleSpaciesRequested` → `multipleSpeciesRequested` (dispatch event name)
  - `removeSpacies` → `removeSpecies` (dispatch event name)
  - `siwtchChanged` → `switchChanged` (dispatch event name)
  - `hierarchy_contorller` → `hierarchy_controller` (constructor parameter and property)
  - `circunferencia` → `circumference` (local variable in `gp-uploader.js`)
  - `text_heigth` → `text_height` (local variable in `gp-viewer.js`)
- `GenomePropertiesViewer` constructor refactored: the ~260-line constructor body is now split into four focused private methods — `_createSVG()`, `_initTaxonomy()`, `_initHierarchy()`, `_initControls()`, and `_drawLayout()` — leaving the constructor itself responsible only for state initialisation and option parsing. All controller-related options (`controller_element_selector`, `legends_element_selector`, etc.) that were previously only available as local constructor variables are now stored in `this.options`.
- Removed dead commented-out code across `gp-viewer.js`, `gp-taxonomy.js`, `gp-taxonomy-sorter.js`, `gp-totals.js`, `gp-scroller.js`, `gp-uploader.js`, `gp-tax-node.js`, and `gp-controller.js`.
- Removed the remaining vestigial `import "regenerator-runtime/runtime"` from `gp-uploader.js` (the last stale polyfill import after the Babel removal).
- `gp-viewer.js`: `d3.select("text")` (which selected an arbitrary `<text>` element in the whole document) replaced with `this.svg.select("text")` scoped to the viewer's own SVG, with a safe `null` fallback.

### Fixed

- `zoomer.js`: Zoom +/- button labels (`<text>` SVG elements) were intercepting pointer events, preventing clicks from reaching the underlying `<circle>` that held the click handler. Fixed by adding `pointer-events: none` to the text elements.
- `gp-hierarchy.js`, `gp-taxonomy.js`: Removed redundant `return this` at the end of each constructor (constructors always return `this` implicitly; the explicit return was flagged by the updated `no-constructor-return` ESLint rule).
- `gp-viewer.js`: Whitelist file was never parsed — `response.json` (property reference) corrected to `response.json()` (method call).
- `gp-taxonomy.js`: Same `response.json` → `response.json()` fix in the unused `load_taxonomy()` method.
- `gp-hierarchy.js`: Same `response.json` → `response.json()` fix in the unused `load_hierarchy_from_path()` method.
- `gp-uploader.js`: On a malformed TSV upload, the organism was removed from `viewer.organisms` via `delete` (which creates a sparse array hole) instead of `splice`, leaving a stale `undefined` entry in the list.
- `gp-uploader.js`: `setInterval` gauge rotator divided by `activeGauges.length` when the array was empty, producing a `NaN` index that persisted for the lifetime of the `FileGetter` instance.
- `gp-controller.js`: Hierarchy category dot colours were toggled using the *clicked item's* `enable` state (`d.enable`) rather than each item's own state (`item.enable`), causing all dots to turn grey or all to turn coloured on every click, and breaking the "All" / "None" buttons entirely.

## [1.0.0-beta.1] - 2021-03-17

- Initial beta release.
