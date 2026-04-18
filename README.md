# Genome Properties Viewer

A web viewer to display information of the Genome properties project.

The Viewer is a heatmap where the x axis represent the Genome Properies, and the y axis is the selected species.
The species can be selected from a taxonomy tree displayed in the left of the screen.

You can seee it in action in https://wwwdev.ebi.ac.uk/interpro/genomeproperties/viewer

## Development

### Testing

Unit tests (including DOM-dependent tests) are written with [Vitest](https://vitest.dev/) and live alongside the source files (`src/*.test.js`).

```bash
# Run all tests once
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run with a coverage report (output in coverage/)
npm run test:coverage
```

Browser integration (end-to-end) tests are written with [Playwright](https://playwright.dev/) and live in `tests/`.
They start a local static server automatically and run against a real Chromium browser.

```bash
# Run all smoke tests (requires a built bundle: npm run build)
npm run test:e2e

# Run with the Playwright UI explorer
npx playwright test --ui
```

Linting (ESLint) is the only check enforced by the pre-commit hook:

```bash
npm run test:lint
```

### Security

```bash
# Report known vulnerabilities in installed packages
npm audit

# Automatically apply safe (non-breaking) fixes
npm audit fix

# Check for outdated packages (Current / Wanted / Latest columns)
npm outdated
```

> **Note:** 3 high-severity advisories currently remain in `browser-sync`'s `immutable`
> transitive dependency. The suggested fix would downgrade browser-sync to v1.9.2 (far
> worse). They are accepted as browser-sync is a local-only dev server, never deployed.

### ERZ Data Pipeline

ERZ mode displays metagenome assembly results from ENA. Input files live in `test-files/ERZ/`.

**Input files** (one per ERZ sample):
- `{ERZ_CODE}_FASTA_gp.csv` — property-level results (YES / PARTIAL / NO)
- `{ERZ_CODE}.micro` — SQLite database with step-level data (optional, from genome-properties-calc)

**Build the merged JSON files:**

```bash
# 1. Extract per-step pass/fail from *.micro SQLite databases → ERZ_STEPS.json
#    Requires Python 3 (uses the built-in sqlite3 module — no extra dependencies)
npm run create-erz-steps

# 2. Build ERZ_MERGED.json consumed by the viewer
#    Uses ERZ_STEPS.json for real step data if present; falls back to property-level assignment
npm run create-erz-merged
```

Both commands accept optional path arguments if your files live elsewhere:

```bash
python3 scripts/create-erz-steps.py  [microDir]  [outputPath]
node    scripts/create-erz-merged.js [erzDir] [jsonMergedPath] [stepsPath] [outputPath]
```

> **Step data note:** Without a `.micro` file for a given ERZ sample, step values fall back to
> all-pass (1) for YES properties and all-fail (0) for PARTIAL/NO properties, since the CSV files
> contain only property-level results.

## API Reference

The code API reference is under construction and its current state is available in [reference.md](./reference.md)

#### Progress

| File                  | Status |
| --------------------- | ------ |
| gp-controller.js      | ⚠️     |
| gp-filters.js         | ✅     |
| gp-hierarchy.js       | ✅     |
| gp-scroller.js        | ✅     |
| gp-steps.js           | ⚠️     |
| gp-tax-node.js        | ⚠️     |
| gp-taxonomy-sorter.js | ⚠️     |
| gp-taxonomy.js        | ⚠️     |
| gp-totals.js          | ✅     |
| gp-ui-utils.js        | ✅     |
| gp-uploader.js        | ⚠️     |
| gp-viewer.js          | ⚠️     |
| modal.js              | ✅     |
| zoomer.js             | ✅     |
