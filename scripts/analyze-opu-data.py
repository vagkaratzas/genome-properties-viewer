#!/usr/bin/env python3
"""
analyze-opu-data.py

Parse the OPU TSV (~500K rows) and produce a ranked table of
(ERZ study, predicted taxon) pairs to help select 10-20 representative
pairs for OPU mode.

Usage:
  python3 scripts/analyze-opu-data.py <opu_tsv> [--top N]
                                       [--rank-by proteins|OPUs]
                                       [--output-dir DIR]

Defaults:
  --top        20
  --rank-by    proteins
  --output-dir test-files/OPU

Outputs:
  <output-dir>/opu_selected_pairs.tsv  — ranked pairs (edit to trim)
  <output-dir>/opu_taxon_names.txt     — all unique taxon names

Edit opu_selected_pairs.tsv to keep only the pairs you want, then run
split-ips-by-taxon.py.

Expected TSV columns (tab-separated, with header row):
  seqname  OPU  originalname  KEGG_ko  Predicted taxonomic group  match_id
"""

import argparse
import csv
import os
import sys
from collections import defaultdict


def extract_erz_code(seqname):
    """
    Strip the trailing numeric suffix from a seqname.

    ERZ4874890_2959            →  ERZ4874890
    ERZ841404_198223           →  ERZ841404
    ERZ_human_skin_test_3      →  ERZ_human_skin_test
    """
    parts = seqname.rsplit("_", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return seqname


def sanitize_name(name):
    """
    Produce a filesystem-safe version of a taxon name.
    Spaces and most punctuation → underscore; alphanumerics and - . kept.
    """
    return "".join(c if c.isalnum() or c in "-." else "_" for c in name)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("opu_tsv", help="Path to the OPU TSV file")
    parser.add_argument(
        "--top",
        type=int,
        default=20,
        metavar="N",
        help="Number of top pairs to write to opu_selected_pairs.tsv (default: 20)",
    )
    parser.add_argument(
        "--rank-by",
        choices=["proteins", "OPUs"],
        default="proteins",
        help="Rank by protein count or distinct-OPU count (default: proteins)",
    )
    parser.add_argument(
        "--output-dir",
        default="test-files/OPU",
        help="Directory for output files (default: test-files/OPU)",
    )
    args = parser.parse_args()

    if not os.path.exists(args.opu_tsv):
        print(f"Error: file not found: {args.opu_tsv}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    protein_counts = defaultdict(int)   # (erz, taxon) → n_proteins
    opu_sets = defaultdict(set)         # (erz, taxon) → {OPU, ...}

    print(f"Reading {args.opu_tsv} …")
    total_rows = 0
    skipped_unknown = 0

    with open(args.opu_tsv, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            total_rows += 1
            taxon = row.get("Predicted taxonomic group", "").strip()
            if not taxon or taxon == "UNKNOWN":
                skipped_unknown += 1
                continue
            erz = extract_erz_code(row["seqname"].strip())
            opu = row["OPU"].strip()
            key = (erz, taxon)
            protein_counts[key] += 1
            opu_sets[key].add(opu)

    print(f"  Total rows         : {total_rows:>10,}")
    print(f"  Skipped (UNKNOWN)  : {skipped_unknown:>10,}")
    print(f"  Distinct (ERZ, taxon) pairs: {len(protein_counts):,}")

    # Build sorted list
    rank_field = "n_proteins" if args.rank_by == "proteins" else "n_OPUs"
    pairs = sorted(
        [
            {
                "erz_code": k[0],
                "taxon": k[1],
                "sanitized_taxon": sanitize_name(k[1]),
                "n_proteins": protein_counts[k],
                "n_OPUs": len(opu_sets[k]),
            }
            for k in protein_counts
        ],
        key=lambda x: x[rank_field],
        reverse=True,
    )

    # Print top-50 to stdout for inspection
    display_n = min(50, len(pairs))
    col_w = max(len(p["erz_code"]) for p in pairs[:display_n])
    header = (
        f"{'Rank':>5}  {'n_proteins':>12}  {'n_OPUs':>8}  "
        f"{'ERZ code':<{col_w}}  Taxon"
    )
    sep = "─" * len(header)
    print(f"\n{sep}")
    print(header)
    print(sep)
    for i, p in enumerate(pairs[:display_n], 1):
        print(
            f"{i:>5}  {p['n_proteins']:>12,}  {p['n_OPUs']:>8,}  "
            f"{p['erz_code']:<{col_w}}  {p['taxon']}"
        )
    if len(pairs) > display_n:
        print(f"  … ({len(pairs) - display_n} more pairs not shown)")

    # Write top-N to opu_selected_pairs.tsv
    top_pairs = pairs[: args.top]
    pairs_path = os.path.join(args.output_dir, "opu_selected_pairs.tsv")
    with open(pairs_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, delimiter="\t")
        writer.writerow(["erz_code", "taxon", "sanitized_taxon", "n_proteins", "n_OPUs"])
        for p in top_pairs:
            writer.writerow(
                [p["erz_code"], p["taxon"], p["sanitized_taxon"],
                 p["n_proteins"], p["n_OPUs"]]
            )
    print(f"\nTop {len(top_pairs)} pairs written → {pairs_path}")

    # Write all unique taxon names for taxid resolution
    all_taxa = sorted({k[1] for k in protein_counts})
    taxon_path = os.path.join(args.output_dir, "opu_taxon_names.txt")
    with open(taxon_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(all_taxa) + "\n")
    print(f"Unique taxon names ({len(all_taxa):,}) → {taxon_path}")

    print(
        "\nNext steps:\n"
        "  1. Review opu_selected_pairs.tsv and remove unwanted rows.\n"
        "  2. Fetch IPS result files for the ERZ studies listed there.\n"
        "  3. Run: python3 scripts/split-ips-by-taxon.py <opu_tsv> [options]"
    )


if __name__ == "__main__":
    main()
