#!/usr/bin/env python3
"""
analyze-opu-data.py

Parse the OPU TSV (~500K rows), aggregate metrics by predicted taxon (across
all ERZ studies), rank taxa by your chosen criterion, and output the (ERZ,
taxon) pairs for the top N taxa.

Usage:
  python3 scripts/analyze-opu-data.py <opu_tsv> [--top N]
                                       [--rank-by proteins|OPUs|studies|KEGG|KEGG_coverage]
                                       [--output-dir DIR]

Defaults:
  --top        10
  --rank-by    proteins
  --output-dir test-files/OPU

Ranking criteria (all computed per taxon, summed across ERZ studies):
  proteins      — total protein count (most data overall)
  OPUs          — distinct OPU cluster count (broadest functional range)
  studies       — number of ERZ studies the taxon appears in (most prevalent)
  KEGG          — distinct KEGG KO count (richest metabolic annotation)
  KEGG_coverage — fraction of proteins with a non-UNKNOWN KO (best quality)

Outputs:
  <output-dir>/opu_selected_pairs.tsv  — all (ERZ, taxon) pairs for top taxa
  <output-dir>/opu_taxon_names.txt     — unique taxon names from the FULL data

Edit opu_selected_pairs.tsv to keep only the pairs you want, then run
resolve-opu-taxa.py and split-ips-by-taxon.py.

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
    """Produce a filesystem-safe version of a taxon name."""
    return "".join(c if c.isalnum() or c in "-." else "_" for c in name)


def parse_kegg(kegg_field):
    """
    Return the set of distinct KO identifiers from a KEGG_ko field.
    Handles comma-separated values ("ko:K03296,ko:K18138") and "UNKNOWN".
    """
    if not kegg_field or kegg_field.strip() == "UNKNOWN":
        return set()
    return {k.strip() for k in kegg_field.split(",") if k.strip()}


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("opu_tsv", help="Path to the OPU TSV file")
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        metavar="N",
        help="Number of top taxa to select (default: 10)",
    )
    parser.add_argument(
        "--rank-by",
        choices=["proteins", "OPUs", "studies", "KEGG", "KEGG_coverage"],
        default="proteins",
        help=(
            "Ranking criterion (default: proteins):\n"
            "  proteins      — total protein count\n"
            "  OPUs          — distinct OPU cluster count\n"
            "  studies       — number of ERZ studies containing the taxon\n"
            "  KEGG          — distinct KEGG KO count\n"
            "  KEGG_coverage — fraction of proteins with a known KO"
        ),
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

    # Per-(erz, taxon) pair accumulators
    pair_proteins = defaultdict(int)        # (erz, taxon) → protein count
    pair_opu_sets = defaultdict(set)        # (erz, taxon) → {OPU, ...}
    pair_kegg_sets = defaultdict(set)       # (erz, taxon) → {KO, ...}
    pair_kegg_annotated = defaultdict(int)  # (erz, taxon) → proteins with KO

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
            kegg = parse_kegg(row.get("KEGG_ko", ""))
            key = (erz, taxon)
            pair_proteins[key] += 1
            pair_opu_sets[key].add(opu)
            pair_kegg_sets[key].update(kegg)
            if kegg:
                pair_kegg_annotated[key] += 1

    print(f"  Total rows              : {total_rows:>10,}")
    print(f"  Skipped (UNKNOWN taxon) : {skipped_unknown:>10,}")
    print(f"  Distinct (ERZ, taxon) pairs: {len(pair_proteins):,}")

    # ── Aggregate per-taxon metrics across all ERZ studies ──────────────────
    taxon_proteins = defaultdict(int)    # taxon → total proteins
    taxon_opu_sets = defaultdict(set)    # taxon → distinct OPUs (global)
    taxon_erz_sets = defaultdict(set)    # taxon → distinct ERZ studies
    taxon_kegg_sets = defaultdict(set)   # taxon → distinct KOs (global)
    taxon_kegg_ann = defaultdict(int)    # taxon → proteins with KO

    for (erz, taxon), n in pair_proteins.items():
        taxon_proteins[taxon] += n
        taxon_opu_sets[taxon].update(pair_opu_sets[(erz, taxon)])
        taxon_erz_sets[taxon].add(erz)
        taxon_kegg_sets[taxon].update(pair_kegg_sets[(erz, taxon)])
        taxon_kegg_ann[taxon] += pair_kegg_annotated[(erz, taxon)]

    all_taxa_names = sorted(taxon_proteins.keys())
    print(f"  Distinct taxa           : {len(all_taxa_names):,}")

    # ── Build per-taxon summary rows ─────────────────────────────────────────
    def kegg_cov(t):
        n = taxon_proteins[t]
        return taxon_kegg_ann[t] / n if n else 0.0

    RANK_KEYS = {
        "proteins":      lambda t: taxon_proteins[t],
        "OPUs":          lambda t: len(taxon_opu_sets[t]),
        "studies":       lambda t: len(taxon_erz_sets[t]),
        "KEGG":          lambda t: len(taxon_kegg_sets[t]),
        "KEGG_coverage": kegg_cov,
    }
    rank_fn = RANK_KEYS[args.rank_by]

    taxa_rows = sorted(
        [
            {
                "taxon": t,
                "n_proteins": taxon_proteins[t],
                "n_OPUs": len(taxon_opu_sets[t]),
                "n_studies": len(taxon_erz_sets[t]),
                "n_KEGG": len(taxon_kegg_sets[t]),
                "KEGG_coverage": kegg_cov(t),
            }
            for t in taxon_proteins
        ],
        key=lambda x: x[args.rank_by if args.rank_by in x else "n_proteins"],
        reverse=True,
    )
    # Use rank_fn for custom sort
    taxa_rows.sort(key=lambda x: rank_fn(x["taxon"]), reverse=True)

    # ── Print top-30 taxon summary ────────────────────────────────────────────
    display_n = min(30, len(taxa_rows))
    print(
        f"\nTop {display_n} taxa ranked by '{args.rank_by}' "
        f"(aggregated across all ERZ studies):"
    )
    hdr = f"{'Rank':>5}  {'proteins':>10}  {'OPUs':>7}  {'studies':>7}  {'KEGG_KOs':>9}  {'KEGG_cov':>9}  Taxon"
    sep = "─" * len(hdr)
    print(sep)
    print(hdr)
    print(sep)
    for i, r in enumerate(taxa_rows[:display_n], 1):
        print(
            f"{i:>5}  {r['n_proteins']:>10,}  {r['n_OPUs']:>7,}  "
            f"{r['n_studies']:>7}  {r['n_KEGG']:>9,}  {r['KEGG_coverage']:>8.1%}  "
            f"{r['taxon']}"
        )
    if len(taxa_rows) > display_n:
        print(f"  … ({len(taxa_rows) - display_n} more taxa not shown)")

    # ── Select top-N taxa and collect ALL their (ERZ, taxon) pairs ───────────
    top_taxa = {r["taxon"] for r in taxa_rows[: args.top]}
    selected_pairs = [
        {
            "erz_code": erz,
            "taxon": taxon,
            "sanitized_taxon": sanitize_name(taxon),
            "n_proteins": pair_proteins[(erz, taxon)],
            "n_OPUs": len(pair_opu_sets[(erz, taxon)]),
        }
        for (erz, taxon) in sorted(pair_proteins.keys())
        if taxon in top_taxa
    ]
    # Sort by taxon then ERZ for readability
    selected_pairs.sort(key=lambda x: (x["taxon"], x["erz_code"]))

    pairs_path = os.path.join(args.output_dir, "opu_selected_pairs.tsv")
    with open(pairs_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, delimiter="\t")
        writer.writerow(["erz_code", "taxon", "sanitized_taxon", "n_proteins", "n_OPUs"])
        for p in selected_pairs:
            writer.writerow(
                [p["erz_code"], p["taxon"], p["sanitized_taxon"],
                 p["n_proteins"], p["n_OPUs"]]
            )
    n_erz = len({p["erz_code"] for p in selected_pairs})
    print(
        f"\nTop {len(top_taxa)} taxa → {len(selected_pairs)} (ERZ, taxon) pairs "
        f"across {n_erz} ERZ studies → {pairs_path}"
    )

    # Write ALL unique taxon names (not just top-N) for taxid resolution
    taxon_path = os.path.join(args.output_dir, "opu_taxon_names.txt")
    with open(taxon_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(all_taxa_names) + "\n")
    print(f"Unique taxon names ({len(all_taxa_names):,}) → {taxon_path}")

    print(
        "\nNext steps:\n"
        "  1. Review opu_selected_pairs.tsv; remove any unwanted rows.\n"
        "  2. Run: python3 scripts/resolve-opu-taxa.py\n"
        "  3. Fetch IPS result files for the ERZ studies listed.\n"
        "  4. Run: python3 scripts/split-ips-by-taxon.py <opu_tsv> --ips-dir <dir>"
    )


if __name__ == "__main__":
    main()
