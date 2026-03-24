#!/usr/bin/env node
"use strict";

/**
 * create-opu-merged.js
 *
 * Generates OPU_MERGED.json — a JSON_MERGED-equivalent file for
 * (ERZ study, predicted taxon) pairs derived from OPU assignments.
 *
 * Usage:
 *   node scripts/create-opu-merged.js [opuDir] [jsonMergedPath] [pairsPath] [stepsPath] [outputPath]
 *
 * Defaults:
 *   opuDir        = test-files/OPU
 *   jsonMergedPath = test-files/JSON_MERGED
 *   pairsPath     = test-files/OPU/opu_selected_pairs.tsv
 *   stepsPath     = test-files/OPU/OPU_STEPS.json   (optional — used if present)
 *   outputPath    = test-files/OPU/OPU_MERGED.json
 *
 * CSV file naming convention (produced by the GP pipeline after split-ips-by-taxon.py):
 *   {erz_code}_{sanitized_taxon}_FASTA_gp.csv
 *
 * Output organism keys use the original (unsanitized) taxon name joined with '::':
 *   "ERZ841404::Polaribacter"
 *
 * Output format mirrors ERZ_MERGED.json / JSON_MERGED:
 *   {
 *     "GenPropXXXX": {
 *       property: "GenPropXXXX",
 *       name: "...",
 *       values: {
 *         "ERZ841404::Polaribacter": "YES"|"NO"|"PARTIAL",
 *         TOTAL: { YES: N, NO: N, PARTIAL: N }
 *       },
 *       steps: [{ step, step_name, required, values: { "ERZ841404::Polaribacter": 0|1 } }]
 *     }
 *   }
 *
 * Step names and required flags come from JSON_MERGED (authoritative schema).
 * Step pass/fail is taken from OPU_STEPS.json when available; falls back to
 * property-level inference (YES → all steps 1, else → all steps 0).
 */

const fs = require("fs");
const path = require("path");

const opuDir = process.argv[2] || "test-files/OPU";
const mergedPath = process.argv[3] || "test-files/JSON_MERGED";
const pairsPath = process.argv[4] || path.join(opuDir, "opu_selected_pairs.tsv");
const stepsPath = process.argv[5] || path.join(opuDir, "OPU_STEPS.json");
const outputPath = process.argv[6] || path.join(opuDir, "OPU_MERGED.json");

// --- Load schema from JSON_MERGED ---
if (!fs.existsSync(mergedPath)) {
  console.error(`JSON_MERGED not found at: ${mergedPath}`);
  process.exit(1);
}
const schema = JSON.parse(fs.readFileSync(mergedPath, "utf8"));

// --- Load opu_selected_pairs.tsv to map sanitized stem → organism key ---
if (!fs.existsSync(pairsPath)) {
  console.error(`opu_selected_pairs.tsv not found at: ${pairsPath}`);
  console.error("Run analyze-opu-data.py first.");
  process.exit(1);
}

// stemToKey: "ERZ841404_Polaribacter" → "ERZ841404::Polaribacter"
const stemToKey = {};
const pairsText = fs.readFileSync(pairsPath, "utf8");
const pairsLines = pairsText.trim().split("\n");
const pairsHeader = pairsLines[0].split("\t");
const colIdx = (name) => pairsHeader.indexOf(name);
const erzIdx = colIdx("erz_code");
const taxonIdx = colIdx("taxon");
const sanIdx = colIdx("sanitized_taxon");

if (erzIdx === -1 || taxonIdx === -1 || sanIdx === -1) {
  console.error("opu_selected_pairs.tsv is missing expected columns (erz_code, taxon, sanitized_taxon)");
  process.exit(1);
}

for (let i = 1; i < pairsLines.length; i++) {
  const cols = pairsLines[i].split("\t");
  if (cols.length < 3) continue;
  const erz = cols[erzIdx].trim();
  const taxon = cols[taxonIdx].trim();
  const san = cols[sanIdx].trim();
  const stem = `${erz}_${san}`;
  stemToKey[stem] = `${erz}::${taxon}`;
}

console.log(`Loaded ${Object.keys(stemToKey).length} pair mappings from: ${pairsPath}`);

// --- Load step data from OPU_STEPS.json (optional) ---
let stepsData = null;
if (fs.existsSync(stepsPath)) {
  stepsData = JSON.parse(fs.readFileSync(stepsPath, "utf8"));
  console.log(`Loaded step data from: ${stepsPath}`);
} else {
  console.warn(
    `No OPU_STEPS.json found at ${stepsPath} — falling back to property-level step assignment.`
  );
}

// --- Discover OPU CSV files (*_{sanitized_taxon}_FASTA_gp.csv) ---
const csvFiles = fs
  .readdirSync(opuDir)
  .filter((f) => f.endsWith("_FASTA_gp.csv"))
  .sort();

if (csvFiles.length === 0) {
  console.error(`No *_FASTA_gp.csv files found in: ${opuDir}`);
  process.exit(1);
}

// Map each CSV file to its organism key via stemToKey
const csvToOrganism = {};
for (const f of csvFiles) {
  const stem = f.replace("_FASTA_gp.csv", "");
  if (stem in stemToKey) {
    csvToOrganism[f] = stemToKey[stem];
  } else {
    console.warn(`  WARNING: ${f} has no matching pair in opu_selected_pairs.tsv — skipping`);
  }
}

const organismsFound = Object.values(csvToOrganism);
console.log(`Found CSV files for ${organismsFound.length} organisms:`);
organismsFound.forEach((k) => console.log(`  ${k}`));

// --- Parse a quoted CSV line: "a","b","c"  →  ["a","b","c"] ---
function parseCSVLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.slice(1, -1).split('","');
  return parts.length === 3 && ["YES", "NO", "PARTIAL"].includes(parts[2])
    ? parts
    : null;
}

// --- Build step template from schema entry ---
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
  // Fallback: infer steps from non-zero digits in GP number (same as create-erz-merged.js)
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
  const organismKey = csvToOrganism[csvFile];
  if (!organismKey) continue;

  const text = fs.readFileSync(path.join(opuDir, csvFile), "utf8");

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

    result[gpId].values[organismKey] = value;
    result[gpId].values.TOTAL[value]++;

    // Resolve step values: use OPU_STEPS.json when available
    const passingSteps =
      stepsData && stepsData[organismKey] && stepsData[organismKey][gpId];
    const fallbackPassed = value === "YES" ? 1 : 0;

    result[gpId].steps.forEach((step) => {
      if (passingSteps) {
        step.values[organismKey] = passingSteps.includes(Number(step.step)) ? 1 : 0;
      } else {
        step.values[organismKey] = fallbackPassed;
      }
    });
  }
}

// --- Write output ---
fs.writeFileSync(outputPath, JSON.stringify(result));
console.log(
  `\nWritten ${Object.keys(result).length} properties → ${outputPath}`
);
