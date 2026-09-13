// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S } from "./state.js";

/* ---------- formatting ---------- */
var peso = function(n){ return "₱" + Math.round(n).toLocaleString("en-PH"); };
var pct = function(p){
  if (p === 0) return "0%";
  if (Math.abs(p - Math.round(p)) < 1e-9) return Math.round(p) + "%";
  var d = (p < 10 && Math.abs(p*10 - Math.round(p*10)) > 1e-9) ? 2 : 1;
  return p.toFixed(d).replace(/0+$/,"").replace(/\.$/,"") + "%";
};
var frac = function(x){
  if (x <= 0) return null;
  for (var d = 1; d <= 240; d++){
    var n = Math.round(x*d);
    if (n >= 1 && Math.abs(x - n/d) < 1e-9) return d === 1 ? "all" : n + "/" + d;
  }
  return null;
};
var parseMoney = function(v){ var n = parseFloat(String(v).replace(/[^0-9.]/g,"")); return isFinite(n) && n > 0 ? n : 0; };
var commafy = function(n){ return n ? n.toLocaleString("en-PH") : ""; };
var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); };

var client = function(){ return S.client.trim() || "the client"; };
var spouseWho = function(){ return S.spouseName.trim() || "the spouse"; };
var firstName = function(s){ return (s.trim().split(/\s+/)[0]) || s; };
var heirName = function(key, i){
  if (key === "ss") return spouseWho();
  var n = ((S[key] || [])[i] || "").trim();
  if (n) return n;
  return key === "lc" ? "Legitimate child " + (i+1) : key === "ilc" ? "Illegitimate child " + (i+1) : "Parent " + (i+1);
};
var ROLE = { lc:"Legitimate child", ilc:"Illegitimate child", lp:"Parent", ss:"Spouse" };

export { peso, pct, frac, parseMoney, commafy, esc, client, spouseWho, firstName, heirName, ROLE };
