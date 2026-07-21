# eSee LGU

eSee LGU is a bounded configuration layer for DICT-approved local-government
eServices. An officer describes a service, AI drafts its schema, deterministic
rules enforce the approved bounds, and clean configurations publish for citizen
use. Requests follow the fixed government flow:

`Request → Verification → Approval → Fee assessment → Issuance`

Production: [egovdx.vercel.app](https://egovdx.vercel.app)

## Implemented workflows

- **David:** AI Studio, document extraction, bounded validation, DICT review,
  generation caching, persistence, probes, and deployment.
- **Joshua:** server-side eGovPH SSO exchange, role sessions, Face Liveness SDK,
  standalone liveness checks, and eVerify-backed identity prefill.
- **Jasmin:** eSee LGU brand system, native eGovPH citizen shell, dynamic LGU
  catalog, liveness/eVerify application flow, evidence upload, and tracking.
- **Earl:** PDF issuance, immutable storage, SHA-256 hashing, confirmed live
  chain anchoring with block timestamps, QR verification, and tamper testing.
- **Elton:** PSA-backed LGU onboarding, waiver/payment handling, officer queue,
  atomic approval and control sequencing, PDF/chain/SMS orchestration, retries,
  audit events, and LGU analytics.

The workflow now begins in the dynamic citizen catalog and continues through
identity, application, payment, approval, issuance, and public verification.

## Remaining work

No core application feature remains unbuilt. Before final recording, complete
the controlled live checks for David's AI adapter, Joshua's identity chain, and
Elton's Pay/eMessage adapters; add Joshua's dedicated eVerify implementation
harness; then rerun production browser QA. Jasmin and Earl have no remaining
owned implementation work.

## Important routes

| Route | Purpose |
|---|---|
| `/console/studio` | Generate, preview, validate, and confirm an eService |
| `/lgus`, `/apply/[serviceId]`, `/track/[requestId]` | Citizen discovery, application, and status tracking |
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
   approval, notification, and LGU/year control-sequence state. Migration `005`
   adds citizen drafts and persisted chain receipt metadata.
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
npm run test:jasmin
npm run qa -- elton-payment elton-approval elton-analytics
```

Browser QA is headed with 800 ms slow motion by default. Run `npx next build`
only as the final pre-commit gate, as required by `AGENTS.md`.

Product intent and authoritative integration contracts live in `docs/`, with
`docs/API_Reference.md` taking precedence over inferred or older API shapes.
