<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# eGovDX Local

A bounded configuration layer over a fixed, DICT-approved eService flow:
`Request → Verification → Approval → Fee assessment → Issuance`. An LGU officer
describes a service in plain language; the system generates it, validates it
against DICT-approved bounds, and publishes it natively inside eGovPH. Citizens
then request it with their identity pulled from PhilSys rather than retyped, and
approved documents are issued as PDFs whose hash is anchored on-chain so anyone
can verify them.

LGUs configure fees, waivers, eligibility, and form fields **within approved
bounds** — they do not author workflows. That boundary is the whole pitch: we
remove the configuration labour, not the government oversight.

## Read `docs/` before you build

**`docs/` is the source of truth for what this app is and why.** Do not infer
the product from the code — the code is half-built and the intent lives in these
files. Read the ones relevant to your task before writing anything.

| Doc | What it answers |
|---|---|
| `docs/03_egovdx_brief.md` | **What we're building and why.** The problem, the product, the positioning, and the risks we state before a judge finds them. Start here. |
| `docs/06_demo_script.md` | **What the finished app must do**, minute by minute. The clearest spec of the intended end state. |
| `docs/API_Reference.md` | **Authoritative contracts for every eGovPH API** — routes, auth schemes, request/response shapes. Supersedes the catalog and anything inferred in code. |
| `docs/05_task_distribution.md` | Who owns what, the timeline, and the dependency graph. |
| `docs/<name>/README.md` | Per-developer briefs (`david`, `joshua`, `jasmin`, `earl`, `elton`) with exact contracts to freeze. |
| `docs/04_implementation_workflow.md` | How five people build in parallel without colliding. |
| `docs/01_hackathon_overview.md` | Deadlines, judging weights, submission rules. |
| `docs/draft-flow.md` | The original hand-written flow sketch that `06_demo_script.md` expands. |

`API_Reference.md` already folds in the old high-level catalog, so it is the only
API document you need. If you find an older catalog file lying around, it is
superseded.

Judging weights shape priorities: impact 35%, integration depth 30%,
presentation 15%, UI/UX 10%, reels 10%. Visible, load-bearing API calls are
worth roughly three times pixel polish.

## Build and verify

**Do not run `next build` as a routine check.** It takes ~45s and tells you
almost nothing that a typecheck won't. Run it only when you are about to commit,
as the last gate before `git commit`.

For everything else while working:

```bash
npx tsc --noEmit      # fast, catches essentially all of it
npm run dev           # for anything visual
```

```bash
npx next build        # ONLY as part of committing
```

The reason is time, not principle: this is a deadline build, and a full
production build repeated between every edit is minutes of nothing.

## Browser QA

Automated QA drives a real Chromium window through the app's user journeys.

```bash
npm run dev      # in another terminal first
npm run qa       # headed, slowMo 800ms
```

**Headed at 800ms is the default on purpose.** A pass/fail line only tells you
the DOM matched an assertion — not that an error boundary flashed, the layout
collapsed at recording width, or a button is present but stacked under another
element. This project's deliverable is a screen recording, so those are the
defects that matter, and only a human watching the browser catches them. Use
`npm run qa:headless` for a fast regression check.

Results are **pass / pending / fail**. `pending` means the route 404s because
nobody has built it yet, and does not fail the run — on a five-person parallel
build, reporting unwritten features as failures trains everyone to ignore the
report.

**Add a flow when your feature lands:** `scripts/qa/flows.mjs`, one entry per
user journey, with an `owner` matching `src/app/implementation/manifest.ts` so a
failure names a person.

**Always navigate with `visit()`, never bare `page.goto()`.** Playwright's
`goto()` resolves happily on a 404, so a flow that only calls `goto()` and
screenshots reports a green pass for a route that does not exist. That bug was
in the first version of these flows. A QA harness that lies is worse than none.

Full playbook: the `browser-qa` skill —
`.claude/skills/browser-qa/SKILL.md` (Claude Code) and
`.agents/skills/browser-qa/SKILL.md` (Codex). Both drive the same
`scripts/qa/` code; only the prose is duplicated, because the two tools
discover skills at different paths.

## This is a working app, not a demo

Every feature must accept input the demo script never mentions — an LGU nobody
seeded, a prompt nobody rehearsed, a citizen who isn't in a fixture. Mock
fallbacks are an outage safety net, not the primary path. If it only works on
the rehearsed input, it isn't done.

Task distribution and per-developer assignments: `docs/05_task_distribution.md`.
Demo script: `docs/06_demo_script.md`.

**`docs/API_Reference.md` is the authority on every eGovPH contract.** It
supersedes the older high-level catalog and any shape inferred in code, several
of which turned out to be wrong. Check it before touching an adapter — several
services use custom auth headers rather than bearer tokens, and `authHeaders()`
in `src/lib/egov/client.ts` already encodes which is which.

## Working on a feature

Five people build in parallel. Features are developed in isolation at
`/implementation/<slug>`, then wired into the real `/app` routes.

**The rule: real logic goes in `src/lib/`. The harness page at
`/implementation/<slug>` only calls it and shows the result.** If logic lives
inside a page component, unification means rewriting it.

- Ownership, status, and the dependency graph:
  `src/app/implementation/manifest.ts` (renders at `/implementation`)
- Reference harness to copy: `src/app/implementation/egov-sso/page.tsx`
- Full guide: `docs/04_implementation_workflow.md`

Freeze your exported types and function signatures early, returning mock data —
that unblocks everyone downstream immediately. A dependency counts as satisfied
when its contract is frozen (`ready`), not when it's finished.

## Commands

```bash
npm run dev              # dev server on :3000
npx tsx scripts/probe.ts # hit every eGovPH endpoint, print status + response shape
```

## Architecture

- `src/lib/egov/` — one adapter per registered API. **Every call goes through
  `callEgov()`** in `client.ts`, which falls back to a fixture when the sandbox
  fails instead of throwing. Never call `egovFetch` directly from a route.
- `src/lib/supabase/server.ts` — service-role client. **Server-only.** RLS is
  disabled by design; all access flows through route handlers and server
  components.
- `src/lib/data.ts` — shared queries. Anything used once stays inline.
- `src/components/ui.tsx` — hand-rolled primitives, no component library.

## Conventions

- Response shapes from eGovPH are normalized in exactly one `normalize()`
  function per adapter. When the real shape turns out to differ, that function
  is the only thing that changes — do not spread field-name guessing into
  routes or components.
- Any route doing PDF generation or hashing needs `export const runtime = 'nodejs'`.
- Per-service `EGOV_*_MODE=live|mock` env flags exist so a failing integration
  can be switched off during a demo without a code change. Preserve that.
- When data came from a fixture rather than a live call, say so in the UI
  (`<SourceBadge>`). The interface must never imply PhilSys verified something
  it didn't.
- Types in `src/lib/supabase/types.ts` are hand-written to match
  `supabase/schema.sql`. Change both together. Each table needs a
  `Relationships` key or supabase-js collapses its type to `never`.

## Secrets

`.env.local` is gitignored; `.env.local.template` is committed and lists every
variable. `.mcp.json` is committed, so it references secrets only via
`${ENV_VAR}` — never inline a token there.
