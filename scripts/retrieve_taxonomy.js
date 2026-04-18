"use strict";
var path = require("path");
var mysql = require("mysql");

var fs = require("fs");
var content = fs.readFileSync(path.join(__dirname, "config.json"));
var jsonContent = JSON.parse(content);
var ids = [
  "1005058",
  "10090",
  "1033802",
  "1042209",
  "1140",
  "1142394",
  "1162668",
  "1163617",
  "1237085",
  "1303518",
  "1332188",
  "1338011",
  "1348852",
  "1360",
  "1410620",
  "1509",
  "1580",
  "1630693",
  "167879",
  "177416",
  "186497",
  "187303",
  "190192",
  "190485",
  "190650",
  "192222",
  "192952",
  "203124",
  "208964",
  "211586",
  "216591",
  "224308",
  "224324",
  "224325",
  "228410",
  "228908",
  "234267",
  "240015",
  "242231",
  "242619",
  "243164",
  "243230",
  "243231",
  "243232",
  "243233",
  "243273",
  "243274",
  "243275",
  "243277",
  "246195",
  "246197",
  "251229",
  "264462",
  "265072",
  "266117",
  "266834",
  "267608",
  "267747",
  "272123",
  "272559",
  "272561",
  "272569",
  "272623",
  "272624",
  "272843",
  "272944",
  "272947",
  "273057",
  "273075",
  "281689",
  "284812",
  "290315",
  "29343",
  "309801",
  "313628",
  "314225",
  "314260",
  "316274",
  "320771",
  "324602",
  "340099",
  "359391",
  "36329",
  "367928",
  "3702",
  "374847",
  "375451",
  "379066",
  "380703",
  "382464",
  "387344",
  "398578",
  "400668",
  "441768",
  "441771",
  "44689",
  "452637",
  "455632",
  "457570",
  "4577",
  "459349",
  "469381",
  "471821",
  "479434",
  "485913",
  "498848",
  "511051",
  "515635",
  "521095",
  "523841",
  "523846",
  "525373",
  "525909",
  "547558",
  "555778",
  "559292",
  "561229",
  "570509",
  "572479",
  "59374",
  "598659",
  "59919",
  "6239",
  "62928",
  "637389",
  "644282",
  "650150",
  "653733",
  "667014",
  "682795",
  "690850",
  "706587",
  "717231",
  "7227",
  "741277",
  "754409",
  "760142",
  "768066",
  "83332",
  "83333",
  "880070",
  "887700",
  "926550",
  "926569",
  "93061",
  "945713",
  "9606",
  "999552",
];
// var ids = ["999552","83333"];
// var ids = ["1140", "10090", "83333", "1005058", "1033802"];
var not_included = ids.slice();

var taxon = {};

function newNode(lineage, species, taxonomy, taxId, rank) {
  taxId = taxId || null;
  var id = taxId || lineage + ";" + species;
  return {
    id: id,
    lineage: lineage,
    taxId: taxId,
    species: species,
    taxonomy: taxonomy,
    rank: rank,
    parent: null,
    children: [],
  };
}

function newNodeFromRow(row) {
  var taxonomy = row.taxonomy.split(";").filter((d) => d.trim() != ""),
    species = row.level;
  return newNode(row.taxonomy, species, taxonomy, row.ncbi_taxid);
}

function buildAncestryFromDB(node, connection, left, right) {
  var query =
    "SELECT * FROM pfam_30_0.taxonomy WHERE lft<" +
    left +
    " AND rgt>" +
    right +
    " AND minimal=1 ORDER BY lft DESC;";
  var current = node;
  connection.query(query, function (err, rows, fields) {
    if (err) throw err;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!taxon[row.ncbi_taxid]) {
        taxon[row.ncbi_taxid] = newNodeFromRow(row);
        taxon[row.ncbi_taxid].children.push(current);
        current.parent = row.ncbi_taxid;
        current = taxon[row.ncbi_taxid];
      } else {
        taxon[row.ncbi_taxid].children.push(current);
        current.parent = row.ncbi_taxid;
        current = taxon[row.ncbi_taxid];
        break;
      }
    }
    if (!current.parent && current.id !== "root") {
      taxon["root"].children.push(current);
      current.parent = "root";
    }
  });
}
function annotate_number_of_leaves(node) {
  if (node.number_of_leaves) return node.number_of_leaves;
  if (node.children.length < 1) node.number_of_leaves = 1;
  else {
    node.number_of_leaves = 0;
    node.children.forEach(
      (d) => (node.number_of_leaves += annotate_number_of_leaves(d))
    );
  }
  return node.number_of_leaves;
}

var connection = mysql.createConnection(jsonContent);
connection.connect();
taxon["root"] = newNode("", "root", "", "root", null, []);
var query =
  "SELECT * FROM pfam_30_0.taxonomy WHERE ncbi_taxid IN (" +
  ids.join(",") +
  ");";
connection.query(query, function (err, rows, fields) {
  if (err) throw err;
  rows.forEach((row) => {
    if (!row.ncbi_taxid) return;
    taxon[row.ncbi_taxid] = newNodeFromRow(row);
    taxon[row.ncbi_taxid].number_of_leaves = 1;
    buildAncestryFromDB(taxon[row.ncbi_taxid], connection, row.lft, row.rgt);
    var index = not_included.indexOf(String(row.ncbi_taxid));
    if (index != -1) not_included.splice(index, 1);
  });
  connection.end(function (err) {
    // var root = getRoot();
    annotate_number_of_leaves(taxon["root"]);
    console.log(JSON.stringify(taxon["root"]));
  });
});
