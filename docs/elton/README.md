# Elton — payments, SMS, LGU registration, approval queue

**Role:** Full stack
**Routes:** `/implementation/egov-pay`, `/implementation/emessage`, `/implementation/lgu-onboarding`, `/implementation/approval-queue`
**APIs owned:** eGOV PAY · eMessage
**Blocked by:** Joshua's session contract (already working in mock mode — don't wait)

---

## About this list

Four items looks like a lot next to everyone else's two or three. It isn't —
these are the **fully-specified, low-ambiguity** pieces: one header fix, one
HMAC, one form, one table with a button. No open-ended design problems, no
"figure out what the AI should return". Request and response shapes are written
out below; it's mostly transcription.

Do them in this order. **Task 1 and 2 are on the critical path; task 4 is
cuttable.**

---

## Task 1 — eGovPay (`/implementation/egov-pay`)

My `src/lib/egov/pay.ts` guessed the paths and **missed the digest entirely**, so
every request would have been rejected. Real contract:

```
POST {base_url}/api/v1/transaction
Header: X-eGovPay-Token: {api_token}        ← not a bearer token
Content-Type: application/json; charset=utf-8
```

| Field | Required | Notes |
|---|---|---|
| `items[]` | yes | `[{ name, amount }]` |
| `amount` | yes | total |
| `settlement_template_uuid` | yes | `EGOV_PAY_SETTLEMENT_TEMPLATE_UUID` |
| `txnid` | yes | **you** generate this — use the request id |
| `redirect_url` | yes | back to `/track/<requestId>` |
| `callback_url` | yes | your webhook, fires on every status change |
| `digest` | yes | see below |
| `currency`, `mobile`, `email`, `name`, `expires_at` | no | |

### The digest is the part that bites

```ts
import { createHmac } from 'node:crypto'

const digest = createHmac('sha256', apiToken)
  .update(`${amount}|${txnid}`)
  .digest('hex')
```

`hash_hmac('sha256', "$amount|$txnid", $token)` — keyed by the **API token**,
recomputed per request. Get the amount formatting wrong and you get a 422 that
looks like an auth failure.

Response → `data.uuid`, `data.url` (hosted checkout), `data.channel.refno`.
Store `uuid` in `requests.payment_uuid` and `url` in `payment_url`.

Other endpoints:
- `GET {base_url}/api/v1/transaction/{uuid}` → `data.payment_status` (`INITIAL` → paid)
- `PUT {base_url}/api/v1/transaction/{uuid}/void`

A `test_`-prefixed token runs in test mode — no live funds move. Confirm the
token you're given starts with `test_`.

### Waivers come first

If a waiver applies (student, senior citizen, indigent), **skip payment
entirely**: set `fee_status = 'waived'`, record `waiver_applied`, go straight to
submitted. The seeded Certificate of Indigency is zero-fee, so this path has to
work — and it's the more humane story in the pitch.

### Callback route

`POST /api/pay/callback` — verify, update `fee_status`, append a `request_events`
row. Locally it won't reach you; poll `checkPayment()` on the track page instead.

---

## Task 2 — eMessage (`/implementation/emessage`)

Smallest task on the board, ~20 lines, and it's the **cleanest impact story in
the project**. For someone taking two jeepney rides and losing half a day's wage
to ask whether a document is ready, this message *is* the product.

My implementation has two things wrong: bearer auth instead of the custom
header, and the field is `number`, not `mobile_number`.

```
POST {base_url}/messaging/v1/sms/push
Header: X-EMESSAGE-Auth: {api_token}
Body:   { "number": "+639090000000", "message": "..." }
→ 201 Created
```

Note `number` is **E.164 with a leading `+`**. My `normalizeMobile()` strips it —
fix that to produce `+639...`.

Fires when Earl's issuance completes. `issuedSmsBody()` already exists; it needs
the control number and verify URL.

---

## Task 3 — LGU registration (`/implementation/lgu-onboarding`)

Act 1. Route: `/console/register`.

Currently only Mandaluyong/Plainview is seeded. **Marilao, Bulacan gets
registered live on camera**, so this has to be a real lookup, not a two-item
dropdown.

1. Populate `psgc_reference` (table already created by migration 002) with at
   least NCR and Region III (Bulacan) — region → province → municipality →
   barangay. Write `supabase/seed_psgc.sql`.
2. Search/select an LGU from that reference.
3. Capture official email, create the `lgus` row with `registered_by` and
   `registered_at`.
4. Redirect to that LGU's dashboard, showing **"0 active eServices"** — the
   empty state Act 1 opens on. Make it look deliberate, not broken.

**Must work for an LGU nobody rehearsed.** A judge may ask you to register their
own municipality.

---

## Task 4 — approval queue (`/implementation/approval-queue`)

Route: `/console/requests`. Act 4's trigger.

A table of incoming requests for the officer's LGU, filtered by
`lgu_services.approval_office` — the AI-generated service says "Municipal Health
Office", and requests route there. `listRequestsForLgu()` already exists.

Approve → `POST /api/requests/[id]/approve`, which:

1. sets `status = 'approved'`
2. calls Earl's `generateDocument()`
3. calls Earl's `anchorHash()`
4. calls your `pushSms()`
5. appends a `request_events` row for each step
6. sets `status = 'issued'`

That chain is the demo's payoff. Each step writes an audit event — that trail is
what makes "we removed the labour, not the oversight" a thing you can point at on
screen rather than assert.

Also show the citizen's liveness score and eVerify reference on each row, so the
officer sees what was verified before they approve.

---

## Task 5 — analytics (CUTTABLE)

`/console/analytics`. Volume, completion rate, median time-to-issue.

**Only if tasks 1–4 are done.** It's in the draft flow but it's the least
load-bearing item on the board — nothing else depends on it, and no judging
criterion rewards it directly. Cut it without guilt.

---

## Contracts to freeze by 23:00

```ts
export async function generatePayment(amount: number, description: string, txnid: string):
  Promise<EgovResult<PaymentIntent>>
export async function checkPayment(uuid: string): Promise<EgovResult<PaymentIntent>>
export async function pushSms(mobile: string, message: string): Promise<EgovResult<SmsResult>>
export async function searchPsgc(query: string): Promise<PsgcEntry[]>
```

---

## Files you own

```
src/lib/egov/pay.ts, emessage.ts
src/app/pay/, src/app/api/pay/
src/app/console/register/, requests/, analytics/
src/app/api/lgus/, src/app/api/requests/
supabase/seed_psgc.sql
```
