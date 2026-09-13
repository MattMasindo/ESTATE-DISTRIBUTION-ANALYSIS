// Bundles src/ into self-contained HTML pages.
//
// Why bundle at all, when the source is already plain ES modules? Because a
// single file has no relative paths to get wrong, no CORS rules to trip over,
// and nothing for a static host to mis-serve. It opens by double-clicking it
// from a folder, and it deploys by copying one file. The modular source stays
// the thing you edit and test; this is just what ships.
//
// Two pages come out of it:
//   index.html     the analysis. Heavy, because the PDF engine is inlined.
//   factfind.html  the sheet you fill in with the client. Light — it prints
//                  with the browser's own dialog, so it carries no vendor code.
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
const APP_MODULES = [
  "config.js",
  "src/state.js",
  "src/format.js",
  "src/intake.js",
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

const FACTFIND_MODULES = [
  "src/intake.js",
  "src/factfind.js"
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

const bundleOf = mods => mods.map(m => `// ---------- ${m} ----------\n${flatten(read(m))}`).join("\n\n");

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

// The two pages share one palette. Rather than keep a second copy in sync by
// hand, the fact-find borrows the token block straight out of styles.css.
const TOKEN_MARK = "/* ===== TOKENS END ===== */";
function tokensFrom(css) {
  const at = css.indexOf(TOKEN_MARK);
  if (at < 0) throw new Error(`styles.css is missing its ${TOKEN_MARK} marker`);
  return css.slice(0, at).trim();
}

function page({ title, description, css, body, bundle, boot, vendor }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%E2%9A%96%EF%B8%8F</text></svg>">
<style>
${css}
</style>
</head>
<body>
${body}
${vendor ? `<script>/* html2pdf.js — MIT/Apache-2.0, see vendor/html2pdf.bundle.min.js.LICENSE.txt */
${vendor}
</script>` : ""}
<script>
// Built from src/ by build.mjs — edit the modules, not this file.
(function(){
"use strict";

${bundle}

${boot}
})();
</script>
</body>
</html>
`;
}

const baseCss = read("src/styles.css").trim();
const appCss = baseCss + "\n\n/* ---------- derived from @media print, for PDF export ---------- */\n"
             + exportingVariant(baseCss);

const app = page({
  title: "Estate Distribution Analysis",
  description: "Compulsory legitimes, intestate shares, estate tax and the insurance equalizer, under the Civil Code and Family Code of the Philippines.",
  css: appCss,
  body: read("src/body.html").trim(),
  bundle: bundleOf(APP_MODULES),
  vendor: read("vendor/html2pdf.bundle.min.js"),
  boot: "applyIntake(S, takeIntake());\nwire();\ninitCloud();"
});

const factfind = page({
  title: "Estate Planning Fact-Find",
  description: "The client interview behind an estate distribution analysis — the marriage, the heirs, the asset schedule and the questions that get skipped.",
  css: tokensFrom(baseCss) + "\n\n" + read("src/factfind.css").trim(),
  body: read("src/factfind.html").trim(),
  bundle: bundleOf(FACTFIND_MODULES),
  boot: "wireFactfind();"
});

writeFileSync(join(ROOT, "index.html"), app);
writeFileSync(join(ROOT, "factfind.html"), factfind);
console.log(`index.html    — ${(app.length / 1024).toFixed(0)} KB, self-contained (PDF engine bundled)`);
console.log(`factfind.html — ${(factfind.length / 1024).toFixed(0)} KB, self-contained`);
