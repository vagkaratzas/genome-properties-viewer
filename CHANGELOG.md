# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed

- `gp-viewer.js`: Whitelist file was never parsed — `response.json` (property reference) corrected to `response.json()` (method call).
- `gp-taxonomy.js`: Same `response.json` → `response.json()` fix in the unused `load_taxonomy()` method.
- `gp-uploader.js`: On a malformed TSV upload, the organism was removed from `viewer.organisms` via `delete` (which creates a sparse array hole) instead of `splice`, leaving a stale `undefined` entry in the list.
- `gp-uploader.js`: `setInterval` gauge rotator divided by `activeGauges.length` when the array was empty, producing a `NaN` index that persisted for the lifetime of the `FileGetter` instance.
- `gp-controller.js`: Hierarchy category dot colours were toggled using the *clicked item's* `enable` state (`d.enable`) rather than each item's own state (`item.enable`), causing all dots to turn grey or all to turn coloured on every click, and breaking the "All" / "None" buttons entirely.

## [1.0.0-beta.1] - 2021-03-17

- Initial beta release.
