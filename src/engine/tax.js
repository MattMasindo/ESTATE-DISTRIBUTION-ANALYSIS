// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S } from "../state.js";
import { totals, debtSplit } from "./regime.js";
import { estateRows } from "./assets.js";

/* ---------- estate tax, settlement costs, donor's tax ---------- */
var STD_DEDUCTION = 5000000, FH_CAP = 10000000, DONOR_EXEMPT = 250000;
var TRAIN_START = Date.UTC(2018,0,1);

// Pre-TRAIN allowances (deaths before 1 January 2018)
var OLD_STD = 1000000, OLD_FH_CAP = 1000000, OLD_MEDICAL_CAP = 500000, OLD_FUNERAL_CAP = 200000;

function taxRegime(){
  var d = Date.parse(S.deathDate);
  return (isNaN(d) || d >= TRAIN_START) ? "train" : "pre";
}

// The old graduated table, Sec. 84 of the NIRC before RA 10963
function gradTax(net){
  if (net <= 200000) return 0;
  if (net <= 500000) return (net - 200000) * 0.05;
  if (net <= 2000000) return 15000 + (net - 500000) * 0.08;
  if (net <= 5000000) return 135000 + (net - 2000000) * 0.11;
  if (net <= 10000000) return 465000 + (net - 5000000) * 0.15;
  return 1215000 + (net - 10000000) * 0.20;
}

function dueDate(mode){
  var d = Date.parse(S.deathDate);
  if (isNaN(d)) return null;
  var due = new Date(d);
  due.setMonth(due.getMonth() + (mode === "train" ? 12 : 6));
  return due;
}

function taxes(reg){
  var t = totals();
  // The gross estate is the client's exclusive property plus the WHOLE
  // community / conjugal pot. The spouse's own exclusive property stays out.
  var gross = t.exd + t.conj;

  var D = debtSplit(t);
  var netConj = t.conj - D.conj;
  var spouseShare = S.spouse ? netConj/2 : 0;

  // Family home: the CLIENT's interest in it, capped at 10M — not the whole house.
  var fhRow = null, fhInterest = 0;
  var rows = estateRows(reg);
  rows.forEach(function(r){ if (r.i === S.familyHome){ fhRow = r; fhInterest = r.est; } });

  var ordinary = Math.min(S.debts, gross);

  // --- both rulebooks, so the difference can be shown ---
  function run(mode){
    var std, fh, extras = [], extraTotal = 0;
    if (mode === "train"){
      std = STD_DEDUCTION;
      fh = Math.min(fhInterest, FH_CAP);
    } else {
      std = OLD_STD;
      fh = Math.min(fhInterest, OLD_FH_CAP);
      // funeral: actual, capped at 5% of the gross estate and at P200,000
      var fun = Math.min(S.funeral, gross * 0.05, OLD_FUNERAL_CAP);
      var med = Math.min(S.medical, OLD_MEDICAL_CAP);
      var jud = S.judicial;
      extras = [["Funeral expenses", fun, "Actual, capped at 5% of the gross estate and at ₱200,000"],
                ["Judicial expenses", jud, "Settlement proceedings"],
                ["Medical expenses", med, "Within one year of death, capped at ₱500,000"]];
      extraTotal = fun + med + jud;
    }
    var net = Math.max(gross - ordinary - extraTotal - std - fh - spouseShare, 0);
    var t = mode === "train" ? net * 0.06 : gradTax(net);
    return { mode:mode, std:std, fh:fh, extras:extras, extraTotal:extraTotal, netTaxable:net, tax:t };
  }

  var mode = taxRegime();
  var trainRun = run("train"), preRun = run("pre");
  var active = mode === "train" ? trainRun : preRun;

  var std = active.std, fhDed = active.fh;
  var netTaxable = active.netTaxable, tax = active.tax;

  var surcharge = 0, interest = 0;
  if (S.monthsLate > 0){
    surcharge = tax * 0.25;
    interest = tax * 0.12 * (S.monthsLate/12);
  }
  var taxTotal = tax + surcharge + interest;

  var realty = 0;
  rows.forEach(function(r){ if (r.kind === "realty") realty += r.est; });

  var transfer = realty * S.rTransfer/100;
  var registration = realty * S.rReg/100;
  var notarial = gross * S.rNotarial/100;
  var executor = gross * S.rExecutor/100;

  var ejs = taxTotal + notarial + S.pub + transfer + registration;
  var jud = taxTotal + executor + S.pub + transfer + registration;

  return { gross:gross, ordinary:ordinary, std:std, fhRow:fhRow,
           mode:mode, active:active, trainRun:trainRun, preRun:preRun,
           saved: preRun.tax - trainRun.tax, due:dueDate(mode),
           fhInterest:fhInterest, fhDeduction:fhDed, spouseShare:spouseShare, exs:t.exs,
           conj:t.conj, exd:t.exd, netConj:netConj, dConj:D.conj, dExd:D.exd,
           spouseKeeps:spouseShare + t.exs,
           netTaxable:netTaxable, tax:tax, surcharge:surcharge, interest:interest,
           taxTotal:taxTotal, effective: gross > 0 ? tax/gross*100 : 0,
           realty:realty, transfer:transfer, registration:registration,
           notarial:notarial, executor:executor, pub:S.pub,
           ejs:ejs, jud:jud, chosen: S.route === "ejs" ? ejs : jud };
}

export { STD_DEDUCTION, FH_CAP, DONOR_EXEMPT, TRAIN_START, OLD_STD, OLD_FH_CAP,
       OLD_MEDICAL_CAP, OLD_FUNERAL_CAP, taxRegime, gradTax, dueDate, taxes };
