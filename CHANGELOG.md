# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Performance

- `gp-uploader.js`: Replaced O(n) byte-by-byte string concatenation loop with `TextDecoder.decode()` when converting the fetched `ArrayBuffer` to text. This is significantly faster for large JSON/TSV files and correctly handles multi-byte UTF-8 characters (the old loop was effectively Latin-1).
- `gp-viewer.js` / `gp-scroller.js`: Filter pipeline (`filterByHierarchy`, `filterByText`, `filterByLegend`, `sort_props`, `refreshGPTotals`) no longer re-runs on every scroll or zoom event. `update_viewer()` accepts a `skip_filter` flag; `transformByScroll` passes `true` so scroll/zoom repaints reuse the cached filtered prop list rather than rebuilding it from scratch every frame.

### Changed

- Renamed misspelled identifiers throughout the source (no behaviour change):
  - `dipatcher` → `dispatcher` (property on `GenomePropertiesTaxonomy`, `GenomePropertiesHierarchy`, `GenomePropertiesController`, and callers in `gp-tax-node.js`, `gp-ui-utils.js`)
  - `spaciesRequested` → `speciesRequested` (dispatch event name in `gp-taxonomy.js`, `gp-tax-node.js`, `gp-viewer.js`)
  - `siwtchChanged` → `switchChanged` (dispatch event name in `gp-hierarchy.js`, `gp-controller.js`, `gp-viewer.js`)
  - `hierarchy_contorller` → `hierarchy_controller` (constructor parameter and property in `gp-controller.js`, `gp-viewer.js`)
  - `circunferencia` → `circumference` (local variable in `gp-uploader.js`)

### Fixed

- `gp-viewer.js`: Whitelist file was never parsed — `response.json` (property reference) corrected to `response.json()` (method call).
- `gp-taxonomy.js`: Same `response.json` → `response.json()` fix in the unused `load_taxonomy()` method.
- `gp-hierarchy.js`: Same `response.json` → `response.json()` fix in the unused `load_hierarchy_from_path()` method.
- `gp-uploader.js`: On a malformed TSV upload, the organism was removed from `viewer.organisms` via `delete` (which creates a sparse array hole) instead of `splice`, leaving a stale `undefined` entry in the list.
- `gp-uploader.js`: `setInterval` gauge rotator divided by `activeGauges.length` when the array was empty, producing a `NaN` index that persisted for the lifetime of the `FileGetter` instance.
- `gp-controller.js`: Hierarchy category dot colours were toggled using the *clicked item's* `enable` state (`d.enable`) rather than each item's own state (`item.enable`), causing all dots to turn grey or all to turn coloured on every click, and breaking the "All" / "None" buttons entirely.

## [1.0.0-beta.1] - 2021-03-17

- Initial beta release.
