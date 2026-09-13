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
  "src/export.js",
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

// html2canvas only ever sees screen styles, so the @media print block would be
// ignored during a PDF export. Derive a body.exporting copy of it here — one
// source of truth, switched on for the duration of the capture.
function exportingVariant(css) {
  const at = css.indexOf("@media print{");
  if (at < 0) return "";
  let depth = 0, end = at + "@media print".length;
  for (; end < css.length; end++) {
    if (css[end] === "{") depth++;
    else if (css[end] === "}") { depth--; if (depth === 0) break; }
  }
  const inner = css.slice(at + "@media print{".length, end);

  const rules = [];
  let buf = "", d = 0;
  for (const ch of inner) {
    buf += ch;
    if (ch === "{") d++;
    else if (ch === "}") { d--; if (d === 0) { rules.push(buf); buf = ""; } }
  }
  return rules.map(rule => {
    if (rule.trim().startsWith("@")) return "";               // @page has no screen equivalent
    const brace = rule.indexOf("{");
    const sel = rule.slice(0, brace).split(",")
      .map(s => "body.exporting " + s.trim()).join(",");
    return sel + rule.slice(brace);
  }).filter(Boolean).join("\n");
}

const baseCss = read("src/styles.css").trim();
const css = baseCss + "\n\n/* ---------- derived from @media print, for PDF export ---------- */\n"
          + exportingVariant(baseCss);
const vendor = read("vendor/html2pdf.bundle.min.js");
const body = read("src/body.html").trim();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Estate Distribution Analysis</title>
<meta name="description" content="Compulsory legitimes, intestate shares, estate tax and the insurance equalizer, under the Civil Code and Family Code of the Philippines.">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%E2%9A%96%EF%B8%8F</text></svg>">
<style>
${css}
</style>
</head>
<body>
${body}
<script>/* html2pdf.js — MIT/Apache-2.0, see vendor/html2pdf.bundle.min.js.LICENSE.txt */
${vendor}
</script>
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
console.log(`index.html written — ${(html.length / 1024).toFixed(0)} KB, self-contained (PDF engine bundled)`);
