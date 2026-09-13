// Regression suite for the succession, tax and planning engine.
//
// Every case here was checked by hand against the Civil Code, the Family Code
// and the TRAIN Law before it was written down. If one of these fails, the law
// has not changed — the code has.

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { S } from "../src/state.js";
import { regime, classify, totals, liquidate } from "../src/engine/regime.js";
import { testate, intestate } from "../src/engine/succession.js";
import { gradTax, taxes } from "../src/engine/tax.js";
import { plan } from "../src/engine/plan.js";

const M = 1_000_000;
const peso = (a, b, msg) => assert.ok(Math.abs(a - b) < 1, `${msg}: got ${Math.round(a).toLocaleString()}, want ${Math.round(b).toLocaleString()}`);

const BASE = {
  client: "Juan", spouseName: "Maria", spouse: true, date: "1985-02-14", prenup: "none",
  debts: 0, debtOn: "conjugal", otherCash: 0, freeTo: "prorata",
  coverMode: "auto", coverAmount: 0,
  citizen: "resident", familyHome: -1, monthsLate: 0, route: "ejs",
  deathDate: "2026-09-12", funeral: 0, medical: 0, judicial: 0,
  rTransfer: 0.75, rReg: 0.5, rNotarial: 1.5, rExecutor: 5, pub: 10000, waive: {},
  props: [], lc: [], ilc: [], lp: []
};

function setup(over = {}) {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, structuredClone(BASE), structuredClone(over));
  const reg = regime();
  const L = liquidate();
  const t = testate(L.estate);
  return { reg, L, E: L.estate, t, i: intestate(L.estate), P: plan(L.estate, t, reg) };
}
const heir = (P, name) => P.heirs.find(h => h.name === name);
const grp = (r, key) => { const g = r.groups.find(x => x.key === key); return g ? g.total : 0; };

// A single asset owned outright by the client, so the estate equals its value.
const solo = (value, extra = {}) =>
  [{ name: "Estate", value, owner: "client", acq: "gratuitous", liq: "liquid", to: "residue", ...extra }];

// The worked example carried through the whole build.
const SLIDE = [
  { name: "Quezon City",   value: 10 * M,  owner: "client", acq: "before",     liq: "realty", to: "residue" },
  { name: "Marikina",      value: 3 * M,   owner: "client", acq: "before",     liq: "realty", to: "residue" },
  { name: "Taguig",        value: 5 * M,   owner: "both",   acq: "onerous",    liq: "realty", to: "residue" },
  { name: "Makati Home",   value: 9 * M,   owner: "both",   acq: "onerous",    liq: "realty", to: "residue" },
  { name: "Bulacan",       value: 4 * M,   owner: "spouse", acq: "gratuitous", liq: "realty", to: "residue" },
  { name: "Bank",          value: 2 * M,   owner: "both",   acq: "onerous",    liq: "liquid", to: "residue" },
  { name: "Philequity",    value: 1.5 * M, owner: "both",   acq: "onerous",    liq: "liquid", to: "residue" }
];

describe("property regime", () => {
  test("date of marriage picks the default regime", () => {
    assert.equal(setup({ date: "1985-02-14" }).reg, "cpg", "before 3 Aug 1988");
    assert.equal(setup({ date: "2005-06-18" }).reg, "acp", "on or after 3 Aug 1988");
    assert.equal(setup({ spouse: false }).reg, "none", "unmarried");
  });

  test("a pre-nuptial agreement overrides the date", () => {
    assert.equal(setup({ date: "2005-06-18", prenup: "cpg" }).reg, "cpg");
    assert.equal(setup({ date: "1985-02-14", prenup: "acp" }).reg, "acp");
    assert.equal(setup({ prenup: "sep" }).reg, "sep");
  });

  test("CPG: pre-marital property is exclusive, its fruits are conjugal", () => {
    assert.equal(classify({ acq: "before" }, "cpg"), "exclusive");
    assert.equal(classify({ acq: "fruits" }, "cpg"), "shared", "Family Code Art. 117");
    assert.equal(classify({ acq: "onerous" }, "cpg"), "shared");
    assert.equal(classify({ acq: "gratuitous" }, "cpg"), "exclusive");
  });

  test("ACP: pre-marital property joins the community, gratuitous title escapes with its fruits", () => {
    assert.equal(classify({ acq: "before" }, "acp"), "shared");
    assert.equal(classify({ acq: "gratuitous" }, "acp"), "exclusive", "Family Code Art. 92");
    assert.equal(classify({ acq: "fruits" }, "acp"), "exclusive");
  });

  test("complete separation shares nothing", () => {
    ["before", "onerous", "gratuitous", "fruits"].forEach(a =>
      assert.equal(classify({ acq: a }, "sep"), "exclusive"));
  });

  test("the same schedule under three regimes", () => {
    const cpg = setup({ props: SLIDE });
    peso(totals().conj, 17.5 * M, "CPG conjugal pot");
    peso(cpg.E, 21.75 * M, "CPG net distributable estate");
    peso(cpg.L.spouseOwn, 12.75 * M, "Maria retains her half plus her own");

    const acp = setup({ props: SLIDE, date: "2005-06-18" });
    peso(totals().conj, 30.5 * M, "ACP community pot absorbs the pre-marital property");
    peso(acp.E, 15.25 * M, "ACP net distributable estate");

    const sep = setup({ props: SLIDE, prenup: "sep" });
    peso(totals().conj, 0, "nothing shared under separation");
    peso(sep.E, 21.75 * M, "separation estate");
  });
});

describe("liquidation and debts", () => {
  test("the spouse's exclusive property never enters the estate", () => {
    const r = setup({ props: SLIDE });
    peso(r.L.exs, 4 * M, "her own property");
    peso(r.E + r.L.spouseOwn, 34.5 * M, "estate plus what she retains is the whole schedule");
  });

  test("a conjugal debt halves the spouse's share with it", () => {
    const r = setup({ props: SLIDE, debts: 5 * M, debtOn: "conjugal" });
    peso(r.L.dConj, 5 * M, "charged to the shared pot");
    peso(r.L.netConj / 2, 6.25 * M, "her half of what is left");
  });

  test("the client's own debt leaves the spouse's half untouched", () => {
    const r = setup({ props: SLIDE, debts: 5 * M, debtOn: "exclusive" });
    peso(r.L.dExd, 5 * M, "charged to his exclusive property");
    peso(r.L.netConj / 2, 8.75 * M, "her half of the full pot");
  });

  test("a debt larger than its bucket spills into the other", () => {
    const r = setup({ props: SLIDE, debts: 20 * M, debtOn: "exclusive" });
    peso(r.L.dExd, 13 * M, "fills his exclusive property first");
    peso(r.L.dConj, 7 * M, "the rest hits the conjugal pot");
  });
});

describe("legitimes — the floors", () => {
  test("Art. 888: legitimate children take one half, divided equally", () => {
    const { t } = setup({ props: solo(30 * M), lc: ["A", "B", "C"], spouse: false });
    peso(grp(t, "lc"), 15 * M, "the group's half");
    peso(t.groups.find(g => g.key === "lc").each, 5 * M, "each child");
  });

  test("Art. 892: the spouse's legitime beside legitimate children", () => {
    peso(grp(setup({ props: solo(30 * M), lc: ["A"] }).t, "ss"), 7.5 * M, "one child — one fourth");
    peso(grp(setup({ props: solo(30 * M), lc: ["A", "B"] }).t, "ss"), 7.5 * M, "two or more — a child's share");
  });

  test("Art. 895: an illegitimate child takes half a legitimate child's legitime", () => {
    const { t } = setup({ props: solo(30 * M), lc: ["A", "B", "C"], ilc: ["D", "E"] });
    peso(t.groups.find(g => g.key === "ilc").each, 2.5 * M, "each illegitimate child");
    peso(t.groups.find(g => g.key === "lc").each, 5 * M, "each legitimate child");
  });

  test("no legitimate children: parents, spouse and illegitimate children", () => {
    const a = setup({ props: solo(30 * M), lp: ["F", "M"], spouse: false }).t;
    peso(grp(a, "lp"), 15 * M, "Art. 889 — parents one half");
    const b = setup({ props: solo(30 * M), lp: ["F", "M"] }).t;
    peso(grp(b, "ss"), 7.5 * M, "Art. 893 — spouse one fourth");
    const c = setup({ props: solo(30 * M), lp: ["F", "M"], ilc: ["D"] }).t;
    peso(grp(c, "ss"), 3.75 * M, "Art. 899 — spouse one eighth");
    peso(grp(c, "ilc"), 7.5 * M, "Art. 899 — illegitimate children one fourth");
    const d = setup({ props: solo(30 * M), ilc: ["D"] }).t;
    peso(grp(d, "ss"), 10 * M, "Art. 894 — spouse one third");
    peso(d.free, 10 * M, "Art. 894 — free portion one third");
  });

  test("the spouse is paid before the illegitimate children out of the free half", () => {
    const { t } = setup({ props: solo(30 * M), lc: ["A"], ilc: ["D", "E", "F", "G"] });
    peso(grp(t, "lc"), 15 * M, "the legitimate child keeps its half");
    peso(grp(t, "ss"), 7.5 * M, "the spouse is satisfied first");
    peso(grp(t, "ilc"), 7.5 * M, "the illegitimate children divide what is left");
    peso(t.free, 0, "nothing free remains");
  });
});

describe("intestate succession", () => {
  test("Art. 996 and 983: one unit a child, one the spouse, half an illegitimate child", () => {
    const { i } = setup({ props: solo(30 * M), lc: ["A", "B", "C"], ilc: ["D", "E"] });
    peso(grp(i, "lc"), 18 * M, "three children at 6M");
    peso(grp(i, "ss"), 6 * M, "the spouse");
    peso(grp(i, "ilc"), 6 * M, "two illegitimate children at 3M");
    peso(i.free, 0, "intestacy leaves no free portion");
  });

  test("the legitimate children's half survives the unit method", () => {
    const { i } = setup({ props: solo(30 * M), lc: ["A"], ilc: ["D", "E", "F", "G"] });
    peso(grp(i, "lc"), 15 * M, "restored to the reserved half");
    peso(grp(i, "ss"), 7.5 * M, "the spouse takes its legitime");
    peso(grp(i, "ilc"), 7.5 * M, "the illegitimate children share the remainder");
  });

  test("without descendants", () => {
    peso(grp(setup({ props: solo(30 * M), lp: ["F", "M"] }).i, "ss"), 15 * M, "Art. 997 — half each with parents");
    peso(grp(setup({ props: solo(30 * M), ilc: ["D"] }).i, "ss"), 15 * M, "Art. 998 — half each with illegitimate children");
    peso(grp(setup({ props: solo(30 * M), lp: ["F", "M"], ilc: ["D"] }).i, "lp"), 15 * M, "Art. 1000 — parents one half");
  });
});

describe("the free portion — the ceiling", () => {
  // Estate 10M, one legitimate and one illegitimate child.
  const shape = { props: solo(10 * M), lc: ["Legit"], ilc: ["Illegit"], spouse: false };

  test("the floors", () => {
    const { t } = setup(shape);
    peso(t.groups.find(g => g.key === "lc").each, 5 * M, "legitimate child");
    peso(t.groups.find(g => g.key === "ilc").each, 2.5 * M, "illegitimate child");
    peso(t.free, 2.5 * M, "free portion");
  });

  test("directed to the illegitimate child, the two children tie at the ceiling", () => {
    const { P } = setup({ ...shape, freeTo: "ilc:0" });
    peso(heir(P, "Legit").receives, 5 * M, "the legitimate child keeps its floor");
    peso(heir(P, "Illegit").receives, 5 * M, "legitime plus the whole free portion");
    peso(P.impaired, 0, "entirely legal");
  });

  test("a gift is charged against the free portion, not a co-heir's legitime", () => {
    const gift = setup({ ...shape, props: [
      { name: "Rest", value: 5 * M, owner: "client", acq: "gratuitous", liq: "liquid", to: "residue" },
      { name: "Gift", value: 5 * M, owner: "client", acq: "gratuitous", liq: "liquid", to: "ilc:0" }] });
    peso(heir(gift.P, "Legit").receives, 5 * M, "floor intact");
    peso(gift.P.impaired, 0, "no impairment at the ceiling");
  });

  test("one peso past the ceiling breaches the floor", () => {
    const over = setup({ ...shape, props: [
      { name: "Rest", value: 5 * M - 1000, owner: "client", acq: "gratuitous", liq: "liquid", to: "residue" },
      { name: "Gift", value: 5 * M + 1000, owner: "client", acq: "gratuitous", liq: "liquid", to: "ilc:0" }] });
    peso(over.P.impaired, 1000, "impairment flagged to the peso");
  });

  test("directed outside the family, the heirs keep only their legitimes", () => {
    const { P } = setup({ ...shape, freeTo: "outside" });
    peso(heir(P, "Legit").receives, 5 * M, "floor only");
    peso(heir(P, "Illegit").receives, 2.5 * M, "floor only");
    peso(P.freeOutside, 2.5 * M, "leaves the family");
  });

  test("undirected, the free portion follows the legitimes", () => {
    const { P } = setup(shape);
    peso(heir(P, "Legit").receives, 10 * M * (5 / 7.5), "pro rata");
    peso(heir(P, "Illegit").receives, 10 * M * (2.5 / 7.5), "pro rata");
  });
});

describe("estate tax", () => {
  const shape = { props: SLIDE, familyHome: 3, lc: ["A", "B", "C"], ilc: ["D", "E"] };

  test("TRAIN applies from 1 January 2018", () => {
    assert.equal(setup({ ...shape, deathDate: "2018-01-01" }).P.tax.mode, "train");
    assert.equal(setup({ ...shape, deathDate: "2017-12-31" }).P.tax.mode, "pre");
  });

  test("the graduated table used before TRAIN", () => {
    peso(gradTax(200_000), 0, "exempt");
    peso(gradTax(500_000), 15_000, "5% band");
    peso(gradTax(2 * M), 135_000, "8% band");
    peso(gradTax(5 * M), 465_000, "11% band");
    peso(gradTax(10 * M), 1_215_000, "15% band");
    peso(gradTax(20 * M), 3_215_000, "20% band");
  });

  test("the family home deduction is the client's interest, not the house", () => {
    const X = setup(shape).P.tax;
    peso(X.fhDeduction, 4.5 * M, "half of the 9M conjugal home");
    const big = setup({ ...shape, props: SLIDE.map(p => p.name === "Makati Home" ? { ...p, value: 30 * M } : p) });
    peso(big.P.tax.fhDeduction, 10 * M, "capped at 10M when the interest exceeds it");
  });

  test("the ledger, end to end", () => {
    const X = setup(shape).P.tax;
    peso(X.gross, 30.5 * M, "exclusive property plus the whole conjugal pot");
    peso(X.spouseShare, 8.75 * M, "the spouse's conjugal half comes back out");
    peso(X.netTaxable, 12.25 * M, "net taxable estate");
    peso(X.tax, 735_000, "6%");
  });

  test("gross less the spouse's share is the net distributable estate", () => {
    const r = setup(shape);
    peso(r.P.tax.gross - r.P.tax.spouseShare, r.E, "the two panels reconcile");
  });

  test("the pre-TRAIN rules cost this estate far more", () => {
    const X = setup({ ...shape, deathDate: "2017-06-01" }).P.tax;
    peso(X.std, 1 * M, "standard deduction was 1M");
    peso(X.fhDeduction, 1 * M, "family home capped at 1M");
    peso(X.tax, 3_165_000, "graduated tax");
    peso(X.saved, 2_430_000, "what TRAIN saves");
  });

  test("funeral, medical and judicial expenses — deductible only before TRAIN", () => {
    const pre = setup({ ...shape, deathDate: "2017-06-01", funeral: 500_000, medical: 800_000, judicial: 300_000 }).P.tax;
    peso(pre.active.extras[0][1], 200_000, "funeral capped at 200k");
    peso(pre.active.extras[2][1], 500_000, "medical capped at 500k");
    peso(pre.active.extraTotal, 1 * M, "all three");
    const train = setup({ ...shape, funeral: 500_000, medical: 800_000, judicial: 300_000 }).P.tax;
    peso(train.netTaxable, 12.25 * M, "TRAIN ignores them entirely");
  });

  test("late filing adds a surcharge and interest", () => {
    const X = setup({ ...shape, monthsLate: 6 }).P.tax;
    peso(X.surcharge, 735_000 * 0.25, "25% surcharge");
    peso(X.interest, 735_000 * 0.06, "12% a year, for six months");
  });

  test("the filing deadline moves with the regime", () => {
    assert.equal(setup({ ...shape, deathDate: "2026-03-15" }).P.tax.due.toISOString().slice(0, 10), "2027-03-15", "TRAIN: one year");
    assert.equal(setup({ ...shape, deathDate: "2017-03-15" }).P.tax.due.toISOString().slice(0, 10), "2017-09-15", "before TRAIN: six months");
  });
});

describe("settlement costs", () => {
  const shape = { props: SLIDE, familyHome: 3, lc: ["A", "B", "C"], ilc: ["D", "E"] };

  test("extrajudicial settlement is cheaper than probate", () => {
    const X = setup(shape).P.tax;
    peso(X.executor, 1_525_000, "5% of the gross estate");
    peso(X.notarial, 457_500, "1.5% of the gross estate");
    peso(X.jud, 2_520_000, "judicial total");
    peso(X.ejs, 1_452_500, "extrajudicial total");
  });

  test("the route chosen drives the cash the family must find", () => {
    peso(setup(shape).P.cashNeed, 1_452_500, "extrajudicial");
    peso(setup({ ...shape, route: "judicial" }).P.cashNeed, 2_520_000, "judicial");
  });
});

describe("liquidity and the equalizer", () => {
  const shape = {
    props: SLIDE.map(p => p.name === "Quezon City" ? { ...p, to: "lc:1" } : p),
    familyHome: 3, lc: ["Juan Jr.", "Ana", "Miguel"], ilc: ["Carlo", "Beatriz"]
  };

  test("only the liquid assets can actually pay anything", () => {
    const { P } = setup(shape);
    peso(P.liqTotal, 1.75 * M, "half the bank account and half the fund");
    peso(P.illiqTotal, 20 * M, "everything else is property");
  });

  // The gift is charged against Ana's own legitime first, so she takes no further
  // share of the residue while her co-heirs are still below their floors.
  test("a specific gift moves value without touching the total", () => {
    const { P, E } = setup(shape);
    peso(heir(P, "Ana").receives, 10 * M, "the house, and nothing more from the residue");
    peso(heir(P, "Juan Jr.").receives, 2_937_500, "his share of what is left");
    peso(heir(P, "Carlo").receives, 1_468_750, "half a legitimate child's share of it");
    peso(P.heirs.reduce((s, h) => s + h.receives, 0), E, "the estate still adds up");
  });

  test("what the favoured heir gains, the others lose", () => {
    const { P } = setup(shape);
    peso(P.heirs.reduce((s, h) => s + h.gap, 0), 0, "the gaps cancel");
    peso(P.equalize, 5_650_000, "the equalization need");
  });

  test("the legal minimum is smaller than full equalization", () => {
    const { P } = setup(shape);
    peso(P.impaired, 2_750_000, "restoring the impaired legitimes");
    assert.ok(P.impaired < P.equalize, "the legal floor is cheaper than fairness");
  });

  test("a cash shortfall adds itself to the coverage", () => {
    const ejs = setup(shape);
    peso(ejs.P.liqShort, 0, "extrajudicial: the cash covers settlement");
    const jud = setup({ ...shape, route: "judicial" });
    peso(jud.P.liqShort, 770_000, "judicial: it does not");
    peso(jud.P.coverage, 5_650_000 + 770_000, "coverage rises by the gap");
  });
});

describe("an heir who refuses their share", () => {
  const shape = {
    props: SLIDE.map(p => p.name === "Quezon City" ? { ...p, to: "lc:1" } : p),
    lc: ["Juan Jr.", "Ana", "Miguel"], ilc: ["Carlo", "Beatriz"]
  };

  test("a waiver to a named person is a donation", () => {
    const { P } = setup({ ...shape, waive: { "lc:0": "lc:1" } });
    peso(heir(P, "Juan Jr.").receives, 0, "he receives nothing");
    peso(heir(P, "Juan Jr.").donorsTax, (2_937_500 - 250_000) * 0.06, "6% above 250k");
    peso(P.donorsTax, 161_250, "and the family must find it in cash");
  });

  test("a plain repudiation is not", () => {
    const { P, E } = setup({ ...shape, waive: { "lc:0": "repudiate" } });
    peso(P.donorsTax, 0, "no donor's tax");
    peso(heir(P, "Miguel").receives, 2_937_500 + 734_375, "the share accrues to the co-heirs");
    peso(P.heirs.reduce((s, h) => s + h.receives, 0), E, "nothing leaves the estate");
  });

  test("the standing warning is priced even when nobody has waived", () => {
    const { P } = setup(shape);
    peso(heir(P, "Juan Jr.").wouldOwe, 161_250, "what it would cost him");
    peso(P.donorsTax, 0, "but nothing is owed yet");
  });

  test("no insurance is recommended for an heir who gave their share away", () => {
    const { P } = setup({ ...shape, waive: { "lc:0": "lc:1" } });
    peso(heir(P, "Juan Jr.").shortBase, 0, "he chose it");
  });
});
