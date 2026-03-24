#!/usr/bin/env python3
"""
resolve-opu-taxa.py

Map OPU taxon names (from opu_taxon_names.txt) to NCBI taxids by matching
against the viewer's tree.json.

Usage:
  python3 scripts/resolve-opu-taxa.py [taxonNamesFile] [treeJsonFile] [outputFile]

Defaults:
  taxonNamesFile = test-files/OPU/opu_taxon_names.txt
  treeJsonFile   = test-files/tree.json
  outputFile     = test-files/OPU/opu_taxid_map.json

Output format (opu_taxid_map.json):
  {
    "Polaribacter": "1229",
    "unclassified Alphaproteobacteria": "28211",
    "Sulfurimonas": "1558810",
    ...
  }

Matching strategy (in order of precedence):
  1. Exact match on node 'name'
  2. Exact match after stripping leading "unclassified ", "candidate ",
     "uncultured ", or "environmental samples " prefixes
  3. No match → entry omitted (organism will appear at tree root in viewer)

Unmatched names are printed to stderr.
"""

import json
import sys
import os


def flatten_tree(node, name_to_taxid):
    """Recursively collect name → taxid from the tree."""
    name = node.get("name", "").strip()
    taxid = str(node.get("taxid", "")).strip()
    if name and taxid:
        # Only store first occurrence (higher nodes have priority over lower
        # ones with the same name — tree.json is ordered root → leaves)
        if name not in name_to_taxid:
            name_to_taxid[name] = taxid
    for child in node.get("children", []):
        flatten_tree(child, name_to_taxid)


STRIP_PREFIXES = [
    "unclassified ",
    "candidate ",
    "uncultured ",
    "environmental samples ",
]


def strip_qualifiers(name):
    """Remove common leading qualifiers to find the base taxon name."""
    lower = name.lower()
    for prefix in STRIP_PREFIXES:
        if lower.startswith(prefix):
            return name[len(prefix):]
    return None


taxon_names_path = sys.argv[1] if len(sys.argv) > 1 else "test-files/OPU/opu_taxon_names.txt"
tree_path = sys.argv[2] if len(sys.argv) > 2 else "test-files/tree.json"
output_path = sys.argv[3] if len(sys.argv) > 3 else "test-files/OPU/opu_taxid_map.json"

for p in [taxon_names_path, tree_path]:
    if not os.path.exists(p):
        print(f"Error: file not found: {p}", file=sys.stderr)
        sys.exit(1)

# Load taxon names to resolve
with open(taxon_names_path, encoding="utf-8") as fh:
    taxon_names = [line.strip() for line in fh if line.strip()]

# Build name → taxid lookup from tree.json
print(f"Loading {tree_path} …")
with open(tree_path, encoding="utf-8") as fh:
    tree = json.load(fh)
name_to_taxid = {}
flatten_tree(tree, name_to_taxid)
print(f"  {len(name_to_taxid):,} unique taxon names indexed")

# Resolve each name
result = {}
unmatched = []

for name in taxon_names:
    if name in name_to_taxid:
        result[name] = name_to_taxid[name]
        continue
    stripped = strip_qualifiers(name)
    if stripped and stripped in name_to_taxid:
        result[name] = name_to_taxid[stripped]
        print(f"  Prefix-stripped match: '{name}' → '{stripped}' (taxid {name_to_taxid[stripped]})")
        continue
    unmatched.append(name)

# Write output
os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
with open(output_path, "w", encoding="utf-8") as fh:
    json.dump(result, fh, indent=2)

matched = len(result)
total = len(taxon_names)
print(f"\nResolved {matched}/{total} taxon names → {output_path}")

if unmatched:
    print(f"\nUnmatched names ({len(unmatched)}) — will appear at tree root in viewer:")
    for name in unmatched:
        print(f"  {name}", file=sys.stderr)
    print(
        "\nFor these, you can manually add entries to opu_taxid_map.json,\n"
        "or look up their taxids at https://www.ncbi.nlm.nih.gov/taxonomy"
    )
