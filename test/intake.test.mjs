// The hand-off from the fact-find sheet to the analysis.
//
// A renamed field here would not throw — it would silently drop a client's
// spouse or an asset on the way across, and the advisor would not notice until
// the numbers looked odd. These checks exist so that failure is loud.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildIntake, applyIntake } from "../src/intake.js";

const sheet = (over = {}) => ({
  client: "Juan Dela Cruz",
  clientDob: "1952-04-09",
  married: true,
  spouseName: "Maria Dela Cruz",
  spouseDob: "1958-11-22",
  marriageDate: "1985-02-14",
  prenup: "none",
  lc: [], ilc: [], lp: [], props: [],
  debts: "0", debtOn: "conjugal",
  ...over
});

describe("the fact-find carries the meeting across", () => {
  test("the client, the spouse and the marriage survive intact", () => {
    const o = buildIntake(sheet());
    assert.equal(o.client, "Juan Dela Cruz");
    assert.equal(o.clientDob, "1952-04-09");
    assert.equal(o.spouse, true);
    assert.equal(o.spouseName, "Maria Dela Cruz");
    assert.equal(o.date, "1985-02-14");      // the field the regime turns on
    assert.equal(o.prenup, "none");
  });

  test("names are trimmed and blank lines are not heirs", () => {
    const o = buildIntake(sheet({
      client: "  Juan  ",
      lc: [{ name: "Ana", dob: "1991-02-18" }, { name: "   " }, { name: "", dob: "1990-01-01" }]
    }));
    assert.equal(o.client, "Juan");
    assert.equal(o.lc.length, 1);
    assert.equal(o.lc[0].name, "Ana");
  });

  test("a handwritten peso amount is read as a number", () => {
    const o = buildIntake(sheet({ props: [{ name: "Quezon City", value: "₱10,000,000" }], debts: "1,250,000" }));
    assert.equal(o.props[0].value, 10_000_000);
    assert.equal(o.debts, 1_250_000);
  });

  test("a date that is not a date is dropped rather than carried as junk", () => {
    const o = buildIntake(sheet({ clientDob: "sometime in 1952", lc: [{ name: "Ana", dob: "18/02/1991" }] }));
    assert.equal(o.clientDob, "");
    assert.equal(o.lc[0].dob, "");
  });
});

describe("the sheet is corrected on the way across", () => {
  test("an unmarried client has no conjugal property, whatever the box says", () => {
    const o = buildIntake(sheet({
      married: false,
      props: [{ name: "Condo", value: "5000000", owner: "both" }, { name: "Farm", value: "1000000", owner: "spouse" }]
    }));
    assert.equal(o.spouse, false);
    assert.equal(o.props[0].owner, "client");
    assert.equal(o.props[1].owner, "client");
    assert.equal(o.debtOn, "exclusive");     // there is no community to charge
  });

  test("no spouse means no marriage fields at all", () => {
    const o = buildIntake(sheet({ married: false }));
    assert.equal(o.date, undefined);
    assert.equal(o.prenup, undefined);
    assert.equal(o.spouseName, undefined);
  });

  test("an unrecognised dropdown value falls back rather than poisoning the engine", () => {
    const o = buildIntake(sheet({
      prenup: "whatever",
      props: [{ name: "X", value: "1", owner: "nobody", acq: "somehow", liq: "maybe" }]
    }));
    assert.equal(o.prenup, "none");
    assert.equal(o.props[0].owner, "client");
    assert.equal(o.props[0].acq, "onerous");
    assert.equal(o.props[0].liq, "realty");
  });

  test("empty ruled lines are dropped, but a named asset worth nothing is kept", () => {
    const o = buildIntake(sheet({
      props: [{ name: "Quezon City", value: "1000" }, { name: "", value: "" }, { name: "Disputed lot", value: "0" }]
    }));
    assert.equal(o.props.length, 2);
    assert.equal(o.props[1].name, "Disputed lot");
  });

  test("the engine recognises two parents, so only two are carried", () => {
    const o = buildIntake(sheet({ lp: [{ name: "A" }, { name: "B" }, { name: "C" }] }));
    assert.equal(o.lp.length, 2);
  });

  test("bequests are a planning decision, so everything arrives in the residue", () => {
    const o = buildIntake(sheet({ props: [{ name: "X", value: "1", to: "lc:1" }] }));
    assert.equal(o.props[0].to, "residue");
  });
});

describe("applying an intake to a scenario", () => {
  test("it overwrites what the sheet carried and leaves the rest alone", () => {
    const S = { client: "default", freeTo: "prorata", route: "ejs", props: [{ name: "old" }] };
    applyIntake(S, buildIntake(sheet({ client: "Juan", props: [{ name: "new", value: "1" }] })));
    assert.equal(S.client, "Juan");
    assert.equal(S.props.length, 1);
    assert.equal(S.props[0].name, "new");
    assert.equal(S.freeTo, "prorata");       // untouched by the sheet
    assert.equal(S.route, "ejs");
  });

  test("nothing to apply is not an error", () => {
    const S = { client: "default" };
    assert.equal(applyIntake(S, null), false);
    assert.equal(S.client, "default");
  });
});
