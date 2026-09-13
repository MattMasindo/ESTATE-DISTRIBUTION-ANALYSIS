// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S, CUT } from "../state.js";

/* ---------- regime + classification ---------- */
function regime(){
  if (!S.spouse) return "none";
  if (S.prenup !== "none") return S.prenup;
  var d = Date.parse(S.date);
  return (isNaN(d) || d >= CUT) ? "acp" : "cpg";
}
var REGIME_NAME = { acp:"Absolute Community of Property", cpg:"Conjugal Partnership of Gains", sep:"Complete Separation of Property" };

// "shared" -> the conjugal / community pot; "exclusive" -> stays with its owner
function classify(p, reg){
  if (reg === "sep") return "exclusive";
  if (reg === "cpg"){
    // Owned before the marriage stays exclusive — but the fruits and income of
    // exclusive property belong to the partnership (Family Code, Art. 117).
    if (p.acq === "onerous" || p.acq === "fruits") return "shared";
    return "exclusive";
  }
  // Absolute community: everything brought into the marriage joins the pot.
  // Only gratuitous-title property and its fruits stay out (Family Code, Art. 92).
  if (p.acq === "gratuitous" || p.acq === "fruits") return "exclusive";
  return "shared";
}

function bucket(p, reg){
  if (!S.spouse) return { conj:0, exd:p.value, exs:0, cls:"exclusive" };
  var cls = classify(p, reg);
  if (cls === "shared") return { conj:p.value, exd:0, exs:0, cls:cls };
  if (p.owner === "client") return { conj:0, exd:p.value, exs:0, cls:cls };
  if (p.owner === "spouse") return { conj:0, exd:0, exs:p.value, cls:cls };
  return { conj:0, exd:p.value/2, exs:p.value/2, cls:cls };
}

function totals(){
  var reg = regime(), t = {conj:0, exd:0, exs:0};
  S.props.forEach(function(p){ var b = bucket(p, reg); t.conj += b.conj; t.exd += b.exd; t.exs += b.exs; });
  return t;
}

// Whose obligation is it? A conjugal charge comes out of the shared pot and so
// halves the spouse's share with it; the client's own debt does not touch her.
function debtSplit(t){
  var d = S.debts;
  if (!S.spouse) return { conj:0, exd:Math.min(d, t.exd + t.conj + t.exs) };
  if (S.debtOn === "exclusive"){
    var fromExd = Math.min(d, t.exd);
    return { exd:fromExd, conj:Math.min(d - fromExd, t.conj) };
  }
  var fromConj = Math.min(d, t.conj);
  return { conj:fromConj, exd:Math.min(d - fromConj, t.exd) };
}

function liquidate(){
  var t = totals(), debt = S.debts;
  if (!S.spouse){
    var pot = t.conj + t.exd + t.exs;
    return { conj:0, exd:pot, exs:0, netConj:0, netExd:Math.max(pot-debt,0),
             spouseOwn:0, estate:Math.max(pot-debt,0), debtPaid:Math.min(debt,pot),
             dConj:0, dExd:Math.min(debt,pot) };
  }
  var D = debtSplit(t);
  var netConj = t.conj - D.conj;
  var netExd = Math.max(t.exd - D.exd, 0);
  return { conj:t.conj, exd:t.exd, exs:t.exs, netConj:netConj, netExd:netExd,
           spouseOwn:netConj/2 + t.exs, estate:netConj/2 + netExd,
           debtPaid:Math.min(debt, t.conj + t.exd), dConj:D.conj, dExd:D.exd };
}

export { regime, REGIME_NAME, classify, bucket, totals, debtSplit, liquidate };
