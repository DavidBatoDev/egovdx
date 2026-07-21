# Implementation Workflow — 5 developers, one app

**Team PRODIGITALITY | eGovDX Local**

---

## The problem this solves

Five people building fourteen interlocking features against one Next.js app, on
a deadline, where half the features depend on the other half. Two things go
wrong by default:

1. **Everyone edits the same files.** Merge conflicts in `src/app/` eat the
   evening.
2. **Everyone blocks on everyone.** The person building the citizen form waits
   for eVerify, who waits for SSO, and three people sit idle.

The workflow below removes both. It is not ceremony — each rule exists because
of a specific way this build fails without it.

---

## The core rule

> **Build your feature at `/implementation/<slug>`. Put the actual logic in
> `src/lib/`. The harness page only calls it and shows the result.**

Your harness page is a test rig, not a product screen. It can be ugly. It should
dump raw JSON. Its whole job is to prove your feature works in isolation.

**Why this specific split:** unification at the end has to be cheap. If your
logic lives inside `src/app/implementation/my-feature/page.tsx`, then merging it
into the real app means rewriting it — at 4 AM, under pressure, with no tests.
If your logic lives in `src/lib/my-feature.ts` and the harness just calls it,
unification is an import statement.

That claim is already load-bearing:
[`src/app/implementation/egov-sso/page.tsx`](../src/app/implementation/egov-sso/page.tsx)
contains zero SSO logic. It calls `getSession()` and renders the result. Wiring
SSO into the real header took one import.

**Copy that file's shape for your feature.** A harness has three sections:
trigger it, show the raw result, state what you export.

---

## Where things live

```
src/app/implementation/<slug>/page.tsx   your harness — you own this outright
src/lib/<your-module>/                   your real logic — you own this too
src/app/<real-route>/                    the product. Touch during unification only.
```

| Path | Owner | Rule |
|---|---|---|
| `src/app/implementation/<slug>/` | you | Nobody else edits it. Go wild. |
| `src/lib/egov/<service>.ts` | you | One adapter per API, one owner per adapter. |
| `src/components/ui.tsx` | brandkit | **Shared.** Say so in chat before editing. Additive changes only. |
| `supabase/schema.sql` | shared | **Shared.** Announce before changing. See below. |
| `src/lib/supabase/types.ts` | shared | Must change in lockstep with `schema.sql`. |
| `src/app/` (real routes) | shared | Only during unification. |

Ownership is tracked in
[`src/app/implementation/manifest.ts`](../src/app/implementation/manifest.ts) —
the `owns` field on each feature. If two features claim the same file, one of
them is scoped wrong; fix the scope, don't share the file.

---

## Stub your contract first

This is the rule that actually unblocks four people at once, and the one most
likely to get skipped.

**Before you build anything, export the function signature and its return type,
returning mock data.** Commit that within the first thirty minutes.

```ts
// src/lib/egov/everify.ts — hour 0, before any real API call works
export type VerifiedIdentity = {
  verified: boolean
  fullName: string
  address: string
  yearsOfResidency: number | null
}

export async function verifyIdentity(q: EverifyQuery): Promise<EgovResult<VerifiedIdentity>> {
  return { data: MOCK_IDENTITY, source: 'mock' }   // real call lands later
}
```

The person building the citizen form can now write their entire feature against
`VerifiedIdentity` and never wait for you. When your real implementation lands,
their code doesn't change — that's the point.

A dependency counts as satisfied when its **contract is frozen**, not when it's
finished. That's what the `ready` status means in the manifest, and why the
dashboard treats `ready` and `unified` identically when computing what's blocked.

**If you change a frozen contract, tell the people in `dependents()`.** The
manifest has a helper for exactly that.

---

## Status tracking

Update your row in
[`manifest.ts`](../src/app/implementation/manifest.ts) as you go. It renders live
at [`/implementation`](http://localhost:3000/implementation).

| Status | Means | Others may depend on you? |
|---|---|---|
| `todo` | Not started | No |
| `building` | In progress, contract may still move | Stub against it, expect churn |
| `ready` | Contract frozen, harness works | **Yes** |
| `unified` | Wired into the real `/app` routes | Yes |

The status table lives in code, not in this document, deliberately — a markdown
status table is stale within a day and then actively misleads.

---

## Shared files: schema changes

`supabase/schema.sql` is the one file where a conflict is expensive, because
everyone's local Supabase state drifts from it silently.

1. Announce in chat before you change it.
2. Make the change **additive** — new table or new nullable column. Never
   rename or drop; someone else's harness is reading that column right now.
3. Update `src/lib/supabase/types.ts` in the same commit. They are one unit.
4. Tell everyone to re-run `schema.sql` + `seed.sql`.

Each table needs a `Relationships: []` key in the types file, or supabase-js
collapses the whole table type to `never` and every column access errors. This
already cost us once.

---

## Unification

A feature graduates from harness to product when its status hits `ready`.

1. Create the real route under `src/app/` (e.g. `src/app/apply/[serviceId]/`).
2. Import the same `src/lib/` functions your harness calls. **Do not copy code
   out of the harness** — if you find yourself copying, the logic was in the
   wrong place and belongs in `src/lib/` first.
3. Apply real styling using brandkit primitives from `src/components/ui.tsx`.
4. Set status to `unified`.
5. **Leave the harness in place.** It costs nothing and it's the fastest way to
   debug one integration when the full flow misbehaves at 3 AM.

Harnesses are diagnostics, not product navigation. The public landing at `/`
must connect the citizen, officer, and reviewer journeys through real routes.
`npm run qa` exercises those product journeys by default; use
`npm run qa:diagnostics` when isolating `/implementation/*` adapters.

`/implementation` also happens to be useful on camera: it shows each eGovPH
integration firing individually, which is a cleaner way to evidence integration
depth than narrating over a happy path. Integration is 30% of the score and
judges can tell a load-bearing API from a decorative one.

---

## Rules that keep the demo alive

These are non-negotiable because they're what stops one broken sandbox from
killing an eight-minute video.

- **Every eGovPH call goes through `callEgov()`** in
  [`src/lib/egov/client.ts`](../src/lib/egov/client.ts). It serves a fixture
  when the sandbox fails instead of throwing. Never call `egovFetch` directly
  from a route or component.
- **Every adapter needs a real mock.** Not `{}` — a fixture that looks like a
  plausible response, so the UI renders correctly with the service switched off.
- **Normalize in exactly one place per adapter.** One `normalize()` function per
  service. When the real response shape turns out to differ from what we
  guessed, that function is the only thing that changes.
- **Say when data is fake.** Use `<SourceBadge source={...} />`. The interface
  must never imply PhilSys verified something it didn't. A judge who spots that
  has found a credibility problem, not a UI bug.
- **`EGOV_*_MODE=live|mock` per service** must keep working. It's how we kill a
  misbehaving integration mid-demo without a code change.

---

## Working agreements

- **Don't run `next build` as a routine check** — it's ~45s and catches nothing
  `npx tsc --noEmit` doesn't. Build only as the gate before a commit. (Also in
  [`AGENTS.md`](../AGENTS.md).)
- **Commit small and often.** Rebasing a four-hour branch at 4 AM is how teams
  lose work.
- **Run `npx tsx scripts/probe.ts`** before trusting any live integration. Two
  of our seven APIs have no published endpoints.
- **Never commit `.env.local`.** Add new variables to `.env.local.template` so
  the other four know to fill them in.
