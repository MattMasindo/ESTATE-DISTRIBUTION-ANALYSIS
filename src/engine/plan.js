// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S } from "../state.js";
import { ageAt } from "../format.js";
import { estateRows, roster } from "./assets.js";
import { taxes, DONOR_EXEMPT } from "./tax.js";

function plan(E, t, reg){
  var rows = estateRows(reg), heirs = roster(t), byId = {};
  heirs.forEach(function(h){ byId[h.id] = h; });

  var T = 0, liqTotal = 0;
  rows.forEach(function(r){ T += r.est; if (r.liq) liqTotal += r.est; });

  // Age decides whether an extrajudicial settlement is even open to this family:
  // Rule 74 needs every heir to be of legal age, or a court-appointed guardian.
  heirs.forEach(function(h){
    h.age = ageAt(h.dob, S.deathDate);
    h.isMinor = h.age !== null && h.age < 18;
    h.yearsToMajority = h.isMinor ? 18 - h.age : 0;
  });
  var minors = heirs.filter(function(h){ return h.isMinor; });

  var sumL = heirs.reduce(function(a,h){ return a + h.legitime; }, 0);
  heirs.forEach(function(h){
    // Fair share: what this heir would take if the free portion followed the
    // legitimes instead of being singled out. The whole estate, no gifts.
    h.base = sumL > 0 ? E * h.legitime/sumL : (heirs.length ? E/heirs.length : 0);
    h.assigned = 0; h.assignedLiq = 0; h.gifts = [];
  });

  rows.forEach(function(r){
    var h = byId[r.to];
    if (h){ h.assigned += r.est; if (r.liq) h.assignedLiq += r.est; h.gifts.push(r.name || "Unnamed asset"); }
    else r.to = "residue";
  });

  var assignedTotal = 0, assignedLiq = 0;
  heirs.forEach(function(h){ assignedTotal += h.assigned; assignedLiq += h.assignedLiq; });

  var residue = E - assignedTotal;
  var over = residue < -0.5;
  if (residue < 0) residue = 0;
  var resLiq = Math.max(0, liqTotal - assignedLiq - S.debts);

  // A gift is charged against the free portion FIRST, never against a
  // co-heir's legitime (Arts. 909-911). So the residue tops every heir up to
  // their legitime before a single peso of it counts as free.
  var unmet = 0;
  heirs.forEach(function(h){ h.unmet = Math.max(0, h.legitime - h.assigned); unmet += h.unmet; });
  var freePool = 0;
  if (residue >= unmet - 1e-6){
    heirs.forEach(function(h){ h.fromLegitime = h.unmet; });
    freePool = residue - unmet;
  } else {
    // genuinely not enough to go round — this is the impairment case
    heirs.forEach(function(h){ h.fromLegitime = unmet > 0 ? residue * h.unmet/unmet : 0; });
  }

  // Whatever is left is the free portion, and the will says where it goes.
  var freeTo = S.freeTo || "prorata", freeOutside = 0;
  heirs.forEach(function(h){ h.fromFree = 0; });
  if (freePool > 0.005){
    if (freeTo === "outside") freeOutside = freePool;
    else if (byId[freeTo]) byId[freeTo].fromFree = freePool;
    else heirs.forEach(function(h){
      h.fromFree = sumL > 0 ? freePool*h.legitime/sumL : (heirs.length ? freePool/heirs.length : 0);
    });
  }

  heirs.forEach(function(h){
    h.resShare = h.fromLegitime + h.fromFree;
    h.receives = h.assigned + h.resShare;
    h.cash = h.assignedLiq + (residue > 0 ? h.resShare * (resLiq/residue) : 0);
    h.property = Math.max(h.receives - h.cash, 0);
    h.gap = h.receives - h.base;
    h.shortBase = Math.max(h.base - h.receives, 0);
    h.shortLegitime = Math.max(h.legitime - h.receives, 0);
    // the most this heir could ever take: their own floor plus the whole free portion
    h.ceiling = h.legitime + (E - sumL);
  });

  // ---- an heir who refuses their share ----
  // A waiver naming a specific person is a donation in the BIR's eyes.
  // A plain repudiation, where the share simply accrues to the co-heirs, is not.
  var donorsTax = 0, waivers = [];
  heirs.forEach(function(h){
    h.waive = S.waive[h.id] || "accept";
    h.donorsTax = 0; h.gained = 0; h.gainedCash = 0; h.gave = 0;
    h.wouldOwe = Math.max(0, h.receives - DONOR_EXEMPT) * 0.06;
  });
  heirs.forEach(function(d){
    if (d.waive === "accept" || d.waive === "repudiate") return;
    var r = byId[d.waive];
    if (!r || r === d){ d.waive = "accept"; return; }
    d.gave = d.receives;
    r.gained += d.receives; r.gainedCash += d.cash;
    d.donorsTax = Math.max(0, d.receives - DONOR_EXEMPT) * 0.06;
    donorsTax += d.donorsTax;
    waivers.push({ from:d, to:r, amount:d.receives, tax:d.donorsTax, targeted:true });
    d.receives = 0; d.cash = 0;
  });
  var pool = 0, poolCash = 0;
  heirs.forEach(function(d){
    if (d.waive !== "repudiate") return;
    d.gave = d.receives; pool += d.receives; poolCash += d.cash;
    waivers.push({ from:d, to:null, amount:d.receives, tax:0, targeted:false });
    d.receives = 0; d.cash = 0;
  });
  if (pool > 0){
    var acc = heirs.filter(function(h){ return h.waive === "accept"; });
    var accL = acc.reduce(function(a,h){ return a + h.legitime; }, 0);
    acc.forEach(function(h){
      var sh = accL > 0 ? pool*h.legitime/accL : (acc.length ? pool/acc.length : 0);
      h.gained += sh; h.gainedCash += poolCash * (sh/pool);
    });
  }
  heirs.forEach(function(h){
    h.receives += h.gained; h.cash += h.gainedCash;
    h.property = Math.max(h.receives - h.cash, 0);
    h.gap = h.receives - h.base;
    // someone who gave their share away is not "short" — they chose it
    h.shortBase = h.waive === "accept" ? Math.max(h.base - h.receives, 0) : 0;
    h.shortLegitime = h.waive === "accept" ? Math.max(h.legitime - h.receives, 0) : 0;
  });

  var X = taxes(reg);
  var cashNeed = S.debts + X.chosen + donorsTax + S.otherCash;
  var equalize = 0, impaired = 0, impairedCount = 0;
  heirs.forEach(function(h){
    equalize += h.shortBase; impaired += h.shortLegitime;
    if (h.shortLegitime > 0.5) impairedCount++;
  });
  var liqShort = Math.max(cashNeed - liqTotal, 0);

  return { rows:rows, heirs:heirs, T:T, liqTotal:liqTotal, illiqTotal:T-liqTotal,
           assignedTotal:assignedTotal, residue:residue, over:over,
           cashNeed:cashNeed, liqShort:liqShort, cashLeft:Math.max(liqTotal-cashNeed,0),
           equalize:equalize, impaired:impaired, impairedCount:impairedCount,
           coverage:equalize + liqShort, anyGift:assignedTotal > 0.5,
           tax:X, donorsTax:donorsTax, waivers:waivers,
           freePool:freePool, freeTo:freeTo, freeOutside:freeOutside, sumL:sumL, floorTotal:sumL,
           minors:minors, hasMinor:minors.length > 0,
           clientAge: ageAt(S.clientDob, S.deathDate) };
}

export { plan };
