#!/usr/bin/env python3
"""
create-erz-steps.py

Reads a directory of *.micro SQLite databases (one per ERZ sample, produced by
genome-properties-calc or a compatible Nextflow pipeline) and outputs
ERZ_STEPS.json — a mapping of passing step numbers per ERZ sample per property.

Usage:
  python3 scripts/create-erz-steps.py [microDir] [outputPath]

Defaults:
  microDir   = test-files/ERZ
  outputPath = test-files/ERZ/ERZ_STEPS.json

Output format:
  {
    "ERZ12345": {
      "GenProp0017": [1, 2, 3, 5],     <-- step numbers that PASSED
      "GenProp0029": [9]
    },
    ...
  }

Only steps present in step_assignments are considered passed (= 1).
Steps absent from that table for a given property are considered failed (= 0).
This output is consumed by create-erz-merged.js to fill in real step values.

Database tables used:
  property_assignments
    - property_number       INTEGER  -- the XXXX in GenPropXXXX
    - numeric_assignment    INTEGER  -- 0=YES, 1=PARTIAL, 2=NO
    - sample_name           VARCHAR

  step_assignments
    - property_assignment_identifier  INTEGER  -- FK to property_assignments
    - number                          INTEGER  -- step number that PASSED

Only rows in step_assignments represent passing steps; absence = failed.
"""

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

micro_dir = sys.argv[1] if len(sys.argv) > 1 else "test-files/ERZ"
output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(micro_dir, "ERZ_STEPS.json")

micro_files = sorted(f for f in os.listdir(micro_dir) if f.endswith(".micro"))

if not micro_files:
    print(f"No *.micro files found in: {micro_dir}", file=sys.stderr)
    sys.exit(1)

result = {}

for micro_file in micro_files:
    erz_code = micro_file[:-len(".micro")]
    db_path = os.path.join(micro_dir, micro_file)

    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute(QUERY)
    rows = cur.fetchall()
    con.close()

    props = {}
    for property_number, passing_steps_str in rows:
        gp_id = f"GenProp{property_number:04d}"
        props[gp_id] = [int(n) for n in passing_steps_str.split(",")] if passing_steps_str else []

    result[erz_code] = props
    print(f"  {erz_code}: {len(props)} properties, "
          f"{sum(len(v) for v in props.values())} passing steps")

with open(output_path, "w", encoding="utf-8") as fh:
    json.dump(result, fh)

print(f"\nWritten {len(result)} ERZ samples → {output_path}")
