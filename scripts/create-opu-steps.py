#!/usr/bin/env python3
"""
create-opu-steps.py

Reads a directory of *.micro SQLite databases — one per selected taxon,
produced by the GP property-assignment pipeline run on per-taxon IPS files
(from extract-taxon-ips.py) — and outputs OPU_STEPS.json: a mapping of
passing step numbers per organism per property.

Usage:
  python3 scripts/create-opu-steps.py [microDir] [pairsFile] [outputPath]

Defaults:
  microDir   = test-files/OPU
  pairsFile  = test-files/OPU/opu_selected_pairs.tsv
  outputPath = test-files/OPU/OPU_STEPS.json

*.micro file naming convention (must match extract-taxon-ips.py output):
  {sanitized_taxon}.micro

The organism key in the output JSON is the original (unsanitized) taxon name:
  "Polaribacter"

Output format (identical schema to ERZ_STEPS.json):
  {
    "Polaribacter": {
      "GenProp0017": [1, 2, 3, 5],   <-- step numbers that PASSED
      "GenProp0029": [9]
    },
    ...
  }

This file is consumed by create-opu-merged.js to fill in real step values.

Database tables used (same as ERZ_STEPS.json):
  property_assignments
    - property_number       INTEGER
    - numeric_assignment    INTEGER
    - sample_name           VARCHAR

  step_assignments
    - property_assignment_identifier  INTEGER
    - number                          INTEGER  (step number that PASSED)
"""

import csv
import json
import os
import sqlite3
import sys

QUERY = """
    SELECT
        pa.property_number,
        GROUP_CONCAT(sa.number, ',') AS passing_steps
    FROM property_assignments pa
    LEFT JOIN step_assignments sa
        ON sa.property_assignment_identifier = pa.property_assignment_identifier
    GROUP BY pa.property_assignment_identifier
"""


def load_pairs(pairs_path):
    """
    Return dict: sanitized_taxon → taxon for each row in opu_selected_pairs.tsv.
    The .micro filename stem is '{sanitized_taxon}', and the organism key
    in the output JSON is the original (unsanitized) taxon name.
    """
    pairs = {}
    with open(pairs_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            pairs[row["sanitized_taxon"]] = row["taxon"]
    return pairs


micro_dir = sys.argv[1] if len(sys.argv) > 1 else "test-files/OPU"
pairs_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(micro_dir, "opu_selected_pairs.tsv")
output_path = sys.argv[3] if len(sys.argv) > 3 else os.path.join(micro_dir, "OPU_STEPS.json")

if not os.path.exists(pairs_path):
    print(f"Error: pairs file not found: {pairs_path}", file=sys.stderr)
    print("Run analyze-opu-data.py first to produce opu_selected_pairs.tsv.", file=sys.stderr)
    sys.exit(1)

stem_to_key = load_pairs(pairs_path)

micro_files = sorted(f for f in os.listdir(micro_dir) if f.endswith(".micro"))

if not micro_files:
    print(f"No *.micro files found in: {micro_dir}", file=sys.stderr)
    sys.exit(1)

result = {}

for micro_file in micro_files:
    stem = micro_file[: -len(".micro")]

    if stem not in stem_to_key:
        print(f"  Skipping {micro_file} (not in opu_selected_pairs.tsv)")
        continue

    organism_key = stem_to_key[stem]
    db_path = os.path.join(micro_dir, micro_file)

    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute(QUERY)
    rows = cur.fetchall()
    con.close()

    props = {}
    for property_number, passing_steps_str in rows:
        gp_id = f"GenProp{property_number:04d}"
        props[gp_id] = (
            [int(n) for n in passing_steps_str.split(",")]
            if passing_steps_str
            else []
        )

    result[organism_key] = props
    print(
        f"  {organism_key}: {len(props)} properties, "
        f"{sum(len(v) for v in props.values())} passing steps"
    )

with open(output_path, "w", encoding="utf-8") as fh:
    json.dump(result, fh)

print(f"\nWritten {len(result)} OPU organisms → {output_path}")
