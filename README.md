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
