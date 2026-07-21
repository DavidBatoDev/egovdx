<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# eGovDX Local

A bounded configuration layer over a fixed, DICT-approved eService flow:
`Request → Verification → Approval → Fee assessment → Issuance`. LGUs configure
fees, waivers, eligibility, and form fields within approved bounds; they do not
author workflows. Built for the eGovPH hackathon — see `docs/` for the brief,
the rules, and the API catalog.

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
