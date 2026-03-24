#!/usr/bin/env python3
"""
extract-taxon-ips.py

For each selected taxon, collect all proteins belonging to that taxon (across
ALL ERZ studies) and write one merged IPS TSV per taxon.

Usage:
  python3 scripts/extract-taxon-ips.py <opu_tsv>
                                        [--selected FILE]
                                        [--ips-dir DIR]
                                        [--output-dir DIR]

Defaults:
  --selected   test-files/OPU/opu_selected_pairs.tsv
  --ips-dir    (required — directory of per-ERZ IPS TSV files)
  --output-dir test-files/OPU/ips

Input files:
  opu_tsv       Full OPU TSV (seqname, OPU, originalname, KEGG_ko,
                Predicted taxonomic group, match_id).  ~500K rows.
  --selected    opu_selected_pairs.tsv from analyze-opu-data.py
  --ips-dir     One *.tsv file per ERZ study, named ERZ841404.tsv etc.
                Each file has a header row followed by IPS result rows
                where column 0 is the protein ID (matches 'originalname'
                in the OPU TSV).

Output:
  {output-dir}/{sanitized_taxon}.ips.tsv   — one file per selected taxon,
    containing all IPS rows for proteins predicted to belong to that taxon,
    merged across all ERZ studies.  The IPS header is included in every file.

Naming for downstream tools:
  Polaribacter.ips.tsv  →  Polaribacter_FASTA_gp.csv  (GP pipeline output)
  The sanitized_taxon name is taken from opu_selected_pairs.tsv so naming
  is consistent with create-opu-merged.js expectations.
"""

import argparse
import csv
import os
import sys
from collections import defaultdict


def sanitize_name(name):
    """Produce a filesystem-safe version of a taxon name (mirrors analyze-opu-data.py)."""
    return "".join(c if c.isalnum() or c in "-." else "_" for c in name)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("opu_tsv", help="Path to the full OPU TSV file")
    parser.add_argument(
        "--selected",
        default="test-files/OPU/opu_selected_pairs.tsv",
        metavar="FILE",
        help="opu_selected_pairs.tsv from analyze-opu-data.py (default: test-files/OPU/opu_selected_pairs.tsv)",
    )
    parser.add_argument(
        "--ips-dir",
        required=True,
        metavar="DIR",
        help="Directory containing per-ERZ IPS TSV files (e.g. ERZ841404.tsv)",
    )
    parser.add_argument(
        "--output-dir",
        default="test-files/OPU/ips",
        metavar="DIR",
        help="Output directory for per-taxon IPS files (default: test-files/OPU/ips)",
    )
    args = parser.parse_args()

    for path in (args.opu_tsv, args.selected, args.ips_dir):
        if not os.path.exists(path):
            print(f"Error: not found: {path}", file=sys.stderr)
            sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    # --- Load selected taxa ---
    selected_taxa = set()
    sanitized_of = {}  # taxon → sanitized_taxon (from pairs file, for consistency)
    with open(args.selected, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            taxon = row["taxon"].strip()
            selected_taxa.add(taxon)
            sanitized_of[taxon] = row["sanitized_taxon"].strip()

    print(f"Selected taxa ({len(selected_taxa)}): {', '.join(sorted(selected_taxa))}")

    # --- Build originalname → taxon map from OPU TSV ---
    # Only keep proteins whose predicted taxon is in selected_taxa.
    print(f"\nReading OPU TSV: {args.opu_tsv} …")
    protein_to_taxon = {}
    total_rows = skipped = 0
    with open(args.opu_tsv, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            total_rows += 1
            taxon = row.get("Predicted taxonomic group", "").strip()
            if taxon not in selected_taxa:
                skipped += 1
                continue
            originalname = row.get("originalname", "").strip()
            if originalname:
                protein_to_taxon[originalname] = taxon

    print(f"  Rows read        : {total_rows:,}")
    print(f"  Rows skipped     : {skipped:,} (taxon not selected or UNKNOWN)")
    print(f"  Proteins mapped  : {len(protein_to_taxon):,}")

    # --- Stream IPS files, routing rows to per-taxon output files ---
    ips_files = sorted(
        f for f in os.listdir(args.ips_dir) if f.endswith(".tsv") or f.endswith(".tsv.gz")
    )
    if not ips_files:
        print(f"\nNo *.tsv files found in: {args.ips_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"\nProcessing {len(ips_files)} IPS file(s) …")

    # Open one output file per selected taxon
    out_handles = {}
    header_written = set()
    ips_header = None

    for ips_file in ips_files:
        ips_path = os.path.join(args.ips_dir, ips_file)
        matched = 0
        with open(ips_path, newline="", encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh):
                if lineno == 0:
                    # Capture the IPS header (write it to all output files later)
                    if ips_header is None:
                        ips_header = line
                    continue

                # Column 0 is the protein/sequence ID
                protein_id = line.split("\t", 1)[0].strip()
                taxon = protein_to_taxon.get(protein_id)
                if taxon is None:
                    continue

                matched += 1
                san = sanitized_of[taxon]
                if san not in out_handles:
                    out_path = os.path.join(args.output_dir, f"{san}.ips.tsv")
                    out_handles[san] = open(out_path, "w", encoding="utf-8")

                if san not in header_written and ips_header is not None:
                    out_handles[san].write(ips_header)
                    header_written.add(san)

                out_handles[san].write(line)

        print(f"  {ips_file}: {matched:,} rows matched")

    for handle in out_handles.values():
        handle.close()

    print(f"\nOutput files ({len(out_handles)}) written to: {args.output_dir}")
    for san, taxon in sorted((sanitized_of[t], t) for t in selected_taxa):
        out_path = os.path.join(args.output_dir, f"{san}.ips.tsv")
        if os.path.exists(out_path):
            size = os.path.getsize(out_path)
            print(f"  {san}.ips.tsv  ({size:,} bytes)  [{taxon}]")
        else:
            print(f"  {san}.ips.tsv  [NO DATA — taxon not found in any IPS file]")

    print(
        "\nNext step: run GP pipeline on each .ips.tsv file to produce "
        "{sanitized_taxon}_FASTA_gp.csv, then run: npm run create-opu-merged"
    )


if __name__ == "__main__":
    main()
