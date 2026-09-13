// "Download PDF" — produces the client pack as a real file, with no print dialog.
//
// The mechanics, and why they are what they are:
//
//   html2canvas only ever sees *screen* styles, so the carefully paginated
//   @media print rules would be ignored. build.mjs derives a `body.exporting`
//   copy of that whole block, and we switch it on for the duration of the
//   capture. Same rules, one source of truth.
//
//   html2canvas also cannot draw inline SVG, which would silently drop every
//   pie chart — the one thing a client actually looks at. So each chart is
//   serialised to a standalone SVG data URI first, with CSS custom properties
//   resolved to literal colours (a detached SVG has no :root to read them
//   from), and swapped for an <img> that html2canvas can handle.
//
import { S } from "./state.js";
import { client } from "./format.js";

// Colours the charts reference through custom properties.
const VARS = ["--s-lc", "--s-ss", "--s-ilc", "--s-lp", "--s-free", "--s-free-line",
              "--surface", "--ink", "--ink-3", "--line-strong"];

function resolveVars(markup) {
  const root = getComputedStyle(document.documentElement);
  return VARS.reduce(
    (out, v) => out.split(`var(${v})`).join(root.getPropertyValue(v).trim() || "#000"),
    markup
  );
}

// Replace every pie with a bitmap-safe <img>; returns an undo function.
function freezeCharts() {
  const swaps = [];
  document.querySelectorAll("svg[id^='pie-']").forEach(svg => {
    const box = svg.getBoundingClientRect();
    // The summary charts sit in a print-only block, so they only have a size
    // once .exporting is on. Fall back to the viewBox if layout is still zero.
    const w = box.width || 200, h = box.height || 200;

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);
    // the percentage labels take their fill from a stylesheet that will not travel
    clone.querySelectorAll(".slice-pct").forEach(t => {
      t.setAttribute("fill", t.classList.contains("dark-text")
        ? getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() : "#fff");
      t.setAttribute("font-size", "11");
      t.setAttribute("font-weight", "600");
      t.setAttribute("font-family", "Helvetica, Arial, sans-serif");
    });

    const markup = resolveVars(new XMLSerializer().serializeToString(clone));
    const img = new Image(w, h);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    img.style.width = w + "px";
    img.style.height = h + "px";

    svg.style.display = "none";
    svg.parentNode.insertBefore(img, svg);
    swaps.push(() => { img.remove(); svg.style.display = ""; });
  });
  return () => swaps.forEach(undo => undo());
}

const fileName = () => {
  const who = (client() || "Estate plan").replace(/[\\/:*?"<>|]/g, "").trim();
  const when = new Date().toISOString().slice(0, 10);
  return `Estate Distribution Analysis - ${who} - ${when}.pdf`;
};

export async function downloadPdf(btn) {
  if (typeof window.html2pdf !== "function") {
    window.print(); // library missing: fall back rather than do nothing
    return;
  }
  const label = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Building PDF…"; }

  // Order matters: .exporting reveals the print-only summary charts, so the
  // class goes on first and layout settles before anything is measured.
  document.body.classList.add("exporting");
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const thaw = freezeCharts();
  await new Promise(r => setTimeout(r, 400)); // let the data URIs decode

  try {
    await window.html2pdf().set({
      margin: [10, 8, 12, 8],
      filename: fileName(),
      image: { type: "jpeg", quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      pagebreak: { mode: ["css", "legacy"], before: ".pbreak", avoid: [".panel", "tr", ".prow", ".bqrow", ".wcard", ".hbrow"] }
    }).from(document.querySelector(".wrap")).save();
  } catch (e) {
    console.error("PDF export failed, falling back to print", e);
    window.print();
  } finally {
    document.body.classList.remove("exporting");
    thaw();
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}
