#!/usr/bin/env node
"use strict";

/**
 * create-erz-merged.js
 *
 * Generates ERZ_MERGED.json — a JSON_MERGED-equivalent file for ERZ samples.
 *
 * Usage:
 *   node scripts/create-erz-merged.js [erzDir] [jsonMergedPath] [stepsPath] [outputPath]
 *
 * Defaults:
 *   erzDir        = test-files/ERZ
 *   jsonMergedPath = test-files/JSON_MERGED
 *   stepsPath     = test-files/ERZ/ERZ_STEPS.json  (optional — used if the file exists)
 *   outputPath    = test-files/ERZ/ERZ_MERGED.json
 *
 * Output format mirrors JSON_MERGED:
 *   { "GenPropXXXX": { property, name, values: { erzCode: "YES"|"NO"|"PARTIAL", TOTAL: {...} },
 *                       steps: [{ step, step_name, required, values: { erzCode: 0|1 } }] } }
 *
 * Step names and required flags come from JSON_MERGED (the authoritative schema).
 * Step pass/fail is taken from ERZ_STEPS.json when available (produced by
 * create-erz-steps.py from *.micro SQLite databases).  Without that file the
 * script falls back to deriving step values from the property-level result
 * (YES → 1, NO/PARTIAL → 0).
 */

const fs = require("fs");
const path = require("path");

const erzDir = process.argv[2] || "test-files/ERZ";
const mergedPath = process.argv[3] || "test-files/JSON_MERGED";
const stepsPath =
  process.argv[4] || path.join(erzDir, "ERZ_STEPS.json");
const outputPath =
  process.argv[5] || path.join(erzDir, "ERZ_MERGED.json");

// --- Load schema from JSON_MERGED ---
if (!fs.existsSync(mergedPath)) {
  console.error(`JSON_MERGED not found at: ${mergedPath}`);
  process.exit(1);
}
const schema = JSON.parse(fs.readFileSync(mergedPath, "utf8"));

// --- Load step data from ERZ_STEPS.json (optional) ---
let stepsData = null;
if (fs.existsSync(stepsPath)) {
  stepsData = JSON.parse(fs.readFileSync(stepsPath, "utf8"));
  console.log(`Loaded step data from: ${stepsPath}`);
} else {
  console.warn(
    `No ERZ_STEPS.json found at ${stepsPath} — falling back to property-level step assignment.`
  );
}

// --- Discover ERZ CSV files ---
const csvFiles = fs
  .readdirSync(erzDir)
  .filter((f) => f.endsWith("_FASTA_gp.csv"))
  .sort();

if (csvFiles.length === 0) {
  console.error(`No *_FASTA_gp.csv files found in: ${erzDir}`);
  process.exit(1);
}

const erzCodes = csvFiles.map((f) => f.replace("_FASTA_gp.csv", ""));
console.log(`Found ERZ samples: ${erzCodes.join(", ")}`);

// --- Parse a quoted CSV line: "a","b","c"  →  ["a","b","c"] ---
function parseCSVLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.slice(1, -1).split('","');
  return parts.length === 3 && ["YES", "NO", "PARTIAL"].includes(parts[2])
    ? parts
    : null;
}

// --- Build step template from schema entry, or fall back to digit-counting ---
function stepsFromSchema(gpId) {
  const entry = schema[gpId];
  if (entry && entry.steps && entry.steps.length > 0) {
    return entry.steps.map((s) => ({
      step: s.step,
      step_name: s.step_name || "",
      required: s.required,
      values: {},
    }));
  }
  // Fallback: infer step count from non-zero digits in the GP number
  return gpId
    .slice(7)
    .split("")
    .filter((x) => x !== "0")
    .map((_, j) => ({
      step: String(j + 1),
      step_name: "",
      required: 1,
      values: {},
    }));
}

// --- Accumulate data ---
const result = {};

for (const csvFile of csvFiles) {
  const erzCode = csvFile.replace("_FASTA_gp.csv", "");
  const text = fs.readFileSync(path.join(erzDir, csvFile), "utf8");

  for (const line of text.split("\n")) {
    const parsed = parseCSVLine(line);
    if (!parsed) continue;
    const [gpId, csvName, value] = parsed;

    if (!(gpId in result)) {
      const schemaEntry = schema[gpId];
      result[gpId] = {
        property: gpId,
        name: schemaEntry ? schemaEntry.name : csvName,
        values: { TOTAL: { YES: 0, NO: 0, PARTIAL: 0 } },
        steps: stepsFromSchema(gpId),
      };
    }

    result[gpId].values[erzCode] = value;
    result[gpId].values.TOTAL[value]++;

    // Resolve step values from ERZ_STEPS.json when available; fall back to
    // deriving all steps from the property-level result (YES → 1, else → 0).
    const passingSteps = stepsData && stepsData[erzCode] && stepsData[erzCode][gpId];
    const fallbackPassed = value === "YES" ? 1 : 0;

    result[gpId].steps.forEach((step) => {
      if (passingSteps) {
        step.values[erzCode] = passingSteps.includes(Number(step.step)) ? 1 : 0;
      } else {
        step.values[erzCode] = fallbackPassed;
      }
    });
  }
}

// --- Write output ---
fs.writeFileSync(outputPath, JSON.stringify(result));
console.log(
  `Written ${Object.keys(result).length} properties → ${outputPath}`
);
