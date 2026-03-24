#!/usr/bin/env python3
"""
split-ips-by-taxon.py

For each (ERZ study, taxon) pair listed in opu_selected_pairs.tsv, extract
the subset of IPS (InterProScan) result rows belonging to proteins predicted
to be from that taxon (via OPU assignments) and write them to a separate file.

These sub-IPS files are the input for the GP property-assignment pipeline,
which produces the *_FASTA_gp.csv files consumed by create-opu-merged.js.

Usage:
  python3 scripts/split-ips-by-taxon.py <opu_tsv>
          [--pairs FILE]     opu_selected_pairs.tsv
          [--ips-dir DIR]    directory containing per-ERZ IPS files
          [--output-dir DIR] where to write sub-IPS files
          [--ips-ext EXT]    file extension of IPS files (default: .tsv)
          [--id-col NAME]    OPU TSV column to match against IPS row col-0
                             (default: originalname)

Defaults:
  --pairs       test-files/OPU/opu_selected_pairs.tsv
  --ips-dir     (required — no default)
  --output-dir  test-files/OPU/ips
  --ips-ext     .tsv
  --id-col      originalname

IPS file naming convention:
  The script looks for a file named {erz_code}{ips_ext} inside --ips-dir.
  If multiple naming patterns are needed, symlink or rename files before
  running this script.

Output file naming convention:
  {erz_code}_{sanitized_taxon}.ips.tsv
  where sanitized_taxon comes from the sanitized_taxon column of opu_selected_pairs.tsv.

The first line of the IPS file (if it starts with "Protein") is treated as a
header and is copied verbatim to every output file.
"""

import argparse
import csv
import os
import sys
from collections import defaultdict


def load_selected_pairs(pairs_path):
    """Return list of dicts from opu_selected_pairs.tsv."""
    pairs = []
    with open(pairs_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            pairs.append(row)
    return pairs


def build_seqname_to_key(opu_tsv, selected_set, id_col):
    """
    Read the OPU TSV and build:
      protein_id  →  (erz_code, taxon, sanitized_taxon)

    Only rows whose (erz_code, taxon) pair appears in selected_set are kept.
    selected_set is a set of (erz_code, taxon) tuples.
    """
    mapping = {}
    total = 0
    kept = 0

    def extract_erz(seqname):
        parts = seqname.rsplit("_", 1)
        return parts[0] if len(parts) == 2 and parts[1].isdigit() else seqname

    with open(opu_tsv, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            total += 1
            taxon = row.get("Predicted taxonomic group", "").strip()
            if not taxon or taxon == "UNKNOWN":
                continue
            erz = extract_erz(row["seqname"].strip())
            if (erz, taxon) not in selected_set:
                continue
            protein_id = row.get(id_col, "").strip()
            if not protein_id:
                continue
            # Store per (erz, taxon) so we know which sub-file to write to
            mapping[protein_id] = (erz, taxon)
            kept += 1

    print(f"  OPU TSV rows scanned : {total:>10,}")
    print(f"  Proteins kept        : {kept:>10,}")
    return mapping


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("opu_tsv", help="Path to the OPU TSV file")
    parser.add_argument(
        "--pairs",
        default="test-files/OPU/opu_selected_pairs.tsv",
        metavar="FILE",
        help="opu_selected_pairs.tsv produced by analyze-opu-data.py",
    )
    parser.add_argument(
        "--ips-dir",
        required=True,
        metavar="DIR",
        help="Directory containing per-ERZ IPS result files",
    )
    parser.add_argument(
        "--output-dir",
        default="test-files/OPU/ips",
        metavar="DIR",
        help="Directory for sub-IPS output files (default: test-files/OPU/ips)",
    )
    parser.add_argument(
        "--ips-ext",
        default=".tsv",
        help="File extension of IPS files (default: .tsv)",
    )
    parser.add_argument(
        "--id-col",
        default="originalname",
        help="OPU TSV column whose value matches the IPS first column (default: originalname)",
    )
    args = parser.parse_args()

    for p in [args.opu_tsv, args.pairs]:
        if not os.path.exists(p):
            print(f"Error: file not found: {p}", file=sys.stderr)
            sys.exit(1)
    if not os.path.isdir(args.ips_dir):
        print(f"Error: IPS directory not found: {args.ips_dir}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    # Load selected pairs
    pairs = load_selected_pairs(args.pairs)
    if not pairs:
        print("No pairs found in opu_selected_pairs.tsv.", file=sys.stderr)
        sys.exit(1)

    # Build (erz, taxon) → sanitized_taxon lookup
    pair_meta = {(p["erz_code"], p["taxon"]): p["sanitized_taxon"] for p in pairs}
    selected_set = set(pair_meta.keys())
    erz_codes = sorted({p["erz_code"] for p in pairs})

    print(
        f"Selected pairs: {len(selected_set)}  "
        f"across {len(erz_codes)} ERZ studies\n"
    )
    print(f"Reading OPU TSV to build protein→(ERZ, taxon) map …")
    protein_map = build_seqname_to_key(args.opu_tsv, selected_set, args.id_col)

    # Group proteins by ERZ so we only open each IPS file once
    erz_to_proteins = defaultdict(dict)   # erz → { protein_id: (erz, taxon) }
    for pid, key in protein_map.items():
        erz_to_proteins[key[0]][pid] = key

    # Process each ERZ IPS file
    total_written = defaultdict(int)  # (erz, taxon) → lines written

    for erz in sorted(erz_to_proteins.keys()):
        ips_path = os.path.join(args.ips_dir, erz + args.ips_ext)
        if not os.path.exists(ips_path):
            print(f"  WARNING: IPS file not found: {ips_path} — skipping")
            continue

        erz_proteins = erz_to_proteins[erz]  # { protein_id: (erz, taxon) }

        # Group proteins by taxon for this ERZ
        taxon_proteins = defaultdict(set)
        for pid, key in erz_proteins.items():
            taxon_proteins[key[1]].add(pid)

        # Open one output file per (erz, taxon) pair for this ERZ
        out_handles = {}
        out_paths = {}
        for taxon in taxon_proteins:
            san = pair_meta[(erz, taxon)]
            out_path = os.path.join(args.output_dir, f"{erz}_{san}.ips.tsv")
            out_paths[(erz, taxon)] = out_path
            out_handles[(erz, taxon)] = open(out_path, "w", encoding="utf-8")

        print(f"\nProcessing {ips_path} …")
        header_written = set()
        rows_scanned = 0

        with open(ips_path, encoding="utf-8") as fh:
            for line in fh:
                rows_scanned += 1
                if rows_scanned == 1 and line.startswith("Protein"):
                    # Header line — copy to all output files
                    for fout in out_handles.values():
                        fout.write(line)
                    header_written = set(out_handles.keys())
                    continue

                # First column = protein ID (tab-separated IPS format)
                tab_pos = line.find("\t")
                if tab_pos == -1:
                    continue
                pid = line[:tab_pos]

                if pid in erz_proteins:
                    key = erz_proteins[pid]
                    out_handles[key].write(line)
                    total_written[key] += 1

        for fout in out_handles.values():
            fout.close()

        print(f"  Scanned {rows_scanned:,} IPS rows")
        for taxon, proteins in taxon_proteins.items():
            key = (erz, taxon)
            san = pair_meta[key]
            n = total_written[key]
            print(f"  {erz}::{taxon}  →  {n:,} IPS rows  ({out_paths[key]})")
            if n == 0:
                print(f"    WARNING: no IPS rows matched for this pair. "
                      f"Check --id-col (currently '{args.id_col}').")

    print(
        f"\nDone. Sub-IPS files written to: {args.output_dir}\n"
        "Next step: run the GP property-assignment pipeline on each *.ips.tsv file\n"
        "to produce *_FASTA_gp.csv files, then run:\n"
        "  npm run create-opu-merged"
    )


if __name__ == "__main__":
    main()
