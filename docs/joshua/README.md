# Joshua — identity chain: SSO → liveness → eVerify

**Role:** AI Engineering, Full stack
**Routes:** `/implementation/egov-sso`, `/implementation/face-liveness`, `/implementation/everify`
**APIs owned:** eGOV PH · FACE LIVENESS · #NationalID / eVerify
**Blocked by:** nobody — start immediately
**You unblock:** Jasmin's citizen flow, Elton's console. **Everyone.**

---

## Read this first

You have the **longest serial chain in the build**, and it got longer than we
first thought:

```
valid exchange_code → SSO Authentication → profile
                                          ↓
                  Face Liveness SDK → session_id
                                          ↓
                  eVerify /api/query (session_id is REQUIRED)
                                          ↓
                                    prefilled form
```

`eVerify` **cannot be called without a `face_liveness_session_id`**. That's why
all three are yours — splitting them would put a blocking handoff in the middle
of the critical path. Start at 22:30, freeze contracts by 23:00.

---

## Task 1 — simplify SSO authentication (`/implementation/egov-sso`)

The earlier client-side SSO instructions are deprecated. Do **not** build a
widget, add a portal element, expose a client ID, or invent an OAuth
`/authorize` redirect. `API_Reference.md` defines the server-side SSO
Authentication contract only: the app receives a valid `exchange_code` from
its configured upstream sign-in handoff, then resolves the profile immediately.

### Server-side SSO sequence

1. Receive a non-empty **`exchange_code`** in the callback or another
   server-controlled handoff. The API reference intentionally does not prescribe
   the browser UI that obtained it.
2. Exchange it immediately for an access token. This is server-only because it
   requires `partner_secret`.
3. Use that token to call SSO Authentication and establish the local session.

```
POST {base_url}/api/token
{ exchange_code, scope: "SSO_AUTHENTICATION", partner_code, partner_secret }
  → { access_token }

POST {base_url}/api/partner/sso_authentication
Authorization: Bearer <access_token>          ← NO REQUEST BODY
  → { data: { uniqid, email, first_name, middle_name, last_name, birth_date,
              mobile, address, barangay, municipality, region, province,
              barangay_code, municipality_code, region_code, province_code } }
```

Use `EGOV_SSO_PARTNER_CODE` and `EGOV_SSO_PARTNER_SECRET` in the token request;
they must never reach the browser. The SSO Authentication request has **no
body**. `data.uniqid` is the subject — it is what `officers.egov_sub` matches
on. The exchange code is **single-use and short-lived**, so exchange it
immediately.

Normalize exactly once in `src/lib/egov/sso.ts`: read the profile from
`data`, map `uniqid` to `EgovProfile.sub`, and compose the display name from
the documented snake_case name fields. Preserve the raw payload for audit.

### Keep working

- `src/lib/auth/session.ts` and the role lookup are correct — don't rewrite them.
- Keep mock mode working. `?persona=officer|reviewer|citizen` is how the other
  four sign in while you're mid-refactor. **Breaking mock mode blocks everyone.**
- Test account: `josie@yopmail.com`
- After a real login, log the `uniqid` and update the seeded officer row:
  `update officers set egov_sub = '<uniqid>' where role = 'officer';`

---

## Task 2 — face liveness (`/implementation/face-liveness`)

There are **two different liveness services**. Use the right one for the job.

### A. eVerify Face Liveness Web SDK — this is the one that feeds eVerify

```html
<script src="https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js"></script>
```

```js
window.eKYC().start({ pubKey: process.env.NEXT_PUBLIC_EVERIFY_LIVENESS_PUBLIC_KEY })
  .then(({ result }) => {
    // result.session_id  → send to your backend, this is the eVerify input
    // result.photo_url   → temporary selfie URL
  })
```

### B. Standalone REST (host `hackathon-face-liveness.e.gov.ph`)

`POST {baseUrl}/v1/liveness/session` with `{ action, callback_url, delay }` →
`{ token, url }`, then `GET {baseUrl}/v1/liveness/result/{token}`.
Header is **`x-api-key`, lowercase**.

### The acceptance threshold is not optional

```ts
const passed = status === 'SUCCEEDED' && confidence_score >= 95.0
```

Anything below 95 is **rejected as high-risk with a retry**, and we store the
score in `requests.liveness_score` for audit. Say this number out loud in the
demo — a specific documented threshold reads as rigour; "it checks liveness"
reads as hand-waving.

---

## Task 3 — eVerify (`/implementation/everify`)

My `normalize()` in `src/lib/egov/everify.ts` guesses camelCase name parts. The
real response is different.

```
POST {base_url}/api/auth
{ client_id, client_secret }  → { data: { access_token, expires_at } }

POST {base_url}/api/query
Authorization: Bearer <access_token>
{ first_name, middle_name?, last_name, suffix?, birth_date,
  face_liveness_session_id }        ← REQUIRED, from Task 2
```

Real response shape:

```json
{ "data": { "code": "AAA000", "reference": "3013490625984368",
            "full_name": "JUAN SANTOS DELA CRUZ", "full_address": "...",
            "present_full_address": "...", "birth_date": "1990-01-01",
            "mobile_number": "639090000000", "gender": "Male",
            "face_url": "..." },
  "meta": { "tier_level": "Tier II", "result_grade": 1 } }
```

Note it returns **`full_name` and `full_address` as single strings**, not parts.
Keep the existing `VerifiedIdentity` shape and split inside `normalize()` — that
way Jasmin's form code doesn't change.

### Honesty requirement

`yearsOfResidency` **is not in this response.** eVerify confirms a current
registered address, not how long someone has lived there. Keep returning `null`
and let the citizen declare it. Do not invent a number — the whole pitch rests on
not implying PhilSys verified something it didn't, and `<SourceBadge>` exists for
exactly this.

---

## Contracts to freeze by 23:00

```ts
// src/lib/egov/sso.ts
export async function exchangeCode(code: string): Promise<EgovResult<EgovProfile>>

// src/lib/egov/liveness.ts
export async function createLivenessSession(ref: string): Promise<EgovResult<LivenessSession>>
export async function getLivenessResult(token: string): Promise<EgovResult<LivenessResult>>

// src/lib/egov/everify.ts
export async function verifyIdentity(
  q: EverifyQuery & { faceLivenessSessionId: string },
): Promise<EgovResult<VerifiedIdentity>>
```

Commit these with mock data behind them, then refine. Jasmin cannot start the
apply form until `VerifiedIdentity` is fixed.

---

## Execution checklist

### Shared delivery

- [ ] Freeze and commit the three exported contracts with realistic mock data.
- [ ] Keep every call behind `callEgov()` and each `EGOV_*_MODE=live|mock` flag.
- [ ] Render a visible `<SourceBadge>` whenever a fixture supplies the result.
- [ ] Keep each implementation harness working, then wire the same `src/lib/`
  functions into the real sign-in and citizen-apply routes.
- [ ] Add or update the owned browser-QA flow, run `npx tsc --noEmit`, and set
  the relevant manifest entries to `ready` and then `unified`.

### 1. Simplified SSO authentication

- [x] Remove `buildAuthorizeUrl` and all browser-widget/client-ID assumptions;
  no guessed live authorization URL remains.
- [x] Accept the upstream `exchange_code` only in a server-controlled handoff
  and exchange it immediately.
- [x] `POST /api/token` sends `exchange_code`, `scope: "SSO_AUTHENTICATION"`,
  `partner_code`, and `partner_secret`.
- [x] `POST /api/partner/sso_authentication` sends only the resulting bearer
  token and no request body.
- [x] Normalize `data.uniqid`, documented profile fields, and the raw payload;
  retain the existing officer lookup and local role/session behavior.
- [x] Confirm officer, reviewer, and citizen mock personas still sign in.

### 2. Face liveness

- [ ] Use the eVerify Face Liveness Web SDK for the citizen verification path
  and retain its `result.session_id`.
- [ ] Pass that `session_id` to eVerify as `face_liveness_session_id`; do not
  substitute the standalone REST token.
- [ ] For the standalone adapter, use lowercase `x-api-key` and accept only
  `status === "SUCCEEDED" && confidence_score >= 95.0`.
- [ ] Persist the accepted liveness score to `requests.liveness_score`; show a
  retry path for a rejected or cancelled check.

### 3. eVerify

- [ ] Obtain the eVerify server token with `client_id` and `client_secret`.
- [ ] Call `/api/query` with demographics and the required liveness session ID.
- [ ] Normalize `data.full_name` and `data.full_address` from their single-string
  response fields without changing the `VerifiedIdentity` contract.
- [ ] Keep `yearsOfResidency: null`; it is citizen-declared, not PhilSys-verified.
- [ ] Surface the verification result/reference honestly and badge fixture data.

---

## Files you own

```
src/lib/egov/sso.ts, liveness.ts, everify.ts
src/lib/auth/
src/app/api/auth/egov/
src/components/liveness/
```
