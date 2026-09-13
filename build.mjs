// Bundles src/ into a single self-contained index.html.
//
// Why bundle at all, when the source is already plain ES modules? Because a
// single file has no relative paths to get wrong, no CORS rules to trip over,
// and nothing for a static host to mis-serve. It opens by double-clicking it
// from a folder, and it deploys by copying one file. The modular source stays
// the thing you edit and test; this is just what ships.
//
//   npm run build
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(ROOT, p), "utf8");

// Dependency order, leaves first. Kept explicit rather than resolved from the
// import graph: the list is short, and an explicit order is easier to reason
// about than a topological sort you have to trust.
const MODULES = [
  "config.js",
  "src/state.js",
  "src/format.js",
  "src/engine/regime.js",
  "src/engine/succession.js",
  "src/engine/assets.js",
  "src/engine/tax.js",
  "src/engine/plan.js",
  "src/ui/charts.js",
  "src/ui/render.js",
  "src/ui/wire.js",
  "src/cloud.js"
];

function flatten(src) {
  return src
    // drop import statements, single and multi line
    .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
    // drop re-export lists, single and multi line
    .replace(/^export\s*\{[\s\S]*?\};?\s*$/gm, "")
    // inline declarations keep their value, lose the keyword
    .replace(/^export\s+(const|let|var|function|async function|class)\s/gm, "$1 ")
    .trim();
}

const bundle = MODULES.map(m => {
  const body = flatten(read(m));
  return `// ---------- ${m} ----------\n${body}`;
}).join("\n\n");

const css = read("src/styles.css").trim();
const body = read("src/body.html").trim();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Philippine Estate Distribution Calculator</title>
<meta name="description" content="Compulsory legitimes, intestate shares, estate tax and the insurance equalizer, under the Civil Code and Family Code of the Philippines.">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%E2%9A%96%EF%B8%8F</text></svg>">
<style>
${css}
</style>
</head>
<body>
${body}
<script>
// Built from src/ by build.mjs — edit the modules, not this file.
(function(){
"use strict";

${bundle}

wire();
initCloud();
})();
</script>
</body>
</html>
`;

writeFileSync(join(ROOT, "index.html"), html);
console.log(`index.html written — ${(html.length / 1024).toFixed(0)} KB, ${html.split("\n").length} lines, no external files`);
