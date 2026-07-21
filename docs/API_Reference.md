# eGovPH API — Consolidated Integration Reference

A single reference collating the high-level catalog (`api_catalog_documentation_final.md`) with the correct routes, auth schemes, arguments, and worked examples pulled from each per-service file. Services appear in catalog order.

Scoped to the 7 registered services this project integrates against: eGOV PH (SSO), #NationalID / eVerify, FACE LIVENESS, eMessage, eGov AI, eGOV PAY, eGOV chain. eReport and DBM COMPASS are not registered for this project (see `docs/01_hackathon_overview.md`) and are documented elsewhere if needed.

> Placeholder variables (`{{base_url}}`, `{{base}}`, `{{baseUrl}}`, `{{rpcUrl}}`, `{{apiKey}}`, tokens, etc.) are Postman-environment variables — substitute your issued values. Note the base-variable spelling differs per service.

## Base URL & auth legend

| Service | Base variable | Auth mechanism |
|---|---|---|
| eGOV PH (SSO) | `{{base_url}}` | Bearer `{{access_token}}` (from `POST /api/token`) |
| #NationalID / eVerify | `{{base_url}}` | Bearer `{{access_token}}` (from `POST /api/auth`) |
| eMessage | `{{base_url}}` | Header `X-EMESSAGE-Auth: {{api_token}}` |
| eGov AI | `{{base}}` | Bearer `{{hackathon_token}}` (from token endpoint) |
| eGOV PAY | `{{base_url}}` | Header `X-eGovPay-Token: {{api_token}}` (`test_` prefix = test mode) |
| eGOV chain | `{{rpcUrl}}` = `https://hackathon-blockchain.e.gov.ph` | None (JSON-RPC 2.0) |
| FACE LIVENESS | `{{baseUrl}}` | Header `x-api-key: {{apiKey}}` (lowercase) |

---

## eGOV PH

- **Category:** Single sign-on
- **Description:** Single Sign-On integration for eGov partners. OAuth 2.0 authorization-code flow: after a user authenticates, exchange the issued code for an access token, then resolve the user's profile.
- **Test account:** `josie@yopmail.com`

### Client-side: eGov SSO Widget

A lightweight SSO widget that embeds eGovPH authentication into a native web app or React app. The widget renders the entire login UI (mobile/email entry → OTP → security notice → MPIN) and, on success, hands your callback an **`exchange_code`** — which your backend then exchanges for an access token via [Generate Access Token](#generate-access-token) below.

> The widget returns an exchange code, **not** a token. Perform the token exchange server-side (it needs your `partner_secret`); never exchange from client-side JS. The exchange code is single-use and short-lived — exchange it immediately.

**Native web app** — add the `<meta>` tags, define a global success handler, then drop in the widget markup + script:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="egov-environment" content="STAGING">
  <meta name="egov-client-id" content="YOUR_CLIENT_ID">
  <meta name="egov-sso-onsuccess" content="CUSTOM_ONSUCCESS_FUNCTION">
  <script>
    function CUSTOM_ONSUCCESS_FUNCTION(exchange_code) {
      // Send exchange_code to your backend to exchange for an access token
      console.log(exchange_code);
    }
  </script>
</head>
<body>
  <div id="egov-sso-widget-button"></div>
  <div id="egov-sso-widget-portal"></div>
  <script async defer src="https://widgets.e.gov.ph/egov-hackathon-sso-widget.js"></script>
</body>
</html>
```

**React** — install `egov-hackathon-sso-widget`, then render the widget alongside the portal `<div>`:

```jsx
import EGovSSOWidget from 'egov-hackathon-sso-widget';

export default () => (
  <>
    <EGovSSOWidget
      environment="STAGING"
      client_id="{{YOUR_CLIENT_ID}}"
      on_success_function={(exchange_code) => { console.log(exchange_code); }}
    />
    <div id="egov-sso-widget-portal"></div>
  </>
);
```

**Configuration:**

| Config | Native (`<meta name>`) | React (prop) | Values |
|---|---|---|---|
| Environment | `egov-environment` | `environment` | `STAGING` (use `PRODUCTION` only for live) |
| Client ID | `egov-client-id` | `client_id` | Your app's registered client ID (environment-specific) |
| Success callback | `egov-sso-onsuccess` | `on_success_function` | Global function name (native) / function ref (React), receives `exchange_code` |

**Requirements & notes:**
- Both `#egov-sso-widget-button` (mounts the trigger button) and `#egov-sso-widget-portal` (renders the login modal) must be present in the DOM — the portal is required even in React, since the modal renders outside the component tree.
- Load the script with `async defer` to avoid blocking render.
- The login screens are rendered entirely by the widget; your only integration points are the button mount, the portal mount, and the success callback.

### Generate Access Token
`POST {{base_url}}/api/token`

Exchanges an authorization (exchange) code for an access token via the eGov SSO service.

- **Auth:** none (credentials in body)

| Field | Type | Required | Description |
|---|---|---|---|
| `exchange_code` | string | Yes | Authorization code received after user authentication. Single-use, short-lived. |
| `scope` | string | Yes | Requested scope. Use `SSO_AUTHENTICATION` for standard SSO login. |
| `partner_code` | string | Yes | Unique code identifying the partner/agency system. |
| `partner_secret` | string | Yes | Secret key for the partner account. Keep server-side only. |

**Responses:** 200 OK · 403 Forbidden (invalid/unauthorized partner) · 422 Unprocessable Entity (exchange code invalid or already used/expired).

**Notes:** `exchange_code` is single-use and expires quickly. Never expose `partner_secret` client-side. Use the returned token as `Authorization: Bearer` on subsequent requests.

```json
{
  "exchange_code": "generated_exchange_code",
  "scope": "SSO_AUTHENTICATION",
  "partner_code": "{{partner_code}}",
  "partner_secret": "{{partner_secret}}"
}
```

```bash
curl --request POST \
  --url '{{base_url}}/api/token' \
  --header 'Content-Type: application/json' \
  --data '{
    "exchange_code": "generated_exchange_code",
    "scope": "SSO_AUTHENTICATION",
    "partner_code": "{{partner_code}}",
    "partner_secret": "{{partner_secret}}"
}'
```

Response · 200 OK:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### SSO Authentication
`POST {{base_url}}/api/partner/sso_authentication`

Resolves the authenticated user's profile for a partner app. Call after obtaining an access token.

- **Auth:** Bearer `{{access_token}}`
- **Request body:** none — the caller is identified entirely by the bearer token.

**Responses:** 200 OK (returns citizen profile) · 401 Unauthorized (token missing/invalid/expired).

```bash
curl --request POST \
  --url '{{base_url}}/api/partner/sso_authentication' \
  --header 'Authorization: Bearer {{access_token}}'
```

Response · 200 OK (profile, abridged — source example includes `signature`, `signature_url`, and an `additional_information.health_data` block):
```json
{
  "status": 200,
  "message": "OK",
  "data": {
    "uniqid": "MVPCBEUVCGPZR",
    "email": "josie@yopmail.com",
    "birth_date": "1990-01-01",
    "first_name": "JOSIE",
    "middle_name": "SANTOS",
    "last_name": "DELA CRUZ",
    "suffix": null,
    "gender": "female",
    "nationality": "Filipino",
    "mobile": "+639090000000",
    "address": "1123 RIZAL ST., POBLACION, CITY OF ALAMINOS, PANGASINAN, PHILIPPINES",
    "barangay": "POBLACION",
    "municipality": "CITY OF ALAMINOS",
    "region": "REGION I (ILOCOS REGION)",
    "province": "PANGASINAN",
    "country": "Philippines",
    "country_alpha_2_code": "PH",
    "country_alpha_3_code": "PHL",
    "barangay_code": "0105503021",
    "province_code": "0105500000",
    "municipality_code": "0105503000",
    "region_code": "0100000000"
  }
}
```
> The source `egovph.md` response is truncated mid-`additional_information`; fields above are the confirmed profile keys.

---

## #NationalID | eVerify

- **Category:** Identity verification
- **Description:** NIDAS eVerify — verify citizen identity against PhilSys/NIDAS in real time (Tier 1 / Tier 2), with consent built into every check.
- **Verification flow:** (1) get an `access_token` from `/api/auth`; (2) obtain a `face_liveness_session_id` from the Face Liveness Web SDK — `window.eKYC().start({ pubKey })`, then use `result.session_id` (public SDK key = `{{public_api_key}}`; see [eVerify Face Liveness Web SDK](#client-side-everify-face-liveness-web-sdk) under FACE LIVENESS); (3) submit to a verify endpoint.

### Authenticate (Generate Access Token)
`POST {{base_url}}/api/auth`

Server-to-server token for the eVerify API. Required by all verify endpoints.

- **Auth:** none (credentials in body)

| Field | Type | Required | Description |
|---|---|---|---|
| `client_id` | string | Yes | Assigned API Client ID. |
| `client_secret` | string | Yes | Assigned API Client Secret. Keep server-side only. |

**Responses:** 200 OK · 403 Forbidden (invalid credentials).

```bash
curl --request POST \
  --url '{{base_url}}/api/auth' \
  --header 'Content-Type: application/json' \
  --data '{ "client_id": "{{client_id}}", "client_secret": "{{client_secret}}" }'
```

Response · 200 OK:
```json
{
  "data": {
    "access_token": "eyJ0eXAiOiJKV1Qi...",
    "token_type": "Bearer",
    "expires_at": "1724223772"
  }
}
```

### Verify Personal Information
`POST {{base_url}}/api/query`

Compares demographic input + biometrics (Face Liveness) against the NIDAS database.

- **Auth:** Bearer `{{access_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `first_name` | string | Yes | |
| `middle_name` | string | No | |
| `last_name` | string | Yes | |
| `suffix` | string | No | |
| `birth_date` | string (YYYY-MM-DD) | Yes | |
| `face_liveness_session_id` | string (UUID) | Yes | `session_id` from the Face Liveness Web SDK. |

**Responses:** 200 Success · 401 Unauthorized.

```bash
curl --request POST \
  --url '{{base_url}}/api/query' \
  --header 'Authorization: Bearer {{access_token}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "first_name": "Juan",
    "middle_name": "Santos",
    "last_name": "Dela Cruz",
    "suffix": "JR",
    "birth_date": "1989-09-12",
    "face_liveness_session_id": "a1b3fae6-af74-4896-bd58-32a81604de01"
}'
```

Response · 200 OK (abridged — full response includes permanent + present address blocks and place-of-birth fields):
```json
{
  "data": {
    "code": "AAA000",
    "token": "268259975162549530929556586925358978",
    "reference": "3013490625984368",
    "face_url": "https://liveness.photo.url/image.jpg?expires=123",
    "full_name": "JUAN SANTOS DELA CRUZ",
    "gender": "Male",
    "marital_status": "Single",
    "blood_type": "A",
    "mobile_number": "639090000000",
    "birth_date": "1990-01-01",
    "full_address": "123 Sample Street, Sample Barangay, Sample City, Sample Province, Philippines, 1000",
    "present_full_address": "123 Sample Street, Sample Barangay, Sample City, Sample Province, Philippines, 1000",
    "place_of_birth": "Sample City, Sample Province"
  },
  "meta": { "tier_level": "Tier II", "result_grade": 1 }
}
```

### QR Check
`POST {{base_url}}/api/query/qr/check`

Decodes and decrypts a scanned National ID QR value and returns the verified demographics stored inside — **no biometrics**.

- **Auth:** Bearer `{{access_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `value` | string | Yes | Raw string scanned from the National ID QR code. |

**Responses:** 200 OK (valid; returns decrypted data) · 422 Unprocessable Content (invalid QR format). Saved success examples cover: Philsys Card Number, Digital ID, National ID Signed, ePhilId, Philsys Card.

```bash
curl --request POST \
  --url '{{base_url}}/api/query/qr/check' \
  --header 'Authorization: Bearer {{access_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "value": "RAW_QR_CODE_VALUE" }'
```

Response · 200 OK:
```json
{
  "data": { "pcn": "1234-1234-1234-1234" },
  "meta": { "qr_type": "Philsys Card Number" }
}
```

### QR Verify
`POST {{base_url}}/api/query/qr`

Full identity verification: scanned QR value **plus** matching biometrics (Face Liveness).

- **Auth:** Bearer `{{access_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `value` | string | Yes | Raw string scanned from the National ID QR code. |
| `face_liveness_session_id` | string (UUID) | Yes | `session_id` from the Face Liveness Web SDK. |

**Responses:** 200 OK. Saved examples: "Matched" and "Unverified (Face Mismatch)". Returns the same rich profile shape as `/api/query` (`data.code`, `token`, `reference`, `face_url`, full + present demographics/address, place of birth) plus `meta.tier_level` and `meta.result_grade`.

```bash
curl --request POST \
  --url '{{base_url}}/api/query/qr' \
  --header 'Authorization: Bearer {{access_token}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "value": "RAW_QR_CODE_VALUE",
    "face_liveness_session_id": "a1b3fae6-af74-4896-bd58-32a81604de01"
}'
```

---

## eMessage

- **Category:** Notifications
- **Description:** Deliver SMS, email and in-app notices to citizens through a single messaging API. (Only Push SMS is documented in the source.)

### Push SMS
`POST {{base_url}}/messaging/v1/sms/push`

- **Auth:** Header `X-EMESSAGE-Auth: {{api_token}}` (required) · `Content-Type: application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `number` | string | Yes | Recipient mobile number in E.164 format, e.g. `+639090000000`. |
| `message` | string | Yes | SMS message body. |

**Responses:** 201 Created · 400 Bad Request · 422 Unprocessable Entity.

```bash
curl --request POST \
  --url '{{base_url}}/messaging/v1/sms/push' \
  --header 'X-EMESSAGE-Auth: {{api_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "number": "+639090000000", "message": "Test message" }'
```

Response · 201 Created:
```json
{ "data": { "message": "SMS was successfully created." } }
```

---

## eGov AI

- **Category:** AI services
- **Description:** Document intelligence, translation and conversational endpoints tuned for government workloads. Part of the eGov Hackathon 2026 collection.
- **Base:** `{{base}}` · common prefix `/api/v1/egov/integration/`
- **Auth (all except token endpoint):** Bearer `{{hackathon_token}}`

### Generate Access Token
`POST {{base}}/api/v1/egov/integration/token`

Short-lived token for the eGov AI API. On success the test script stores it into the `hackathon_token` env var.

- **Auth:** none (access code in body)

| Field | Type | Required | Description |
|---|---|---|---|
| `access_code` | string | Yes | Unique access code issued to your team (`{{access_code}}`). |

```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/token' \
  --header 'Content-Type: application/json' \
  --data '{ "access_code": "{{access_code}}" }'
```

Response · 200 OK:
```json
{
  "access_token": "bebaddec-de7e-4d4e-91b1-ae3a73544b22",
  "expires_in_seconds": 28800,
  "credits_total": 200,
  "credits_remaining": 200
}
```

### AI Assistant
`POST {{base}}/api/v1/egov/integration/ai_assistant/generate`

Answers a natural-language query about eGov services, scoped to a region/category.

- **Auth:** Bearer `{{hackathon_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | Yes | User's natural-language question (e.g. "how can i get my digital tin id here in egov"). |
| `category` | string | Yes | Country/region code scoping the answer (e.g. `PH`). |

**Response:** `data` (answer string, may include Markdown), `session_id` (UUID).

```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/ai_assistant/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "how can i get my digital tin id here in egov", "category": "PH" }'
```

### Speech Maker
`POST {{base}}/api/v1/egov/integration/speech_maker/generate`

Generates a speech tailored to a topic and locale/category.

- **Auth:** Bearer `{{hackathon_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | Yes | Topic or instruction for the speech. |
| `category` | string | Yes | Locale/category context (e.g. `PH`). |

**Response:** `data` (speech string), `session_id` (UUID).

```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/speech_maker/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "Give me a speech about current trends in PH", "category": "PH" }'
```

### Tourism (Tourism Content Generator)
`POST {{base}}/api/v1/egov/integration/tourism/generate`

Generates travel/tourism content (itineraries, cultural insights) for a destination.

- **Auth:** Bearer `{{hackathon_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | Yes | Instruction describing the tourism content (e.g. "Provide travel itinerary for Boracay"). |
| `category` | string | Yes | Country/region code (e.g. `PH`). |

**Response:** `data` (Markdown-supported content), `session_id` (UUID).

```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/tourism/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "Provide travel itinerary for Boracay", "category": "PH" }'
```

### Laws & Regulations
`POST {{base}}/api/v1/egov/integration/laws_and_regulations/generate`

Answers legal/regulatory questions via a model tuned to government regulations.

- **Auth:** Bearer `{{hackathon_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | Yes | Natural-language legal/regulatory question. |
| `category` | string | Yes | Jurisdiction/category code (e.g. `PH`). |

**Response:** `data` (answer string), `session_id` (UUID).

```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/laws_and_regulations/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "Can you explain your purpose?", "category": "PH" }'
```

### Translator
`POST {{base}}/api/v1/egov/integration/translator/generate`

Translates text between languages.

- **Auth:** Bearer `{{hackathon_token}}`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | Yes | Text to translate (supports paragraph-length input). |
| `source_lang` | string | Yes | Source language code, ISO 639-1 (e.g. `en`). |
| `target_lang` | string | Yes | Target language code, ISO 639-1 (e.g. `fil`). |

**Response:** `original_prompt`, `source_lang`, `target_lang`, `translate_from` ({`code`, `label`}), `translated_prompt`, `transliterated_prompt`.

```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/translator/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "prompt": "How should the education system adapt...?",
    "source_lang": "en",
    "target_lang": "fil"
}'
```

### Document Extractor
`POST {{base}}/api/v1/egov/integration/document_extractor/generate`

Extracts structured fields from an uploaded document image/file via OCR + document analysis.

- **Auth:** Bearer `{{hackathon_token}}`
- **Body:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | Document image/file (ID, license, gov document). Typically JPEG, PNG, or PDF. |

**Response:** `data` — extracted fields as an HTML-formatted string using `<br>` / `<b>` tags (e.g. Document Type, Issuing Authority, Name, DOB, License No.).

```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/document_extractor/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --form 'file=@/path/to/document.jpg'
```
> The source cURL omits the `-F file=...` part; add it to actually upload a file.

### Token Credits
`GET {{base}}/api/v1/egov/integration/credits`

Returns the current API credit balance. Check before resource-intensive calls.

- **Auth:** Bearer `{{hackathon_token}}`

**Response:** `credits_total`, `credits_used`, `credits_remaining`, `expires_at`.

```bash
curl --request GET \
  --url '{{base}}/api/v1/egov/integration/credits' \
  --header 'Authorization: Bearer {{hackathon_token}}'
```

Response · 200 OK:
```json
{
  "credits_total": 200,
  "credits_used": 5,
  "credits_remaining": 195,
  "expires_at": "2026-07-10T23:33:34.000+08:00"
}
```

---

## eGOV PAY

- **Category:** Digital payments
- **Description:** Collect and reconcile government fees and charges through one gateway, with real-time settlement across accredited payment channels.
- **Auth (all endpoints):** Header `X-eGovPay-Token: {{api_token}}` (required). A `test_`-prefixed token runs in test mode (no live funds move). `Content-Type: application/json; charset=utf-8`.

### Generate Payment
`POST {{base_url}}/api/v1/transaction`

Creates a payment transaction and returns a hosted payment-gateway link.

| Field | Type | Required | Description |
|---|---|---|---|
| `items` | array | Yes | Line items being paid for. |
| `items[].name` | string | Yes | Item name. |
| `items[].amount` | double | Yes | Item amount. |
| `amount` | double | Yes | Total transaction amount. |
| `settlement_template_uuid` | uuid | Yes | Settlement template for bank settlements. |
| `redirect_url` | url | Yes | Where to redirect the customer after payment is processed. |
| `txnid` | string | Yes | Transaction ID generated by the biller/merchant. |
| `callback_url` | url | Yes | Notified on every transaction status change. |
| `digest` | string | Yes | HMAC-SHA256 keyed by API token: `hash_hmac('sha256', "$amount\|$txnid", $token)`. Recompute per request. |
| `currency` | string | No | e.g. `PHP`. |
| `mobile` | string | No | Customer mobile (for e-receipt). |
| `email` | string | No | Customer email. |
| `name` | string | No | Customer name. |
| `expires_at` | datetime | No | Transaction expiry, `YYYY-MM-DD HH:MM:SS`. |
| `link_expires_at` | datetime | No | Payment-link expiry, `YYYY-MM-DD HH:MM:SS`. |
| `description` | object | No | Additional transaction information. |

**Responses:** 201 Created · 401 Unauthorized · 422 Unprocessable Entity.

```bash
curl --request POST \
  --url '{{base_url}}/api/v1/transaction' \
  --header 'X-eGovPay-Token: {{api_token}}' \
  --header 'Content-Type: application/json; charset=utf-8' \
  --data '{
    "amount": 1000,
    "settlement_template_uuid": "{{template_id}}",
    "currency": "PHP",
    "digest": "c5989a520055e65025a695bb1483b30b6cd7923c79c648fff5e757bbabc62fa2",
    "mobile": "09XXXXXXXXX",
    "expires_at": "2027-07-10 23:59:59",
    "callback_url": "https://localhost:8000/callback",
    "redirect_url": "https://localhost:8001/",
    "txnid": "TESTREF123",
    "link_expires_at": "2027-07-10 23:59:59",
    "email": "your@email.com",
    "name": "TEST",
    "items": [ { "name": "Item # 1", "amount": 1000 } ]
}'
```

Response · 201 Created:
```json
{
  "data": {
    "uuid": "a23977c3-f2f2-4e5c-bf53-94bcff48e49c",
    "url": "https://egovpay-pgi-dev.oueg.info/a23977c3-f2f2-4e5c-bf53-94bcff48e49c",
    "channel": { "refno": "0IOKUXQ5XX" }
  }
}
```

### Check Transaction Details
`GET {{base_url}}/api/v1/transaction/{{transaction_uuid}}`

Returns transaction details by UUID.

- **Path param:** `uuid` (uuid, required) — transaction UUID returned at generation.

**Responses:** 200 OK · 404 Not Found · 401 Unauthorized.

```bash
curl --request GET \
  --url '{{base_url}}/api/v1/transaction/{{transaction_uuid}}' \
  --header 'X-eGovPay-Token: {{api_token}}' \
  --header 'Content-Type: application/json; charset=utf-8'
```

Response · 200 OK (abridged):
```json
{
  "data": {
    "uuid": "a23977c3-f2f2-4e5c-bf53-94bcff48e49c",
    "refno": "0IOKUXQ5XX",
    "txnid": "TESTREF123",
    "environment_type": "TEST",
    "items": [ { "name": "Item # 1", "amount": "1000" } ],
    "amount": "1000.0000",
    "system_fee": "0.0000",
    "channel_fee": "0.0000",
    "partner_fee": "0.0000",
    "currency": "PHP",
    "payment_status": "INITIAL",
    "payment_channel": null,
    "callback_url": "https://localhost:8000/callback",
    "redirect_url": "https://localhost:8001/",
    "paid_at": null,
    "created_at": "July 10, 2026 05:51:01 PM"
  }
}
```

### Void Transaction
`PUT {{base_url}}/api/v1/transaction/{{transaction_uuid}}/void`

Voids a transaction by UUID.

- **Path param:** `uuid` (uuid, required) — transaction UUID to void.

**Responses:** 200 OK · 400 Bad Request · 401 Unauthorized · 404 Not Found.

```bash
curl --request PUT \
  --url '{{base_url}}/api/v1/transaction/{{transaction_uuid}}/void' \
  --header 'X-eGovPay-Token: {{api_token}}' \
  --header 'Content-Type: application/json; charset=utf-8'
```

Response · 200 OK:
```json
{ "data": { "message": "You have successfully voided this transaction." } }
```

---

## eGOV chain

- **Category:** Blockchain
- **Description:** Anchor records and run smart contracts on a zero-fee government blockchain (Hyperledger Besu, QBFT) over JSON-RPC, for tamper-evident, verifiable state.
- **Chain facts:** RPC `{{rpcUrl}}` = `https://hackathon-blockchain.e.gov.ph` · Chain ID `13371` (`0x343b`) · Gas price `0` (zero fees; `eth_gasPrice` → `0x0`, no ETH needed) · Explorer `https://hackathon-explorer.e.gov.ph`.
- **Tooling:** Remix, Hardhat, Foundry, MetaMask, or any Ethereum tooling pointed at that RPC. You may deploy your own contracts.
- **Auth:** none documented. `Content-Type: application/json`.
- **Request shape (all calls):** `POST {{rpcUrl}}` with a JSON-RPC 2.0 body: `{ "jsonrpc": "2.0", "method": "<method>", "params": [...], "id": <n> }`.

### rpc_modules (worked example)
`POST {{rpcUrl}}`

Lists enabled JSON-RPC namespaces on the Besu node.

- **Method:** `rpc_modules` · **Params:** `[]`

```bash
curl --request POST \
  --url '{{rpcUrl}}' \
  --header 'Content-Type: application/json' \
  --data '{ "jsonrpc": "2.0", "method": "rpc_modules", "params": [], "id": 1 }'
```

Response · 200 OK:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "txpool": "1.0", "trace": "1.0", "debug": "1.0", "eth": "1.0",
    "web3": "1.0", "admin": "1.0", "qbft": "1.0", "net": "1.0"
  }
}
```

### Methods available (names only)

> Only `rpc_modules` above has a worked request/response example in the source. The methods below are enumerated by the catalog but have no argument-level detail in the source files — call them as standard Besu/Ethereum JSON-RPC methods (`POST {{rpcUrl}}`, same JSON-RPC 2.0 envelope). Operator-only namespaces (ADMIN, DEBUG, TRACE) are excluded from the participant scope.

- **Misc:** `rpc_modules`
- **WEB3:** `web3_clientVersion`, `web3_sha3`
- **NET:** `net_version`, `net_listening`, `net_peerCount`, `net_enode`, `net_services`
- **ETH — chain / gas:** `eth_chainId`, `eth_protocolVersion`, `eth_syncing`, `eth_coinbase`, `eth_mining`, `eth_hashrate`, `eth_gasPrice`, `eth_maxPriorityFeePerGas`, `eth_feeHistory`, `eth_blobBaseFee`, `eth_blockNumber`
- **ETH — accounts / state:** `eth_accounts`, `eth_getBalance`, `eth_getBalance` (at block), `eth_getTransactionCount`, `eth_getTransactionCount` (pending), `eth_getCode`, `eth_getStorageAt`, `eth_getProof`
- **ETH — blocks:** `eth_getBlockByNumber` (latest), `eth_getBlockByNumber` (full txs), `eth_getBlockByHash`, `eth_getBlockTransactionCountByNumber`, `eth_getBlockTransactionCountByHash`, `eth_getBlockReceipts`, `eth_getUncleCountByBlockNumber`, `eth_getUncleCountByBlockHash`, `eth_getUncleByBlockNumberAndIndex`
- **ETH — transactions:** `eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_getTransactionByBlockNumberAndIndex`, `eth_getTransactionByBlockHashAndIndex`, `eth_sendRawTransaction`
- **ETH — filters / logs:** `eth_newBlockFilter`, `eth_newPendingTransactionFilter`, `eth_newFilter`, `eth_getFilterChanges`, `eth_getFilterLogs`, `eth_uninstallFilter`, `eth_getLogs`
- **ETH — call / estimate:** `eth_call`, `eth_estimateGas`, `eth_createAccessList`
- **QBFT (read-only):** `qbft_getValidatorsByBlockNumber`, `qbft_getValidatorsByBlockHash`, `qbft_getPendingVotes`, `qbft_getSignerMetrics`
- **TXPOOL:** `txpool_besuStatistics`, `txpool_besuTransactions`, `txpool_besuPendingTransactions`
- **Contracts — HackathonGuestbook (demo `eth_call` samples):** `eth_getCode` (HackathonGuestbook), `eth_call — teamCount()`, `eth_call — listTeams()`, `eth_call — getTeam(0)`, `eth_call — entryCount()`, `eth_call — getEntry(0)`, `eth_call — createTeam("Team Alpha")` (SIMULATION ONLY), `eth_call — post("Hello hackathon!")` (SIMULATION ONLY), `eth_call — postForTeam(0, "Go Alpha!")` (SIMULATION ONLY), `eth_estimateGas — createTeam("Team Alpha")`, `eth_getLogs — TeamCreated events`, `eth_getLogs — MessagePosted events`

---

## FACE LIVENESS

- **Category:** Liveness detection
- **Description:** Confirm a live person is present during identity capture: create a liveness session, then fetch the verification result.
- **Auth (all endpoints):** Header `x-api-key: {{apiKey}}` (lowercase).

### Client-side: eVerify Face Liveness Web SDK

The eVerify Face Liveness Web SDK runs the biometric liveness check in the browser. On success it yields a **`session_id`** and a temporary **`photo_url`**, which your backend passes as `face_liveness_session_id` to the [eVerify](#nationalid--everify) `/api/query` and `/api/query/qr` endpoints.

> This is a separate, SDK-driven liveness path (host `hackathon-everify-face-liveness.e.gov.ph`) distinct from the standalone Create Session / Get Verification Result REST endpoints below (host `hackathon-face-liveness.e.gov.ph`). Use this SDK when the goal is eVerify identity verification.

**1. Import the SDK:**

```html
<script src="https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js"></script>
```

**2. Initialize and start the check** — call `window.eKYC().start()` with your Public API Key:

```js
window.eKYC().start({ pubKey: "YOUR_PUBLIC_API_KEY" })
  .then((response) => {
    const sessionId = response.result.session_id;
    const photoUrl  = response.result.photo_url;
    // Send sessionId to your backend to verify against demographics or QR codes.
  })
  .catch((error) => {
    // Handle error or user cancellation
    console.error("Liveness check error or cancelled:", error);
  });
```

**3. SDK success payload:**

```json
{
  "status": "COMPLETED",
  "result": {
    "photo": "data:image/jpeg;base64,...",
    "session_id": "a1b3fae6-af74-4896-bd58-32a81604de01",
    "photo_url": "https://liveness.photo.url/image.jpg?expires=123"
  }
}
```

| Property | Type | Description |
|---|---|---|
| `status` | string | Session status, e.g. `COMPLETED`. |
| `result.photo` | string | Base64-encoded captured selfie. |
| `result.session_id` | string (UUID) | Unique identifier for the completed liveness session. |
| `result.photo_url` | string | Secure temporary URL of the captured face image. |

**4. Submit to eVerify** — pass the SDK's `session_id` as `face_liveness_session_id` in the eVerify verify payload:

```json
{
  "first_name": "Juan",
  "middle_name": "Santos",
  "last_name": "Dela Cruz",
  "suffix": "JR",
  "birth_date": "1989-09-12",
  "face_liveness_session_id": "a1b3fae6-af74-4896-bd58-32a81604de01"
}
```

### Create Session
`POST {{baseUrl}}/v1/liveness/session`

Initializes a liveness session and returns a dynamic verification URL + session token.

- **Auth:** `x-api-key: {{apiKey}}` · `Content-Type: application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | User flow on completion. One of `redirect`, `post`, `close`. |
| `callback_url` | string | Yes (for `redirect`) | Destination URL the user is redirected to; only applies when `action` = `redirect`. |
| `delay` | integer | No | ms to show the completion screen before redirecting/closing. Default `3000`. |

**Response · 201 Created:** `token` (session token UUID), `url` (verification URL with `token`, `action`, `callbackUrl`, `delay` query params). Saved examples: Redirect Flow, Post Message Flow, Close Flow.

```bash
curl --request POST \
  --url '{{baseUrl}}/v1/liveness/session' \
  --header 'x-api-key: {{apiKey}}' \
  --header 'Content-Type: application/json' \
  --data '{ "action": "redirect", "callback_url": "https://your-app.com/callback", "delay": 3000 }'
```

Response · 201 Created:
```json
{
  "token": "00000000-0000-0000-0000-000000000000",
  "url": "https://hackathon-face-liveness.e.gov.ph/liveness?token=00000000-0000-0000-0000-000000000000&action=redirect&callbackUrl=https%3A%2F%2Fyour-app.com%2Fcallback&delay=3000"
}
```

### Get Verification Result
`GET {{baseUrl}}/v1/liveness/result/{{sessionToken}}`

Protected backend-to-backend endpoint returning the final result for a session.

- **Auth:** `x-api-key: {{apiKey}}`
- **Path param:** `sessionToken` — the token from Create Session.

**Response · 200 OK:** `status` (e.g. `SUCCEEDED`), `confidence_score` (out of 100.0), `reference_image_url` (pre-signed S3 selfie URL).

> **Acceptance thresholds (recommended):** treat the session as verified only when `status` is **exactly `"SUCCEEDED"`** and `confidence_score >= 95.0`. If the score is below 95.0, reject as high-risk and request a retry.

```bash
curl --request GET \
  --url '{{baseUrl}}/v1/liveness/result/{{sessionToken}}' \
  --header 'x-api-key: {{apiKey}}'
```

Response · 200 OK:
```json
{
  "status": "SUCCEEDED",
  "confidence_score": 98.71,
  "reference_image_url": "https://face-liveness-audit-staging-tokyo.s3.ap-northeast-1.amazonaws.com/liveness-audits/.../reference.jpg?AWSAccessKeyId=..."
}
```

