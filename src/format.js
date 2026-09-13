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
// A person is stored as {name, dob}. Plain strings are still accepted so that
// cases saved before dates of birth existed keep loading.
var nameOf = function(e){ return (typeof e === "string" ? e : (e && e.name) || "").trim(); };
var dobOf  = function(e){ return typeof e === "string" ? "" : (e && e.dob) || ""; };

// Age is measured at the ASSUMED DATE OF DEATH, not today — a child who is a
// minor now may well be of age by the time the estate is actually settled.
var ageAt = function(dob, onISO){
  if (!dob) return null;
  var born = new Date(dob), on = new Date(onISO || Date.now());
  if (isNaN(born) || isNaN(on)) return null;
  var years = on.getFullYear() - born.getFullYear();
  var m = on.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < born.getDate())) years--;
  return years;
};

var heirName = function(key, i){
  if (key === "ss") return spouseWho();
  var n = nameOf((S[key] || [])[i]);
  if (n) return n;
  return key === "lc" ? "Legitimate child " + (i+1) : key === "ilc" ? "Illegitimate child " + (i+1) : "Parent " + (i+1);
};
var ROLE = { lc:"Legitimate child", ilc:"Illegitimate child", lp:"Parent", ss:"Spouse" };

export { peso, pct, frac, parseMoney, commafy, esc, client, spouseWho, firstName, heirName, ROLE,
         nameOf, dobOf, ageAt };
