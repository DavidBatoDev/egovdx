# Elton build status

Updated after the first implementation pass.

## Built

### eGOV PAY

- Updated `src/lib/egov/pay.ts` to use the documented eGOV PAY endpoints:
  `POST /api/v1/transaction`, `GET /api/v1/transaction/{uuid}`, and
  `PUT /api/v1/transaction/{uuid}/void`.
- Uses the required `X-eGovPay-Token` header through shared `authHeaders()`.
- Generates the required HMAC-SHA256 digest from `amount|txnid` using the API
  token as the key.
- Normalizes provider payloads into `PaymentIntent` and preserves an honest
  live/mock/fallback result source.
- Added `POST /api/pay/callback`, which reconciles callback UUIDs with the
  gateway, updates a confirmed paid request, and records an audit event.
- Added the `/implementation/egov-pay` integration harness.

### eMessage

- Updated `src/lib/egov/emessage.ts` to use `X-EMESSAGE-Auth` and the documented
  body shape: `{ number, message }`.
- Philippine mobile inputs now normalize to E.164 `+639…` format.
- Added SMS response normalization and retained `issuedSmsBody()` as the single
  issuance-notification formatter.
- Added the `/implementation/emessage` integration harness.

### LGU onboarding

- Added `supabase/seed_psgc.sql`, an idempotent PSGC seed covering NCR and the
  Bulacan/Marilao path needed for the demo.
- Added `src/lib/psgc.ts` with reusable `searchPsgc()` and `getPsgcEntry()`
  functions, keeping lookup logic out of components.
- Added protected PSA search and LGU registration routes under `src/app/api/lgus/`.
- Added `/console/register`, with searchable PSA results, official-email
  validation, duplicate protection, and a registration submission flow.
- Added `/console` as the post-registration dashboard, including an intentional
  `0 active eServices` empty state for a new LGU.
- Added the `/implementation/lgu-onboarding` harness and a corresponding QA flow.

### Workflow and validation

- Updated the implementation manifest: onboarding is `unified`; eGOV PAY and
  eMessage are `ready`.
- `npx tsc --noEmit` passes.
- `git diff --check` passes.

## Still to build

### Payment flow integration

- Build the citizen-facing `src/app/pay/` checkout/return experience.
- Wire payment creation, waiver handling, persistence of payment UUID/URL/txnid,
  and payment-status polling into Jasmin's citizen request and track flow.
- Ensure zero-fee and waived requests skip the payment gateway entirely while
  recording `fee_status = 'waived'` and the applied waiver.

### Approval queue and issuance orchestration

- Build `src/app/console/requests/` and `src/app/api/requests/[id]/approve`.
- Filter requests by the signed-in officer's LGU and approval office.
- Display liveness result, eVerify reference, fee state, supporting documents,
  and submitted form values before approval.
- On approval: set `approved`, generate the PDF, anchor its hash, send SMS,
  write an audit event for every step, then set `issued`.
- Add idempotent retry/error behavior so a chain or SMS failure does not repeat
  document generation or send duplicate notifications.

Earl's `generateDocument(request)`, `anchorHash()`, and `verifyAnchor()` contracts
now exist and the standalone issuance route is tested, so this work is no longer
blocked on Earl. Elton still needs to build the approval action that orchestrates
those contracts with `pushSms()` and makes retries idempotent.

### Analytics (cuttable)

- Build `src/app/console/analytics/` only after the payment and approval flows
  are unified.
- Show LGU-scoped request volume, completion rate, and median time to issuance.

## Ownership notes

The completed changes use Elton-owned paths where available. Supporting files
outside the listed ownership paths were intentionally added only to keep logic
reusable (`src/lib/psgc.ts`), provide the required post-registration destination
(`src/app/console/page.tsx`), and satisfy the project workflow (implementation
harnesses, status board, and QA flow).
