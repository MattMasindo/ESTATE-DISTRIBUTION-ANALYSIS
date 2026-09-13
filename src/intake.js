// The hand-off between the fact-find sheet and the calculator.
//
// The sheet is filled in front of the client; the calculator is run from it.
// Rather than re-typing the meeting into the app, the sheet writes a partial
// scenario here and the calculator reads it once on boot.
//
// Transport is sessionStorage, not the URL. Client names, property values and
// family structure have no business in a browser history entry, a referrer
// header or a shared link, and sessionStorage dies with the tab.
//
// buildIntake is pure and is where every coercion lives, so the mapping can be
// tested in Node without a DOM. See test/intake.test.mjs.

export const INTAKE_KEY = "eda:intake";

const OWNERS = ["client", "spouse", "both"];
const ACQS   = ["before", "onerous", "gratuitous", "fruits"];
const LIQS   = ["realty", "liquid"];
const PRENUPS= ["none", "cpg", "acp", "sep"];

function pick(v, allowed, fallback){
  return allowed.indexOf(v) >= 0 ? v : fallback;
}

// "₱1,250,000" and "1250000" both mean the same thing on a handwritten sheet.
function money(v){
  if (typeof v === "number") return isFinite(v) && v > 0 ? v : 0;
  var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : 0;
}

// Group an amount as it is being typed, so 12500000 reads as 12,500,000 and an
// advisor can tell twelve million from one point two at a glance. Only the
// integer part is grouped; a decimal tail is left exactly as typed so the
// separator does not vanish under the caret mid-keystroke.
export function commafyInput(raw){
  var s = String(raw == null ? "" : raw).replace(/[^0-9.]/g, "");
  if (s === "") return "";
  var dot = s.indexOf(".");
  var whole = dot < 0 ? s : s.slice(0, dot);
  var rest  = dot < 0 ? ""  : "." + s.slice(dot + 1).replace(/\./g, "");
  whole = whole.replace(/^0+(?=\d)/, "");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + rest;
}

// Where the caret belongs after regrouping: the same number of digits in, not
// the same number of characters — a comma appearing to the left would otherwise
// push the caret one place back on every third keystroke.
export function caretAfterDigits(value, digits){
  if (digits <= 0) return 0;
  var seen = 0;
  for (var i = 0; i < value.length; i++){
    if (value[i] >= "0" && value[i] <= "9"){
      seen++;
      if (seen === digits) return i + 1;
    }
  }
  return value.length;
}

function isoDate(v){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : "";
}

function people(rows, cap){
  var out = (rows || [])
    .map(function(r){ return { name: String((r && r.name) || "").trim(), dob: isoDate(r && r.dob) }; })
    .filter(function(r){ return r.name !== ""; });          // a blank line is not an heir
  return cap ? out.slice(0, cap) : out;
}

export function buildIntake(f){
  f = f || {};
  var married = !!f.married;

  var props = (f.props || []).map(function(p){
    return {
      name:  String((p && p.name)  || "").trim(),
      note:  String((p && p.note)  || "").trim(),
      value: money(p && p.value),
      owner: pick(p && p.owner, OWNERS, "client"),
      acq:   pick(p && p.acq,   ACQS,   "onerous"),
      liq:   pick(p && p.liq,   LIQS,   "realty"),
      to:    "residue"        // bequests are a planning decision, not a fact-find one
    };
  }).filter(function(p){
    return p.name !== "" || p.value > 0;                    // drop the empty ruled lines
  }).map(function(p){
    // An unmarried client has no conjugal estate. A sheet that says otherwise is
    // a ticked box, not a fact, so it is corrected here rather than carried in.
    if (!married && p.owner !== "client") p.owner = "client";
    return p;
  });

  var out = {
    client:    String(f.client || "").trim(),
    clientDob: isoDate(f.clientDob),
    spouse:    married,
    lc:  people(f.lc),
    ilc: people(f.ilc),
    lp:  people(f.lp, 2),                                   // the engine recognises two parents
    props: props,
    debts:  money(f.debts),
    debtOn: married ? pick(f.debtOn, ["conjugal", "exclusive"], "conjugal") : "exclusive"
  };

  if (married){
    out.spouseName = String(f.spouseName || "").trim();
    out.spouseDob  = isoDate(f.spouseDob);
    out.date       = isoDate(f.marriageDate);
    out.prenup     = pick(f.prenup, PRENUPS, "none");
  }
  return out;
}

// Merge a stored intake into the live scenario. Only keys the sheet actually
// carried are touched; everything else keeps its default.
export function applyIntake(S, raw){
  if (!S || !raw) return false;
  Object.keys(raw).forEach(function(k){
    if (raw[k] !== undefined) S[k] = raw[k];
  });
  return true;
}

export function stashIntake(payload){
  try { sessionStorage.setItem(INTAKE_KEY, JSON.stringify(payload)); return true; }
  catch (e) { return false; }
}

// Read once and burn it — a refresh should not silently re-import a stale meeting.
export function takeIntake(){
  try {
    var raw = sessionStorage.getItem(INTAKE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(INTAKE_KEY);
    return JSON.parse(raw);
  } catch (e) { return null; }
}

/* ---------- existing life insurance ---------- */

// "Same" is what an advisor writes when the owner insures themselves. It is a
// shorthand, not a name, so it is resolved to the owner rather than stored.
export function resolveInsured(insured, owner){
  var v = String(insured == null ? "" : insured).trim();
  var o = String(owner == null ? "" : owner).trim();
  return (/^same$/i.test(v) && o) ? o : v;
}

// How long the policy has been running, inception to today. Whole months, because
// a policy's age is what decides incontestability and surrender values, and
// nobody quotes those in days.
export function policyDuration(fromISO, onISO){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fromISO || ""))) return "";
  var from = new Date(fromISO + "T00:00:00Z");
  var on = onISO ? new Date(onISO + "T00:00:00Z") : new Date();
  if (isNaN(from) || isNaN(on) || on < from) return "";
  var months = (on.getUTCFullYear() - from.getUTCFullYear()) * 12 + (on.getUTCMonth() - from.getUTCMonth());
  if (on.getUTCDate() < from.getUTCDate()) months--;
  if (months < 0) months = 0;
  var y = Math.floor(months / 12), m = months % 12;
  var parts = [];
  if (y) parts.push(y + (y === 1 ? " year" : " years"));
  if (m) parts.push(m + (m === 1 ? " month" : " months"));
  return parts.length ? parts.join(", ") : "under a month";
}

var STATUS = ["inforce", "lapsed", "verify"];
var PLANS  = ["traditional", "vul"];
var BENEF  = ["revocable", "irrevocable", "unknown"];

// Policies are recorded, not computed. The analysis sizes the cover a plan
// NEEDS; what the client already holds is a fact about the estate, and the two
// are kept apart on purpose.
export function buildPolicies(rows){
  return (rows || []).map(function(r){
    r = r || {};
    var owner = String(r.owner || "").trim();
    return {
      insurer:   String(r.insurer || "").trim(),
      product:   String(r.product || "").trim(),
      owner:     owner,
      insured:   resolveInsured(r.insured, owner),
      inception: isoDate(r.inception),
      status:    pick(r.status, STATUS, "verify"),
      coverage:  money(r.coverage),
      plan:      pick(r.plan, PLANS, "traditional"),
      beneficiary: String(r.beneficiary || "").trim(),
      revocability: pick(r.revocability, BENEF, "unknown")
    };
  }).filter(function(p){
    return p.insurer !== "" || p.product !== "" || p.coverage > 0;   // drop untouched cards
  });
}
