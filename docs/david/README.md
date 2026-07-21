# David — AI eService Studio, validation, infrastructure

**Role:** Full stack Cloud & AI Engineer · team lead
**Routes:** `/implementation/ai-studio`, `/implementation/validation-rules`, `/implementation/doc-extract`
**API owned:** eGov AI
**Blocked by:** nobody — start immediately
**You unblock:** `doc-extract`; the Studio is Act 2, the centrepiece of the whole demo

---

## Current delivery status

| Task | Status | Remaining |
|---|---|---|
| Credentials and probes | Implemented | Run the final authoritative seven-service probe with the current credentials and record status/response keys. Do not print tokens or PII. |
| AI eService Studio | `unified` | Perform one controlled live eGov AI generation and one forced OpenAI fallback, then enable production live mode only if both behave as documented. |
| Bounded validation and DICT review | `unified` | None. Both prompt and upload previews are revalidated before the transactional save. |
| Paper form extraction | `unified` | Covered by the Studio upload flow; live extractor certification is part of the AI live check above. |
| Supabase and Vercel deployment | Complete | Keep production variables synchronized after any integration-mode change. |

The application is deployed at [egovdx.vercel.app](https://egovdx.vercel.app).
Production deliberately remains in `EGOV_AI_MODE=mock` until the controlled
live proof succeeds; the implementation already supports eGov AI → OpenAI →
explicit error routing.

---

## Task 0 — credentials and probe (22:30, before anything else)

Four people are idle-ish until this lands, so it comes first.

1. Fill every `EGOV_*` value in `.env.local`. Names now match `docs/API_Reference.md`
   exactly — note `EGOV_SSO_PARTNER_CODE`/`_SECRET` (not client id/secret),
   `EGOV_AI_ACCESS_CODE`, `EGOV_EMESSAGE_API_TOKEN`, `EGOV_PAY_API_TOKEN`.
2. Add `OPENAI_API_KEY` for the Studio fallback.
3. Run it and post the output to the group:

```bash
npx tsx scripts/probe.ts
```

4. For every service that answers, flip `EGOV_<SERVICE>_MODE=live`. Anything
   that fails **stays mock** and you tell its owner why.

`scripts/probe.ts` was written against the old guessed paths — update it to the
real ones from `API_Reference.md` as you go. It is the fastest way to find out
which of the seven actually work, and right now nobody knows.

---

## Task 1 — AI eService Studio (`/implementation/ai-studio`)

**The centrepiece.** An officer types a sentence; a complete, valid eService
comes out.

```
"Create a Business Sanitation Permit Request for Marilao. Require proof of
 business address and Mayor's Permit number. Charge a fee of ₱150. Route
 approvals to the Municipal Health Office."
```

must produce form fields, a fee rule, required documents, and an approval office.

### The contract to freeze by 23:00

```ts
// src/lib/studio/generate.ts
export type GeneratedService = {
  templateCode: string          // best-matching DICT template
  name: string
  formFields: FormField[]       // reuse the type in src/lib/supabase/types.ts
  feeAmount: number
  waivers: Waiver[]
  requiredDocs: string[]
  eligibility: Eligibility
  approvalOffice: string | null
  confidence: number            // 0..1, drives whether we auto-flag
}

export async function generateService(
  prompt: string,
  lguId: string,
): Promise<EgovResult<GeneratedService>>
```

Commit this with a hardcoded return value first. Jasmin and Elton both render
this shape.

### How to actually generate it

`POST {base}/api/v1/egov/integration/ai_assistant/generate` with
`{ prompt, category: "PH" }`, bearer `hackathon_token`.

That endpoint is tuned for eGov Q&A and returns **prose, possibly Markdown** —
it is not a structured-output API. So:

1. Wrap the officer's prompt in a strict instruction: return **only** JSON
   matching the schema, no prose, no code fences.
2. Parse defensively — strip ``` fences, find the outermost `{...}`, `JSON.parse`.
3. **If parsing fails, fall back to OpenAI** with the same schema instruction
   and `response_format: { type: 'json_object' }`, which guarantees valid JSON.
4. Record which engine produced it in `lgu_services.generator_model`. Be honest
   in the UI about which one ran — a judge asking "which AI did that" gets a
   straight answer either way.

Token: `POST {base}/api/v1/egov/integration/token` with `{ access_code }` →
`{ access_token, expires_in_seconds, credits_remaining }`. `getAccessToken()` in
`src/lib/egov/client.ts` already handles caching.

### ⚠️ 200 credits, total

Every generation spends credits. Check `GET /api/v1/egov/integration/credits`
before recording, and **cache generations by prompt hash during development** so
re-testing the same prompt costs nothing. Burning the quota at 02:00 ends Act 2.

### Definition of done

A prompt nobody on the team has typed before — say *"Tricycle franchise renewal
for Marilao, ₱300, require OR/CR and barangay clearance"* — produces a usable
service. Not just the rehearsed one.

---

## Task 2 — bounded validation (`/implementation/validation-rules`)

This is what keeps the pitch defensible. The AI drafts; **DICT bounds decide**.
Without this, "AI generates the approval flow" sounds like unbounded workflow
authoring, which is exactly what the brief promises we are *not* doing.

```ts
// src/lib/rules/validate.ts
export function validateService(
  service: GeneratedService | LguService,
  template: ServiceTemplate,
): ValidationFlag[]
```

Rules to implement, checked against `service_templates.allowed_rules`:

| Rule code | Severity | Fires when |
|---|---|---|
| `FEE_ABOVE_TEMPLATE_CEILING` | `block` | fee > `max_fee` |
| `UNKNOWN_WAIVER_CATEGORY` | `block` | waiver category not in `allowed_rules.waiver_categories` |
| `ELIGIBILITY_KEY_NOT_ALLOWED` | `block` | eligibility key not in `allowed_rules.eligibility_keys` |
| `TOO_MANY_CUSTOM_FIELDS` | `warn` | custom fields > `allowed_rules.max_custom_fields` |
| `ELIGIBILITY_ABOVE_TYPICAL` | `warn` | residency requirement above the national norm |
| `LOW_GENERATION_CONFIDENCE` | `warn` | `confidence < 0.7` |

Zero flags → publish immediately. Any `block` → status `flagged`, into the review
queue. That difference *is* the "we removed the labour, not the oversight" claim,
and the seeded Hagdang Bato service already trips two of these on purpose.

---

## Task 3 — paper form extraction (`/implementation/doc-extract`)

The alternative entry path for officers who'd rather upload than type.

`POST {base}/api/v1/egov/integration/document_extractor/generate`,
`multipart/form-data`, field `file`.

**The response is an HTML string**, not JSON — `<b>Field</b>: value<br>`. Parse
it into `ExtractedField[]`, then feed those through the same
`generateService()` path so both entry points converge on one schema.

---

## Task 4 — deploy (do this early, not at 05:00)

Push to GitHub, connect Vercel, deploy **now** while the app is small. A
first-deploy failure at 05:00 is unrecoverable; at 23:00 it costs ten minutes.

- Add every `.env.local` variable to Vercel's environment settings
- Generate a **fresh** `SESSION_SECRET` for production — don't reuse the local one
- Confirm the deployed URL serves the same golden path as localhost

---

## Files you own

```
src/lib/studio/          generate.ts, extract.ts, prompts.ts
src/lib/rules/           validate.ts
src/lib/egov/ai.ts       (correct against API_Reference.md)
src/app/console/studio/  the real Studio route
scripts/probe.ts
```

Don't edit `src/components/ui.tsx` (Jasmin) or other people's adapters.
