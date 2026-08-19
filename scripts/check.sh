#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

node - <<'NODE'
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const updateManifest = JSON.parse(fs.readFileSync("updates.json", "utf8"));
const addonID = manifest.applications.zotero.id;
const latestUpdate = updateManifest.addons?.[addonID]?.updates?.[0];

if (!latestUpdate) throw new Error(`No update entry found for ${addonID}`);
if (latestUpdate.version !== manifest.version) {
  throw new Error(`Version mismatch: manifest ${manifest.version}, updates ${latestUpdate.version}`);
}
NODE
node --check bootstrap.js
node --check content/pubmed-importer.js
node --check content/pubmed-search.js
python3 -c 'import xml.etree.ElementTree as ET; ET.parse("content/pubmed-search.xhtml")'

required_files=(
  bootstrap.js
  manifest.json
  icon.svg
  content/pubmed-importer.js
  content/pubmed-search.xhtml
  content/pubmed-search.js
  content/pubmed-search.css
)

for file in "${required_files[@]}"; do
  test -s "$file"
done

echo "Checks passed."
