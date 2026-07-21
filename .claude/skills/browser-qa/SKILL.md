---
name: browser-qa
description: Run automated browser QA against the running eGovDX app using Playwright in headed mode at 800ms slowMo, so a human can watch each user journey execute. Use when asked to QA, smoke-test, verify the app works, check a flow end to end, confirm a route renders, hunt for console errors, or before recording a demo or committing user-facing changes.
---

# Browser QA

Drives a real Chromium window through the app's user journeys, captures
screenshots and console errors, and reports pass / fail / pending per flow with
an owner attached.

## Run it

```bash
npm run dev      # must be running first, in another terminal
npm run qa       # headed, slowMo 800ms — the default
```

```bash
npm run qa -- landing apply    # only named flows
npm run qa -- --headless       # CI, or no display available
npm run qa -- --slowmo 0       # full speed
npm run qa -- --base https://egovdx.vercel.app   # against a deployment
```

Exit code is 0 unless something genuinely **failed**. Pending never fails a run.

## Headed at 800ms is the point

The default is a visible browser slowed to 800ms per action, and that is
deliberate rather than a debugging leftover.

A pass/fail line tells you the DOM contained what you asserted. It does not tell
you the form filled in a nonsensical order, that an error boundary flashed for
half a second, that the layout collapsed at the viewport you're about to record
at, or that a button is technically present but visually stacked under another
element. On a project whose output is a screen recording, those are the defects
that matter, and a human watching the browser drive itself is the only thing
that catches them.

Use `--headless --slowmo 0` for a quick regression check. Use the default when
you are about to record, or when something looks wrong but tests pass.

## The three outcomes

| Result | Meaning | Fails the run? |
|---|---|---|
| **pass** | Flow completed and assertions held | no |
| **pending** | Route returned 404 — not built yet | **no** |
| **fail** | Route exists but behaved wrongly | **yes** |

The pass/pending split matters on a parallel build. Reporting unwritten features
as failures trains everyone to ignore the report, and then it catches nothing.

`pending` is decided by an explicit flag thrown from `visit()`, never by pattern
matching an error message — a heuristic there would eventually hide a real
failure by mislabelling it "not built".

## Adding a flow

Edit `scripts/qa/flows.mjs`. Add one entry per user-visible journey:

```js
{
  id: 'pay',
  name: 'Citizen pays the assessed fee',
  owner: 'Elton',                    // matches src/app/implementation/manifest.ts
  async run({ page, baseUrl, shot }) {
    await visit(page, `${baseUrl}/pay/REF123`)   // asserts a non-404 response
    await page.getByRole('button', { name: /pay/i }).click()
    await shot('checkout')
    return 'checkout reached'        // shown in the report
  },
}
```

`owner` is what makes the summary actionable — a failure names a person, not
just a route.

## Always navigate with `visit()`, never bare `page.goto()`

```js
await visit(page, `${baseUrl}/console`)     // ✅ throws on 404 / 5xx
await page.goto(`${baseUrl}/console`)       // ❌ resolves happily on a 404
```

Playwright's `goto()` succeeds on a 404 — the navigation *did* complete. A flow
that only calls `goto()` and screenshots will report **pass** for a route that
does not exist. This exact bug was in the first version of these flows: four
routes reported green while returning 404.

That is the same false-green-check problem the product itself refuses to ship
(see `docs/earl/README.md` on never showing a verified badge for an unanchored
document). A QA harness that lies is worse than no harness, because people trust
it.

## What it captures

- **Screenshots** — `qa-artifacts/<flow>-<n>-<name>.png`, plus an automatic
  `failure.png` on any failing flow
- **`qa-artifacts/report.json`** — machine-readable results with owners
- **Console errors and `pageerror`** — reported but non-fatal. This is where
  hydration mismatches and uncaught render errors surface; they often look fine
  on screen and break under a judge's questions
- **Failed network requests** — status + path for anything ≥ 400

`qa-artifacts/` is gitignored and wiped at the start of each run.

## When to reach for this

- Before recording anything
- Before committing a change to a route, form, or auth path
- After someone else's merge, to check nothing downstream broke
- When a flow "works for me" — watch it at 800ms and it usually doesn't

## Reading a failure

1. Look at `qa-artifacts/<flow>-failure.png` first — usually obvious
2. Check `failedRequests` in `report.json` for the 4xx/5xx that caused it
3. Re-run just that flow headed: `npm run qa -- <flow-id>`
4. The `owner` field tells you who to talk to

## Notes

- Each flow runs in a **fresh browser context**, so cookies don't leak between
  them. Several flows assert on role-based routing and would pass spuriously if
  a previous flow's session persisted.
- Requires the dev server. The runner checks and exits with instructions rather
  than producing nine confusing timeouts.
- `slowMo` applies per Playwright action, so a nine-flow headed run takes a few
  minutes. That's the intended cost — you're meant to watch it.
