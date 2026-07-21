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
SSO → exchange_code → profile
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

## Task 1 — fix SSO (`/implementation/egov-sso`)

My implementation is **wrong**. I built an OAuth authorize-redirect
(`buildAuthorizeUrl` in `src/lib/egov/sso.ts`). The real thing is a **widget**.

### How it actually works

1. The **browser** renders the eGovPH widget, which handles the entire login UI
   (mobile/email → OTP → MPIN).
2. On success it hands your callback an **`exchange_code`** — not a token.
3. Your **server** swaps that for an access token. This must be server-side; it
   needs `partner_secret`.

```jsx
import EGovSSOWidget from 'egov-hackathon-sso-widget'

<EGovSSOWidget
  environment="STAGING"
  client_id={process.env.NEXT_PUBLIC_EGOV_SSO_CLIENT_ID}
  on_success_function={(exchange_code) => { /* POST to your API route */ }}
/>
<div id="egov-sso-widget-portal" />
```

`#egov-sso-widget-portal` **must exist in the DOM even in React** — the modal
renders outside the component tree. Missing it is a silent no-op.

Then server-side:

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

`data.uniqid` is the subject — it's what `officers.egov_sub` matches on. The
exchange code is **single-use and short-lived**; exchange it immediately.

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

## Files you own

```
src/lib/egov/sso.ts, liveness.ts, everify.ts
src/lib/auth/
src/app/api/auth/egov/
src/components/liveness/
```
