# Philippine Estate Distribution Calculator

An estate-planning tool for Philippine succession. Enter a client's properties and
heirs; it computes the compulsory legitimes, the intestate shares, the estate tax,
the cost of settlement, and the life insurance needed to balance an uneven plan —
then prints a client-facing one-pager.

Built for **Battle River** by Matthew Isaiah Masindo, Certified Trust and Estate Planner.

---

## What it does

| | |
|---|---|
| **Property regime** | Derives Conjugal Partnership of Gains or Absolute Community from the date of marriage (3 August 1988), or from a pre-nuptial agreement. Classifies each asset by how it was acquired. |
| **Succession** | Legitimes under a will, and intestate shares without one, side by side. Covers spouse, legitimate children, illegitimate children and parents. |
| **Estate tax** | TRAIN Law, and the pre-2018 graduated table, chosen by the date of death. Standard deduction, family home, the spouse's net conjugal share, late-filing penalties. |
| **Settlement cost** | Judicial versus extrajudicial, with the donor's tax trap when an heir waives a share to a named person. |
| **Liquidity** | Cash against what settlement actually needs, and what each heir receives in cash versus a claim on property. |
| **The equalizer** | Sizes the life insurance that closes the gap when a specific gift leaves the other heirs short. |

Everything runs in the browser. No account, no server, nothing leaves the page.

---

## Run it locally

```bash
npm start            # serves on http://localhost:5173
```

Any static server works — the app is plain ES modules with no build step. It must
be served over HTTP, not opened as a `file://` URL, because browsers block module
imports from the filesystem.

## Test it

```bash
npm test
```

44 checks over the succession, tax and planning engine. Every case was verified by
hand against the Civil Code, the Family Code and the TRAIN Law before it was
written down. **If one fails, the law has not changed — the code has.**

---

## Deploy to GitHub Pages

Already wired. Push to `main` and `.github/workflows/deploy.yml` runs the test
suite, then publishes. One-time setup:

1. **Settings → Pages → Source: GitHub Actions**
2. Push to `main`.

The site goes live at `https://<user>.github.io/<repo>/`. There is no build step,
so what you push is what serves.

---

## Optional: saved client cases with Supabase

Off by default. The calculator is fully functional without it.

1. Create a project at supabase.com.
2. Open the SQL editor and run `supabase/migrations/0001_init.sql`.
3. Paste the Project URL and anon key from **Settings → API** into `config.js`.

A sign-in bar then appears in the header: advisors get a magic-link login and can
save, reopen and edit their own cases.

**On the anon key.** It is designed to be public — row-level security is what
protects the data, which is why the migration enables RLS before it creates
anything else. Each advisor can read and write only rows they own. Satisfy
yourself that the policies are right before you put real client data in it.

**On client data.** Names, property values and family structure are sensitive.
Consider whether they belong in a cloud database at all, who on your team can
reach the Supabase dashboard, and what your obligations are under the Data
Privacy Act. Left unconfigured, nothing is stored anywhere.

---

## Layout

```
index.html              markup and layout
config.js               Supabase credentials — null means local-only
src/
  state.js              the single mutable scenario object
  format.js             peso, percentage and fraction formatting; heir names
  engine/
    regime.js           property regime, asset classification, liquidation
    succession.js       legitimes (testate) and intestate shares
    assets.js           the estate's interest in each asset; the heir roster
    tax.js              estate tax both regimes, settlement costs
    plan.js             gifts, the free portion, waivers, liquidity, equalization
  ui/
    charts.js           pie geometry and drawing
    render.js           every DOM write
    wire.js             event listeners
  cloud.js              optional Supabase layer
  main.js               boot
test/engine.test.mjs    the regression suite
supabase/migrations/    schema and row-level security
```

The engine modules are pure: they read `state.js` and return values, and touch no
DOM. That is what lets the test suite run them in Node.

---

## Modelling limits

Deliberately not covered: collateral relatives (siblings, nephews, nieces);
non-resident alien decedents; vanishing deduction on property previously taxed;
transfers for public use; RA 4917 retirement benefits; the BIR compromise penalty
schedule; disinheritance; collation of lifetime advances; representation by
grandchildren; and chained waivers.

Residue is apportioned pro rata to the legitimes, and debts are assumed settled
from liquid assets first.

**This is a planning aid, not legal advice.** Settle every actual estate with counsel.

---

## Licence

MIT. See `LICENSE`.
