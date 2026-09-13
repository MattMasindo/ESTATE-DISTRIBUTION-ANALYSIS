// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S } from "../state.js";
import { peso, spouseWho, firstName, client } from "../format.js";

/* ---------- succession engine ---------- */
function testate(E){
  var n = S.lc.length, m = S.ilc.length, sp = S.spouse, lp = S.lp.length;
  var g = [], notes = [], cap = null;
  var lcTotal=0, ssShare=0, ilcTotal=0, lpTotal=0, free=0;

  if (n > 0){
    lcTotal = E/2;
    notes.push(["Art. 888", "The " + n + " legitimate child" + (n>1?"ren":"") + " take one half of the estate, divided equally."]);
    var one = E/(2*n);
    if (sp){
      ssShare = (n === 1) ? E/4 : one;
      notes.push(["Art. 892", n === 1
        ? "With a single legitimate child, " + firstName(spouseWho()) + "'s legitime is one fourth of the estate."
        : "With two or more legitimate children, " + firstName(spouseWho()) + " takes a share equal to the legitime of one child."]);
    }
    if (m > 0){
      ilcTotal = m*one/2;
      notes.push(["Art. 895 · F.C. 176", "Each illegitimate child takes one half of the legitime of one legitimate child."]);
    }
    var half = E/2, room = half - ssShare;
    if (ilcTotal > room + 1e-6){
      ilcTotal = Math.max(room, 0);
      cap = "The free half cannot cover every illegitimate child's full legitime. " + firstName(spouseWho())
          + " is satisfied first, then the illegitimate children share what remains, reduced pro rata.";
    }
    free = Math.max(half - ssShare - ilcTotal, 0);
  } else if (lp > 0){
    lpTotal = E/2;
    notes.push(["Art. 889", "With no legitimate children, the legitimate parents take one half of the estate."]);
    if (sp && m > 0){ ssShare = E/8; ilcTotal = E/4;
      notes.push(["Art. 899", "Parents one half, spouse one eighth, illegitimate children one fourth — one eighth stays free."]);
    } else if (sp){ ssShare = E/4;
      notes.push(["Art. 893", "The spouse concurring with legitimate ascendants takes one fourth."]);
    } else if (m > 0){ ilcTotal = E/4;
      notes.push(["Art. 896", "Illegitimate children concurring with legitimate ascendants take one fourth."]);
    }
    free = E - lpTotal - ssShare - ilcTotal;
  } else {
    if (sp && m > 0){ ssShare = E/3; ilcTotal = E/3;
      notes.push(["Art. 894", "Spouse one third, illegitimate children one third, free portion one third."]);
    } else if (sp){ ssShare = E/2;
      notes.push(["Art. 900", "The spouse alone takes one half as legitime."]);
    } else if (m > 0){ ilcTotal = E/2;
      notes.push(["Art. 901", "Illegitimate children alone take one half as legitime."]);
    } else {
      notes.push(["No compulsory heirs", "The whole estate is free — " + client() + " may give it to anyone qualified to receive it."]);
    }
    free = E - ssShare - ilcTotal;
  }

  if (n > 0) g.push({key:"lc", label:"Legitimate children", count:n, total:lcTotal});
  if (lp > 0) g.push({key:"lp", label:"Parents", count:lp, total:lpTotal});
  if (sp) g.push({key:"ss", label:spouseWho(), count:1, total:ssShare});
  if (m > 0) g.push({key:"ilc", label:"Illegitimate children", count:m, total:ilcTotal});
  g.forEach(function(x){ x.each = x.count ? x.total/x.count : 0; });
  return { groups:g, free:Math.max(free,0), notes:notes, cap:cap };
}

function intestate(E){
  var n = S.lc.length, m = S.ilc.length, sp = S.spouse, lp = S.lp.length;
  var g = [], notes = [], cap = null;
  var lcTotal=0, ssShare=0, ilcTotal=0, lpTotal=0;

  if (n > 0){
    var units = n + (sp?1:0) + m*0.5, vu = E/units;
    lcTotal = n*vu; ssShare = sp ? vu : 0; ilcTotal = m*0.5*vu;
    notes.push(["Art. 979 · 996 · 983", "Each legitimate child counts one unit, the spouse one unit, each illegitimate child half a unit. "
      + String(units).replace(/\.0$/,"") + " units in all, at " + peso(vu) + " per unit."]);
    if (lcTotal < E/2 - 1e-6){
      var ssLegit = sp ? ((n === 1) ? E/4 : E/(2*n)) : 0;
      lcTotal = E/2; ssShare = ssLegit; ilcTotal = E - lcTotal - ssShare;
      cap = "The unit method would cut the legitimate children below the one half the law reserves them. Their legitime is restored first, the spouse is paid next, and the illegitimate children divide what is left.";
      notes.push(["Art. 895", "Illegitimate shares reduced so the legitimate children keep their reserved one half."]);
    }
  } else if (lp > 0){
    lpTotal = E/2;
    if (sp && m > 0){ ssShare = E/4; ilcTotal = E/4;
      notes.push(["Art. 1000", "Legitimate parents one half, spouse one fourth, illegitimate children one fourth."]);
    } else if (sp){ ssShare = E/2;
      notes.push(["Art. 997", "Legitimate parents and the spouse divide the estate half and half."]);
    } else if (m > 0){ ilcTotal = E/2;
      notes.push(["Art. 991", "Legitimate ascendants and illegitimate children divide the estate half and half."]);
    } else { lpTotal = E;
      notes.push(["Art. 985", "With no other heirs, the legitimate parents take the whole estate."]);
    }
  } else {
    if (sp && m > 0){ ssShare = E/2; ilcTotal = E/2;
      notes.push(["Art. 998", "The spouse and the illegitimate children divide the estate half and half."]);
    } else if (sp){ ssShare = E;
      notes.push(["Art. 994", "The spouse takes the whole estate, subject to the rights of any surviving brothers and sisters."]);
    } else if (m > 0){ ilcTotal = E;
      notes.push(["Art. 988", "The illegitimate children take the whole estate, divided equally."]);
    } else {
      notes.push(["No legal heirs listed", "The estate passes to collateral relatives, and failing those, to the State."]);
    }
  }

  if (n > 0) g.push({key:"lc", label:"Legitimate children", count:n, total:lcTotal});
  if (lp > 0) g.push({key:"lp", label:"Parents", count:lp, total:lpTotal});
  if (sp) g.push({key:"ss", label:spouseWho(), count:1, total:ssShare});
  if (m > 0) g.push({key:"ilc", label:"Illegitimate children", count:m, total:ilcTotal});
  g.forEach(function(x){ x.each = x.count ? x.total/x.count : 0; });

  notes.push(["No free portion", "Intestacy allocates the entire estate by law. Nothing is left to discretion."]);
  return { groups:g, free:0, notes:notes, cap:cap };
}

export { testate, intestate };
