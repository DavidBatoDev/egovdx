---
name: browser-qa
description: Run automated browser QA against the running eGovDX app using Playwright in headed mode at 800ms slowMo, so a human can watch each user journey execute. Use when asked to QA, smoke-test, verify the app works, check a flow end to end, confirm a route renders, hunt for console errors, or before recording a demo or committing user-facing changes.
---

# Browser QA

> **Codex reads this copy; Claude Code reads `.claude/skills/browser-qa/SKILL.md`.**
> The two tools discover skills at different paths, so the frontmatter is
> duplicated by necessity. The behaviour is not duplicated — it lives in
> `scripts/qa/`, which both copies drive.
>
> **Read `.claude/skills/browser-qa/SKILL.md` for the full playbook**, including
> how to add flows and how to read a failure. The essentials are below.

## Run it

```bash
npm run dev      # must be running first, in another terminal
npm run qa       # headed, slowMo 800ms — the default
```

```bash
npm run qa -- landing apply    # only named flows
npm run qa -- --headless       # CI, or no display available
npm run qa -- --slowmo 0       # full speed
```

## Headed at 800ms is the point

A visible browser slowed to 800ms per action is deliberate, not a debugging
leftover. A pass/fail line tells you the DOM matched your assertion; it does not
tell you an error boundary flashed, the layout collapsed at recording width, or
a button is present but stacked under something else. This project's output is a
screen recording, so those are the defects that matter and only a human watching
catches them.

## Three outcomes

- **pass** — assertions held
- **pending** — route 404s, not built yet. Does **not** fail the run
- **fail** — route exists but misbehaved. Fails the run (exit 1)

## The one rule when adding flows

Navigate with `visit()` from `scripts/qa/flows.mjs`, never bare `page.goto()`.
Playwright's `goto()` resolves successfully on a 404, so a flow that only calls
`goto()` and screenshots reports **pass** for a route that doesn't exist. That
bug was in the first version of these flows — four routes reported green while
returning 404. A QA harness that lies is worse than none, because people trust it.

```js
await visit(page, `${baseUrl}/console`)   // ✅ throws on 404 / 5xx
await page.goto(`${baseUrl}/console`)     // ❌ green on a 404
```

Flows live in `scripts/qa/flows.mjs`; each carries an `owner` matching
`src/app/implementation/manifest.ts`, so a failure names a person.

## Output

Screenshots and `report.json` land in `qa-artifacts/` (gitignored, wiped per
run). Console errors and failed requests are captured and reported but are
non-fatal.
