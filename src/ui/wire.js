// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S, $ } from "../state.js";
import { parseMoney, commafy } from "../format.js";
import { render, renderPropRows, renderHeirList } from "./render.js";
import { downloadPdf } from "../export.js";

export function wire(){
/* ---------- wiring ---------- */
$("prop-rows").addEventListener("input", function(e){
  var el = e.target.closest("input, select"); if (!el) return;
  var i = +el.closest(".prow").dataset.i, f = el.dataset.f;
  if (f === "value"){
    S.props[i].value = parseMoney(el.value);
    var atEnd = el.selectionStart === el.value.length;
    el.value = commafy(S.props[i].value);
    if (atEnd) el.setSelectionRange(el.value.length, el.value.length);
  } else S.props[i][f] = el.value;
  render();
});
$("prop-rows").addEventListener("click", function(e){
  var b = e.target.closest("[data-kill]"); if (!b) return;
  S.props.splice(+b.dataset.kill, 1); renderPropRows(); render();
});
$("add-prop").addEventListener("click", function(){
  S.props.push({name:"", note:"", value:0, owner:"client", acq:"onerous", liq:"realty", to:"residue"});
  renderPropRows(); render();
  var rows = $("prop-rows").querySelectorAll('.prow input[data-f="name"]');
  if (rows.length) rows[rows.length-1].focus();
});

["lc","ilc","lp"].forEach(function(key){
  $("list-"+key).addEventListener("input", function(e){
    var inp = e.target.closest("input[data-hkey], input[data-hdob]"); if (!inp) return;
    var i = +inp.dataset.hi, cur = S[key][i];
    // normalise a legacy plain-string entry the first time it is edited
    if (typeof cur === "string" || !cur) cur = S[key][i] = { name: cur || "", dob: "" };
    if (inp.dataset.hdob) cur.dob = inp.value; else cur.name = inp.value;
    render();
  });
  $("list-"+key).addEventListener("click", function(e){
    var b = e.target.closest("[data-hkill]"); if (!b) return;
    S[key].splice(+b.dataset.hi, 1); renderHeirList(key); render();
  });
});
document.querySelectorAll("[data-add]").forEach(function(btn){
  btn.addEventListener("click", function(){
    var key = btn.dataset.add;
    if (key === "lp" && S.lp.length >= 2) return;
    S[key].push({ name:"", dob:"" }); renderHeirList(key); render();
    var ins = $("list-"+key).querySelectorAll("input");
    if (ins.length) ins[ins.length-1].focus();
  });
});

$("in-client").addEventListener("input", function(e){ S.client = e.target.value; render(); });
  $("in-clientdob").addEventListener("change", function(e){ S.clientDob = e.target.value; render(); });
  $("in-spousedob").addEventListener("change", function(e){ S.spouseDob = e.target.value; render(); });
$("in-spousename").addEventListener("input", function(e){ S.spouseName = e.target.value; render(); });
$("in-spouse").addEventListener("change", function(e){ S.spouse = e.target.checked; render(); });
$("in-date").addEventListener("change", function(e){ S.date = e.target.value; render(); });
$("in-prenup").addEventListener("change", function(e){ S.prenup = e.target.value; render(); });
$("in-debts").addEventListener("input", function(e){
  S.debts = parseMoney(e.target.value);
  var atEnd = e.target.selectionStart === e.target.value.length;
  e.target.value = commafy(S.debts) || "0";
  if (atEnd) e.target.setSelectionRange(e.target.value.length, e.target.value.length);
  render();
});
$("bq-rows").addEventListener("input", function(e){
  var el = e.target.closest("select"); if (!el) return;
  var i = +el.closest(".bqrow").dataset.i;
  if (el.dataset.b === "liq") S.props[i].liq = el.value; else S.props[i].to = el.value;
  render();
});
function bindMoneyField(id, key){
  $(id).addEventListener("input", function(e){
    S[key] = parseMoney(e.target.value);
    var atEnd = e.target.selectionStart === e.target.value.length;
    e.target.value = commafy(S[key]) || "0";
    if (atEnd) e.target.setSelectionRange(e.target.value.length, e.target.value.length);
    render();
  });
}
function bindRate(id, key){
  $(id).addEventListener("input", function(e){
    var n = parseFloat(String(e.target.value).replace(/[^0-9.]/g,""));
    S[key] = isFinite(n) && n >= 0 ? n : 0;
    render();
  });
}
bindMoneyField("in-other","otherCash");
bindMoneyField("in-funeral","funeral");
bindMoneyField("in-medical","medical");
bindMoneyField("in-judicial","judicial");
$("in-death").addEventListener("change", function(e){ S.deathDate = e.target.value; render(); });
bindMoneyField("in-pub","pub");
bindRate("in-rtransfer","rTransfer");
bindRate("in-rreg","rReg");
bindRate("in-rnot","rNotarial");
bindRate("in-rexec","rExecutor");
$("in-late").addEventListener("input", function(e){
  var n = parseInt(String(e.target.value).replace(/[^0-9]/g,""), 10);
  S.monthsLate = isFinite(n) && n > 0 ? Math.min(n, 600) : 0;
  render();
});
$("in-fh").addEventListener("change", function(e){ S.familyHome = parseInt(e.target.value,10); render(); });
$("in-route").addEventListener("change", function(e){ S.route = e.target.value; render(); });
$("in-debton").addEventListener("change", function(e){ S.debtOn = e.target.value; render(); });
$("in-freeto").addEventListener("change", function(e){ S.freeTo = e.target.value; render(); });
$("in-cover").addEventListener("input", function(e){
  S.coverMode = "custom"; S.coverAmount = parseMoney(e.target.value);
  var atEnd = e.target.selectionStart === e.target.value.length;
  e.target.value = commafy(S.coverAmount) || "0";
  if (atEnd) e.target.setSelectionRange(e.target.value.length, e.target.value.length);
  render();
});
$("cov-status").addEventListener("click", function(e){
  if (!e.target.closest("#cov-reset")) return;
  S.coverMode = "auto"; render();
});
$("wgrid").addEventListener("change", function(e){
  var el = e.target.closest("select[data-w]"); if (!el) return;
  S.waive[el.dataset.w] = el.value; render();
});

$("btn-print").addEventListener("click", function(){ window.print(); });
  $("btn-pdf").addEventListener("click", function(e){ downloadPdf(e.currentTarget); });

$("in-clientdob").value = S.clientDob || "";
$("in-spousedob").value = S.spouseDob || "";

$("prep-date").textContent = new Date().toLocaleDateString("en-PH", {day:"numeric", month:"long", year:"numeric"});
(function(){
  var d = new Date(), iso = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  S.deathDate = iso; $("in-death").value = iso;
})();

renderPropRows();
["lc","ilc","lp"].forEach(renderHeirList);
render();
}
