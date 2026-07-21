# Elton implementation plan — completed

> **Status:** Implemented and unified. See [build_status.md](build_status.md) for
> current routes, verification evidence, provider modes, and the Jasmin citizen
> boundary. This file remains the implementation rationale and acceptance spec.

This plan implements Elton's owned work in dependency order. It preserves the
product boundary: LGUs configure a DICT-approved flow; officers retain the
approval decision; every external integration has an honest mock/fallback path.

## Outcomes and priority

| Priority | Deliverable | Demo outcome |
|---|---|---|
| P0 | eGOV PAY adapter and payment callback/polling | A non-waived request pays the configured fee before submission. |
| P0 | eMessage adapter | Issuance sends the citizen an SMS with the document control number and verification URL. |
| P1 | LGU onboarding | An officer can search PSA geographic reference data and register an unrehearsed LGU. |
| P1 | Approval queue | An authorized officer can review verified evidence, approve, and trigger issuance, anchoring, SMS, and audit events. |
| P2 | Analytics | Only after P0/P1 work is unified and verified. |

## Guardrails that apply to every task

- Read `docs/API_Reference.md` before changing an adapter. It is the authority
  for endpoint paths, headers, and payloads.
- Put reusable logic in `src/lib/`; implementation pages are isolated harnesses
  that call that logic and show the raw result plus a source badge.
- Every provider call goes through `callEgov()`, never directly from a route or
  component. Preserve `EGOV_PAY_MODE` and `EGOV_EMESSAGE_MODE` so either
  integration can switch to a truthful mock during a sandbox outage.
- Normalize each provider response in one adapter-local `normalize()` function.
  UI and API routes must use normalized types only.
- Keep secrets server-side. Add required names to `.env.local.template`; never
  commit `.env.local` or expose API tokens in client components.
- Before changing `supabase/schema.sql` or `src/lib/supabase/types.ts`, announce
  it. Changes must be additive, include a numbered migration, and update both
  files together.
- Freeze the four exported contracts below first, with useful fixture results,
  then mark the related manifest rows `ready` once each harness works:

```ts
export async function generatePayment(
  amount: number,
  description: string,
  txnid: string,
): Promise<EgovResult<PaymentIntent>>

export async function checkPayment(uuid: string): Promise<EgovResult<PaymentIntent>>

export async function pushSms(
  mobile: string,
  message: string,
): Promise<EgovResult<SmsResult>>

export async function searchPsgc(query: string): Promise<PsgcEntry[]>
```

## 1. Correct and freeze eGOV PAY

### Adapter work

1. Replace the guessed payment paths in `src/lib/egov/pay.ts` with the approved
   routes:
   - `POST /api/v1/transaction`
   - `GET /api/v1/transaction/{uuid}`
   - `PUT /api/v1/transaction/{uuid}/void`
2. Reuse `authHeaders('PAY', token)` from `client.ts`; it emits exactly
   `X-eGovPay-Token`. Send `Content-Type: application/json; charset=utf-8`.
3. In `generatePayment`, obtain the API token only on the server and construct
   the required request body: one item with the supplied service description
   and amount; total `amount`; settlement template UUID; `txnid`; `redirect_url`
   to `/citizen/track/{requestId}`; and the application callback URL.
4. Generate `digest` using `createHmac('sha256', apiToken)` over the exact
   string `${amount}|${txnid}`. Keep the amount representation identical in the
   payload and digest input to avoid a misleading 422 error.
5. Add a single `normalizePayment(raw, fallback)` function. Map
   `data.uuid`, `data.url`, `data.channel.refno`, and `data.payment_status` to
   `PaymentIntent`; map gateway statuses such as `INITIAL` to `pending` and
   paid terminal values to `paid`.
6. Make the fixture credible: a deterministic mock UUID/reference and an
   in-app hosted checkout route. The mock should be visibly labelled; it must
   not claim external payment settlement.
7. Confirm the issued token begins with `test_` before testing a live payment.
   Do not use a non-test token for demo validation.

### Payment persistence and routes

1. Confirm migration 002's `requests.payment_uuid`, `payment_url`, and
   `payment_txnid` are reflected in `src/lib/supabase/types.ts`. Add only the
   missing type/schema pieces if they are not already present.
2. Create the server route(s) under `src/app/api/pay/` that:
   - validate the request and derive the request ID/transaction ID;
   - apply a waiver before creating any payment;
   - invoke `generatePayment` for a payable request;
   - persist the returned UUID, checkout URL, and transaction ID; and
   - append a `request_events` record with the source and reference, never the
     token or HMAC digest.
3. Implement `POST /api/pay/callback`. Treat callback input as untrusted:
   validate required identifiers, reconcile with `checkPayment(uuid)` when
   possible, update `fee_status` only for a confirmed paid status, and append a
   payment-status event. Log unknown UUIDs rather than creating a request.
4. On the citizen track page, poll `checkPayment(payment_uuid)` because a local
   callback cannot be reached by the remote provider. When paid, persist
   `fee_status = 'paid'` and enable/continue submission exactly once.
5. Waivers are a first-class branch: set `fee_status = 'waived'`, store the
   waiver category in `waiver_applied`, record the event, and go directly to
   submission. The zero-fee Certificate of Indigency must use this route.

### Harness, unification, and acceptance

1. Build `/implementation/egov-pay` as a server-safe harness: create a sample
   payment, check it, optionally void it, render the normalized result and its
   `<SourceBadge>`, and list exports.
2. Wire the same library functions into the citizen payment and track screens;
   do not duplicate adapter logic in a page.
3. Verify a PHP 150 request creates the documented payload and stores its UUID;
   verify a waived request makes no payment API call; verify mock/live/fallback
   badges are distinguishable; verify typecheck passes.

## 2. Correct and freeze eMessage

1. In `src/lib/egov/emessage.ts`, use `authHeaders('EMESSAGE', apiToken)` so
   requests send `X-EMESSAGE-Auth`, not bearer or `x-api-key` headers.
2. Post the authoritative body shape to `/messaging/v1/sms/push`:
   `{ number: '+639…', message }`.
3. Replace the local mobile normalizer so it consistently produces E.164 with a
   leading `+`: accept `09…`, `9…`, `63…`, and `+63…`; reject or return a clear
   validation error for values that cannot be normalized to a Philippine mobile
   number. Do not silently remove the plus sign.
4. Add `normalizeSms(raw)` to map the documented `201` response and plausible
   live variants to `{ messageId, accepted }`. The fixture should log the
   recipient/message server-side and return an accepted mock ID.
5. Keep `issuedSmsBody()` as the single message formatter. At the issuance call
   site, supply the configured service name, generated control number, and the
   public verification URL.
6. Build `/implementation/emessage` with a non-fixture mobile input, message
   preview, send trigger, normalized JSON output, and `<SourceBadge>`.
7. Test formatting for `09171234567`, `9171234567`, `639171234567`, and
   `+639171234567`; all must yield `+639171234567`.

## 3. Build PSA-backed LGU onboarding

### Reference data and library contract

1. Create `supabase/seed_psgc.sql`, idempotent on rerun, with enough real PSGC
   records to support NCR and Region III: regions, provinces, municipalities or
   cities, and barangays. Include Bulacan → Marilao and its relevant barangays.
2. Ensure every record conforms to `psgc_reference` fields from migration 002:
   `code`, `name`, `level`, `parent_code`, `region_code`, and `province_code`.
3. Implement `PsgcEntry` and `searchPsgc(query)` in a reusable server library.
   Trim input; require a small non-empty search term; perform a case-insensitive
   name search across municipalities/cities and barangays; return enough
   hierarchy metadata for an operator to distinguish duplicate names.
4. Add a focused `/implementation/lgu-onboarding` harness that proves search
   works for Marilao and a second non-seeded-in-UI location.

### Registration route and UI

1. Create `/console/register` as an officer-only screen using Joshua's session
   contract. If session work is temporarily unavailable, use its frozen mock
   contract rather than blocking the route.
2. Present a search/select control backed by `searchPsgc`, not a hardcoded
   dropdown. Display each result as a clear geographic trail.
3. Require an official email, validate it server-side, and submit only the
   selected PSGC entry plus the current officer identity.
4. Add an API route under `src/app/api/lgus/` that validates authorization and
   input, prevents duplicate registrations by PSGC code, and inserts an `lgus`
   row with `name`, derived type, region, `psgc_code`, `official_email`,
   `registered_by`, and `registered_at`.
5. Redirect to the registered LGU's dashboard. Its intentional initial state
   must say `0 active eServices`, explain the next action, and not resemble a
   loading/error state.
6. Test an arbitrary searchable LGU from the loaded reference data, duplicate
   registration, bad email, and an unauthenticated submission.

## 4. Build the approval queue and issuance orchestration

### Read model and queue screen

1. Confirm `listRequestsForLgu(lguId)` selects the correct service and request
   data. Refine its query only if it needs an explicit `approval_office` filter
   for the currently signed-in officer's office; do not show all LGU requests
   to every officer by default.
2. Build `/console/requests` using the session's LGU and office/role context.
   Render requests in a table or compact queue with status and service name.
3. Each review row/detail must display the eVerify reference, liveness score,
   liveness pass state, fee status/payment reference, uploaded documents, and
   the citizen-provided form fields. This is the evidence an officer uses;
   never paint it as verified if it came from a fixture.
4. Allow approval only when the request belongs to the officer's LGU/office,
   is in an approvable state, has passed liveness, and its fee is paid or
   waived. Explain unavailable actions in the UI.

### Approval API workflow

1. Implement `POST /api/requests/[id]/approve` as a Node.js route
   (`export const runtime = 'nodejs'`), because downstream issuance hashes and
   generates a PDF.
2. Re-fetch the request server-side and authorize it against the current
   officer. Reject stale, already-issued, unpaid, failed-liveness, or
   out-of-office approvals with meaningful HTTP errors.
3. Make the status transition explicit and auditable:
   - set `status = 'approved'` and record `approved` with actor identity;
   - call Earl's frozen `generateDocument()` contract;
   - save document path, control number, hash, and record `document_generated`;
   - call Earl's `anchorHash()` contract; save the transaction if it returns one
     and record either `hash_anchored` or an honest unanchored/fallback event;
   - call `pushSms()` with `issuedSmsBody()` and record the notification result;
   - set `status = 'issued'` and `issued_at`, then record `issued`.
4. Do not report a chain anchor as verified merely because a mock/fallback
   returned a value. Persist and surface the source/status so the public
   verification UI can distinguish anchored from unanchored documents.
5. Decide and document failure handling before coding: the officer decision and
   generated document must remain auditable if chain/SMS fails; record the
   failing step, preserve a recoverable `approved` or issuance-pending state,
   and make retries idempotent. Avoid rerunning document generation or sending
   duplicate SMS after a browser refresh.
6. Use `recordEvent()` for every transition with safe diagnostic payloads
   (request ID, source, control number, external reference/status), excluding
   personal identity payloads, tokens, and full document contents.

### Harness, unification, and acceptance

1. Build `/implementation/approval-queue` with a real queue read, request
   detail, approve action, raw response/event trail, and source labels.
2. Wire the same query and route into `/console/requests`; do not move business
   logic into the page component.
3. Validate the golden path: paid/waived request → officer sees liveness and
   eVerify evidence → approve once → document generated → chain attempt → SMS
   result → issued status with chronological events.
4. Validate guards: a request from another LGU/office, unpaid request,
   liveness failure, and repeated approval must not advance the workflow.

## 5. Optional analytics, only after core work

1. Add `/console/analytics` only after the four main harnesses are unified.
2. Query the officer's LGU only and calculate request volume, completion rate,
   and median time from request creation to `issued_at`.
3. Treat no-data/zero-volume states as normal, particularly for newly registered
   LGUs. Do not invent a metric to fill the dashboard.

## Final integration and QA checklist

1. Update the Elton rows in `src/app/implementation/manifest.ts` from
   `building` to `ready` when contracts and harnesses work, then to `unified`
   after the production routes use those same library functions.
2. Add one QA flow per completed journey in `scripts/qa/flows.mjs`, with Elton
   as owner. Use `visit()` for every navigation, never bare `page.goto()`.
3. Run `npx tsc --noEmit` after each coherent unit of work. Use the browser QA
   skill's headed flow for onboarding, paid/waived submission, and approval to
   catch recording-width and error-boundary problems.
4. Before committing, run the full production build once as the final gate;
   otherwise avoid routine `next build` runs.
5. Record the source of each live proof: payment checkout/status, SMS delivery
   response, onboarding lookup, and approval audit trail. If a sandbox fails,
   switch its mode to mock and keep the source badge visible in the recording.
