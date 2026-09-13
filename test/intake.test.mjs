// The hand-off from the fact-find sheet to the analysis.
//
// A renamed field here would not throw — it would silently drop a client's
// spouse or an asset on the way across, and the advisor would not notice until
// the numbers looked odd. These checks exist so that failure is loud.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildIntake, applyIntake, commafyInput, caretAfterDigits,
         buildPolicies, resolveInsured, policyDuration,
         buildBeneficiaries, primaryShare, irrevocableShare, shareNote } from "../src/intake.js";

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

describe("amounts are grouped while they are typed", () => {
  test("thousands are separated so eight figures can be read at a glance", () => {
    assert.equal(commafyInput("12500000"), "12,500,000");
    assert.equal(commafyInput("1250000"), "1,250,000");
    assert.equal(commafyInput("999"), "999");
    assert.equal(commafyInput("1000"), "1,000");
  });

  test("it survives being re-run on its own output", () => {
    assert.equal(commafyInput(commafyInput("12500000")), "12,500,000");
    assert.equal(commafyInput("₱12,500,000"), "12,500,000");
  });

  test("an empty field stays empty rather than becoming a zero", () => {
    assert.equal(commafyInput(""), "");
    assert.equal(commafyInput("abc"), "");
  });

  test("a decimal tail is left exactly as typed", () => {
    assert.equal(commafyInput("1234567.5"), "1,234,567.5");
    assert.equal(commafyInput("1234567."), "1,234,567.");
  });

  test("leading zeros are dropped, but a lone zero is not", () => {
    assert.equal(commafyInput("007"), "7");
    assert.equal(commafyInput("0"), "0");
  });

  test("the caret lands the same number of digits in, not characters in", () => {
    // "12500000" with the caret after 5 digits -> "12,500,000", still after 5 digits
    assert.equal(caretAfterDigits("12,500,000", 5), 6);
    assert.equal(caretAfterDigits("12,500,000", 2), 2);
    assert.equal(caretAfterDigits("12,500,000", 0), 0);
    assert.equal(caretAfterDigits("12,500,000", 99), 10);
  });

  test("a grouped amount still parses back to a number on hand-off", () => {
    const o = buildIntake({ client: "X", married: false, props: [{ name: "Lot", value: commafyInput("12500000") }] });
    assert.equal(o.props[0].value, 12_500_000);
  });
});

describe("existing life insurance", () => {
  test('"same" means the owner, in any casing', () => {
    assert.equal(resolveInsured("same", "Ramon Villanueva"), "Ramon Villanueva");
    assert.equal(resolveInsured("  SAME  ", "Ramon Villanueva"), "Ramon Villanueva");
    assert.equal(resolveInsured("Same", "Ramon"), "Ramon");
  });

  test('"same" with no owner yet is left alone rather than blanked', () => {
    assert.equal(resolveInsured("same", ""), "same");
  });

  test("a real name is never overwritten by the owner", () => {
    assert.equal(resolveInsured("Elena Villanueva", "Ramon Villanueva"), "Elena Villanueva");
    assert.equal(resolveInsured("Samuel", "Ramon"), "Samuel");   // not "same"
  });

  test("duration counts whole months from inception to the given day", () => {
    assert.equal(policyDuration("2019-06-15", "2026-09-13"), "7 years, 2 months");
    assert.equal(policyDuration("2025-09-13", "2026-09-13"), "1 year");
    assert.equal(policyDuration("2026-08-13", "2026-09-13"), "1 month");
    assert.equal(policyDuration("2026-09-01", "2026-09-13"), "under a month");
  });

  test("the month does not tick over until the day of the month is reached", () => {
    assert.equal(policyDuration("2026-08-20", "2026-09-13"), "under a month");
    assert.equal(policyDuration("2026-08-20", "2026-09-20"), "1 month");
  });

  test("a missing or impossible inception date yields nothing, not a guess", () => {
    assert.equal(policyDuration("", "2026-09-13"), "");
    assert.equal(policyDuration("last June", "2026-09-13"), "");
    assert.equal(policyDuration("2027-01-01", "2026-09-13"), "");   // not yet incepted
  });

  test("a policy is recorded with its coverage read as a number", () => {
    const [p] = buildPolicies([{ insurer: "Sun Life", product: "Maxilink Prime", owner: "Ramon",
                                 insured: "same", inception: "2019-06-15", status: "inforce",
                                 coverage: "₱5,000,000", plan: "vul",
                                 beneficiaries: [{ name: "Elena", share: "100", revocability: "irrevocable" }] }]);
    assert.equal(p.insured, "Ramon");
    assert.equal(p.coverage, 5_000_000);
    assert.equal(p.plan, "vul");
    assert.equal(p.beneficiaries[0].revocability, "irrevocable");
  });

  test("an unverified policy stays unverified — nothing is assumed in force", () => {
    const [p] = buildPolicies([{ insurer: "Sun Life", status: "" }]);
    assert.equal(p.status, "verify");
    assert.deepEqual(p.beneficiaries, []);
  });

  test("untouched cards are dropped, but a named policy with no figure is kept", () => {
    const out = buildPolicies([
      { insurer: "Sun Life", coverage: "1000000" },
      { insurer: "", product: "", coverage: "" },
      { product: "An old plan nobody can find", coverage: "" }
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[1].product, "An old plan nobody can find");
  });
});

describe("a policy can name more than one beneficiary", () => {
  const three = () => buildBeneficiaries([
    { name: "Elena", relationship: "Spouse", share: "50", role: "primary", revocability: "irrevocable" },
    { name: "Paolo", relationship: "Son", share: "50", role: "primary", revocability: "revocable" },
    { name: "Isabel", relationship: "Daughter", share: "100", role: "contingent", revocability: "revocable" }
  ]);

  test("each designation stands on its own", () => {
    const b = three();
    assert.equal(b.length, 3);
    assert.equal(b[0].revocability, "irrevocable");
    assert.equal(b[1].revocability, "revocable");   // same policy, different designation
  });

  test("primary shares are totalled; contingents are not", () => {
    assert.equal(primaryShare(three()), 100);
  });

  test("only irrevocable primary shares sit outside the estate", () => {
    assert.equal(irrevocableShare(three()), 50);
  });

  test("a contingent irrevocable share is not counted — it takes nothing yet", () => {
    const b = buildBeneficiaries([{ name: "X", share: "100", role: "contingent", revocability: "irrevocable" }]);
    assert.equal(irrevocableShare(b), 0);
  });

  test("shares that do not total 100 are flagged rather than corrected", () => {
    const b = buildBeneficiaries([{ name: "Elena", share: "60" }, { name: "Paolo", share: "30" }]);
    assert.match(shareNote(b), /90%, not 100%/);
  });

  test("shares that total 100 say nothing at all", () => {
    assert.equal(shareNote(three()), "");
  });

  test("contingents with no primary is its own problem, and named as one", () => {
    const b = buildBeneficiaries([{ name: "Isabel", share: "100", role: "contingent" }]);
    assert.match(shareNote(b), /No primary beneficiary/);
  });

  test("a share above 100 is clamped rather than carried", () => {
    const b = buildBeneficiaries([{ name: "X", share: "150" }]);
    assert.equal(b[0].share, 100);
  });

  test("blank beneficiary lines are dropped", () => {
    const b = buildBeneficiaries([{ name: "Elena", share: "100" }, { name: "", share: "" }, {}]);
    assert.equal(b.length, 1);
  });

  test("a policy with only beneficiaries filled in is still a policy", () => {
    const out = buildPolicies([{ insurer: "", coverage: "", beneficiaries: [{ name: "Elena", share: "100" }] }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].beneficiaries[0].name, "Elena");
  });
});
