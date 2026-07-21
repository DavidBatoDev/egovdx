# eGovDX Local

eGovDX is a bounded configuration layer for DICT-approved local-government
eServices. An officer describes a service, AI drafts its schema, deterministic
rules enforce the approved bounds, and clean configurations publish for citizen
use. Requests follow the fixed government flow:

`Request → Verification → Approval → Fee assessment → Issuance`

Production: [egovdx.vercel.app](https://egovdx.vercel.app)

## Implemented workflows

- **David:** AI Studio, document extraction, bounded validation, DICT review,
  generation caching, persistence, probes, and deployment.
- **Earl:** PDF issuance, immutable storage, SHA-256 hashing, chain
  anchoring/fallback, QR verification, control-number lookup, and tamper testing.
- **Elton:** PSA-backed LGU onboarding, waiver/payment handling, officer queue,
  atomic approval and control sequencing, PDF/chain/SMS orchestration, retries,
  audit events, and LGU analytics.

The Elton citizen boundary begins with an existing identity-verified request.
Jasmin's native eGovPH shell, `/apply`, and `/track` remain separate work.

## Important routes

| Route | Purpose |
|---|---|
| `/console/studio` | Generate, preview, validate, and confirm an eService |
| `/review` | Resolve blocked configurations and publish approved exceptions |
| `/pay/[requestId]` | Assess waivers and reconcile eGovPay |
| `/console/requests` | Review, reject, approve, issue, anchor, and notify |
| `/console/analytics` | LGU-scoped operational metrics |
| `/verify` and `/verify/[id]` | Public document/hash verification and tamper test |
| `/implementation` | Integration harness and ownership board |

## Local setup

1. Copy `.env.local.template` to `.env.local` and fill the issued credentials.
2. Apply `supabase/schema.sql` for a fresh database, or apply numbered migrations
   in order for an existing project. Migration `004` adds Elton's transactional
   approval, notification, and LGU/year control-sequence state.
3. Load `supabase/seed.sql` and `supabase/seed_psgc.sql` for the demo records.
4. Start the app:

```bash
npm install
npm run dev
```

Each integration has `live|mock` mode control. Fixtures are visibly labelled;
mock/fallback chain receipts never appear as live anchors. Automated QA must use
a `test_` eGovPay token, and live SMS requires an explicit
`EGOV_EMESSAGE_TEST_NUMBER`.

## Verification

```bash
npx tsc --noEmit
npm run test:elton:unit
npm run test:elton
npm run test:earl
npm run qa -- elton-payment elton-approval elton-analytics
```

Browser QA is headed with 800 ms slow motion by default. Run `npx next build`
only as the final pre-commit gate, as required by `AGENTS.md`.

Product intent and authoritative integration contracts live in `docs/`, with
`docs/API_Reference.md` taking precedence over inferred or older API shapes.
