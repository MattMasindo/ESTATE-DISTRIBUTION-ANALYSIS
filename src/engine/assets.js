// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S } from "../state.js";
import { bucket } from "./regime.js";
import { heirName, ROLE, dobOf } from "../format.js";

// What the estate actually owns of each property: the client's exclusive
// share in full, plus half of anything in the conjugal / community pot.
function estateRows(reg){
  return S.props.map(function(p,i){
    var b = bucket(p, reg);
    var kind = p.liq || "realty";
    if (kind === "illiquid") kind = "realty";
    return { i:i, name:p.name, note:p.note, whole:p.value, kind:kind,
             liq: kind === "liquid", to:p.to || "residue",
             est: b.exd + b.conj/2 };
  }).filter(function(r){ return r.est > 0.005; });
}

function roster(t){
  var out = [];
  ["lc","lp","ss","ilc"].forEach(function(k){
    var g = null;
    for (var j=0;j<t.groups.length;j++) if (t.groups[j].key === k) g = t.groups[j];
    if (!g) return;
    for (var x=0;x<g.count;x++)
      out.push({ id:k+":"+x, key:k, name:heirName(k,x), role:ROLE[k], legitime:g.each,
                 dob: k === "ss" ? S.spouseDob : dobOf((S[k] || [])[x]) });
  });
  return out;
}

export { estateRows, roster };
