# Jasmin — brand kit, eGovPH shell, citizen experience

**Role:** UI/UX Frontend
**Routes:** `/implementation/brandkit`, `/implementation/egov-shell`, `/implementation/citizen-apply`
**Blocked by:** Joshua's `VerifiedIdentity` contract (stub against it, don't wait)
**You unblock:** everyone — `src/components/ui.tsx` is yours and the whole team imports it

---

## Current implementation status

All three owned features are now `unified`. The shared brand kit includes the
eSee LGU design system and citizen primitives; the dynamic eGovPH shell reads
published LGU services without hardcoded localities; and `/apply/[serviceId]`
supports resumable identity verification, arbitrary generated fields, private
evidence uploads, fee or waiver completion, submission, and
`/track/[requestId]`. The focused citizen integration suite passes 7/7 checks.

## Why your work carries more weight than the 10%

UI/UX is only 10% of the rubric, and the brief admits an officer-facing config
console "doesn't dazzle". But **the citizen side is what gets filmed**, and
presentation is another 15% with reels at 10%. What you build is most of what
the judges actually see for ~6 of the 8 minutes.

The bar is *plausibly government*. Calm, dense, official. Not a startup landing
page — this has to look like something DICT would actually ship.

---

## Task 1 — brand kit (`/implementation/brandkit`)

`src/components/ui.tsx` already has `Card`, `Button`, `Badge`, `Field`,
`SourceBadge`, `StatusBadge`, `EmptyState`. Tokens are in `src/app/globals.css`.

Extend, don't restart — four people are importing these right now.

Likely gaps: `Table`, `Tabs`, `Modal`, `FileUpload`, `Stepper`, `Toast`, `Skeleton`.
The apply flow needs a **stepper** (Verify → Liveness → Fill → Pay → Submit) and
the shell needs **tabs**.

Also needed for Earl's PDFs: a letterhead and seal in `public/brand/`. A
plausible barangay letterhead with a seal placeholder is enough — it just has to
survive being screenshotted.

### `<SourceBadge>` is not decoration

It states on screen whether data came from the live API or a fixture. **Never
style it away or make it subtle.** If eVerify falls back, the screen must not
imply PhilSys confirmed anything. That honesty is a scored asset — it's the
difference between a judge trusting the demo and probing it.

---

## Task 2 — mock eGovPH shell (`/implementation/egov-shell`)

Act 3 opens inside the eGovPH super-app. Build the wrapper that makes the
citizen side feel like a native eGovPH surface rather than a separate website —
that's the whole "renders natively inside eGovPH, no external redirect" claim,
made visual.

- eGovPH-style dashboard with a service-category grid
- **LGUs tab** — the key screen. Search or browse LGUs.
- Select an LGU → its published services list
- A newly published service must appear here **without a restart or reseed**

Data is already there: `listPublishedServices()` in `src/lib/data.ts` returns
services grouped by LGU. Currently Mandaluyong / Barangay Plainview is seeded;
Marilao gets registered live during Act 1, so **your LGU list must be dynamic** —
no hardcoded two-item array.

Mobile-ish framing sells it. Judges picture citizens on phones.

---

## Task 3 — citizen apply flow (`/implementation/citizen-apply`)

The heart of the demo. Route: `/apply/[serviceId]`.

### Steps

1. **Identity** — eVerify prefills name, address, birthdate. Show the prefilled
   fields as *visibly* prefilled (read-only, badged) so the "you don't retype
   what government already knows" point lands without narration.
2. **Liveness** — Joshua's SDK component. Accepted only at score ≥ 95.
3. **Form** — rendered dynamically from `lgu_services.form_fields`.
4. **Documents** — upload to Supabase Storage → paths into `requests.uploaded_docs`.
5. **Fee** — Elton's payment step, or "Waived: Student" if a waiver applies.
6. **Submit** → `/track/[requestId]`.

### The dynamic form renderer is the load-bearing piece

```tsx
<DynamicForm fields={service.form_fields} prefill={verifiedIdentity} />
```

`FormField` is defined in `src/lib/supabase/types.ts` — `text | number | date |
select | textarea`, with `required`, `options`, and `source: 'everify'` marking
prefilled fields.

**This must render a form nobody has seen.** David's Studio generates arbitrary
field sets from arbitrary prompts; if a judge invents a service, your renderer
draws its form. No per-service special-casing, no hardcoded layouts.

### Track page — `/track/[requestId]`

Status timeline from `request_events` (already written by the backend), the fee
status, and the download link once issued. This is where the citizen sees
"Pending Municipal Health Office Approval" in Act 3 and returns in Act 5.

---

## Contract to freeze by 23:00

```tsx
export function DynamicForm(props: {
  fields: FormField[]
  prefill?: Partial<Record<string, string | number>>
  onSubmit: (data: Record<string, unknown>) => void
}): JSX.Element
```

Ship it rendering plain inputs, style it later. Elton and David both need to
know the shape exists.

---

## Files you own

```
src/components/ui.tsx        ← shared; others must ask before editing
src/components/shell/, form/
src/app/globals.css
src/app/(citizen)/, src/app/apply/, src/app/track/
public/brand/
```

---

## If you have time at the end

You and David record. You have the best eye for what reads on camera, and
**reels are 10% of the score for 60 seconds of footage** — the cheapest points
available. Best shot: issue → scan QR on a real phone → verified.
