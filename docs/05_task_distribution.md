# Task Distribution — 5 developers, 8.5 hours

**Team PRODIGITALITY | eGovDX Local | Deadline 07:00 PHT, 22 Jul 2026**

A 07:01 submission is an automatic disqualification. Read your own file first,
then this one.

| Dev | File | Track |
|---|---|---|
| David | [david/README.md](david/README.md) | AI eService Studio, validation, infra & deploy |
| Joshua | [joshua/README.md](joshua/README.md) | Identity chain — SSO → liveness → eVerify |
| Jasmin | [jasmin/README.md](jasmin/README.md) | Brand kit, eGovPH shell, citizen apply UI |
| Earl | [earl/README.md](earl/README.md) | Issuance, chain anchoring, public verification |
| Elton | [elton/README.md](elton/README.md) | Payments, SMS, LGU registration, approval queue |

Live status board: [`/implementation`](http://localhost:3000/implementation) —
rendered from [`src/app/implementation/manifest.ts`](../src/app/implementation/manifest.ts).

---

## Current handoff — 22 July 2026

All application features are implemented and wired into one production journey.
Jasmin's landing at `/` is the three-role gateway, citizens discover services at
`/services`, and the officer, reviewer, citizen, issuance, and verification
handoffs no longer depend on `/implementation`. The remaining work is live
integration certification and presentation, not new product construction.

| Owner | Delivered | Remaining required work |
|---|---|---|
| **David** | AI Studio, bounded validation, form extraction, DICT review, generation cache, persistence, Supabase/Vercel deployment | Run the authoritative seven-service probe with the final credentials; perform one controlled live eGov AI → OpenAI fallback test; switch `EGOV_AI_MODE` to `live` only after it passes; record remaining credits. |
| **Joshua** | Server-side SSO exchange, role sessions, eVerify SDK liveness, standalone liveness adapter, eVerify request integration, and the dedicated eVerify diagnostic harness | Mint a fresh single-use exchange code and certify SSO → SDK liveness → eVerify once in live mode; map the returned officer `uniqid` before recording. |
| **Jasmin** | Public landing and role gateway, brand system, eGovPH citizen shell, dynamic `/services` catalog, resumable application, private uploads, fee/waiver handoff, tracking | No remaining owned implementation work. Perform the final mobile/recording visual pass with the team. |
| **Earl** | PDF issuance, immutable storage, hash anchoring, block receipt/timestamp, public QR/hash verification and tamper rejection | No remaining owned implementation work. Keep the confirmed live-chain transaction available for the presentation. |
| **Elton** | LGU onboarding, payment/waivers, approval/rejection, issuance orchestration, eMessage, retries and analytics | Run controlled live eGovPay with the test token and eMessage with an approved test number; change each production mode independently only after its proof succeeds. |

Production currently uses **live eGOV chain**. SSO, liveness, eVerify, eGov AI,
eGOV PAY, and eMessage remain explicitly labelled mock integrations until their
controlled live checks above succeed. Mock mode is a valid safe demo state, but
it is not the same as live certification.

### Shared finish line

1. Run the default product browser suite once after any mode change; run `npm run qa:diagnostics` only when isolating an adapter.
2. Record the eight-minute presentation and one-minute reel using the final
   production deployment.
3. Test the public URL, QR verification, and submission links in an incognito
   session before handoff.

---

## The one rule that matters tonight

> **This is a working app, not a demo.**

Every feature must accept input the demo script never mentions — an LGU nobody
seeded, a prompt nobody rehearsed, a citizen whose name isn't in a fixture. In
the 5-minute Q&A a judge will ask to type their own prompt or register their own
barangay. The answer has to be "go ahead."

Mock fallbacks exist as an **outage safety net**, not as the primary path. If
your feature only works on the rehearsed input, it isn't done.

---

## Timeline (PHT)

Recording is a scheduled block with buffer behind it, not whatever is left over.

| Window | What happens |
|---|---|
| **22:30 – 23:00** | David loads all credentials and runs `npx tsx scripts/probe.ts`, posts results. **Everyone else freezes their contract** — exported types and function signatures, mock data behind them — and commits. |
| **23:00 – 01:00** | Correct your adapter against `API_Reference.md`. Own files only. |
| **01:00 – 03:00** | Wire into the real `/app` routes. |
| **03:00 – 04:00** | End-to-end golden path, run twice, on a clean browser session. |
| **04:00 – 06:00** | **Record.** 8-minute presentation + 1-minute reel. |
| **06:00 – 07:00** | Upload, test links in incognito, email. Pure buffer. |

**23:00 is the only deadline that cannot slip.** Four people are downstream of
frozen contracts. Ship the signature with mock data behind it and move on —
see "Stub your contract first" in [04_implementation_workflow.md](04_implementation_workflow.md).

---

## API ownership — all seven must be load-bearing

Integration depth is 30% of the score, and judges can tell a load-bearing API
from a decorative one. Each of these has exactly one owner and one real job.

| API | Owner | Its job in the product | Why it's not decorative |
|---|---|---|---|
| **eGOV PH** | Joshua | SSO for both officer and citizen | Two distinct roles through one provider |
| **#NationalID / eVerify** | Joshua | Prefills name, address, birthdate | The "don't retype what government knows" claim |
| **FACE LIVENESS** | Joshua | Liveness at request time | Replaces the officer seeing you at the counter; **required** by eVerify |
| **eGov AI** | David | Prompt → eService schema; paper form → fields | Without it the Studio is a manual form builder |
| **eGOV PAY** | Elton | Collects the configured fee | Fee assessment is a named stage of the core flow |
| **eMessage** | Elton | "Your document is ready" | Removes a return trip to the hall |
| **eGOV chain** | Earl | Anchors issued document hashes | Makes forged clearances detectable by anyone |

---

## Dependency graph

Arrows mean "cannot finish without". A dependency counts as satisfied when its
**contract is frozen**, not when it's finished.

```
brandkit (Jasmin) ─────────────┬──> egov-shell ──> citizen-apply
                               │                        ^
egov-sso (Joshua) ──┬──> face-liveness ──> everify ──────┤
                    │                                    │
                    ├──> lgu-onboarding (Elton)          │
                    └──> approval-queue (Elton)          │
                                    │                    │
egov-pay (Elton) ───────────────────┼────────────────────┘
                                    │
ai-studio (David) ──> doc-extract    │
validation-rules (David)             │
                                     v
doc-issuance (Earl) ──> egov-chain ──> verify-qr
                    └──> emessage (Elton)
```

**Longest serial chain: Joshua's.** SSO → liveness → eVerify is now strictly
sequential because eVerify requires a `face_liveness_session_id`. He starts
first and everyone treats his contracts as high priority.

**No dependencies at all:** `ai-studio`, `validation-rules`, `egov-pay`,
`doc-issuance`, `brandkit`. These five start immediately at 22:30.

---

## Shared files — announce before editing

Everything else you own outright. These four are shared, and a conflict in them
at 03:00 is expensive:

| File | Protocol |
|---|---|
| `supabase/schema.sql`, `src/lib/supabase/types.ts` | **Additive only** — new nullable column or new table, never a rename or drop. Change both in the same commit. Add a numbered file under `supabase/migrations/`. |
| `src/components/ui.tsx` | Jasmin's. Ask before adding; she may already have it. |
| `src/lib/egov/client.ts` | Shared plumbing. `authHeaders()` already knows each service's scheme — don't retype header names in your adapter. |
| `.env.local.template` | Add your new variables so the other four know to fill them in. Never commit `.env.local`. |

---

## Definition of done

A feature is done when **all** of these hold:

1. Its harness at `/implementation/<slug>` works
2. It's wired into the real `/app` route
3. **It works with input outside the demo script** — a different LGU, a
   different prompt, a different citizen
4. It degrades honestly when its API is down: fixture data, clearly badged with
   `<SourceBadge>`, never a false green check
5. `npx tsc --noEmit` is clean
6. Your row in `manifest.ts` says `unified`

---

## Working agreements

- **Don't run `next build` as a routine check** — ~45s, catches nothing
  `npx tsc --noEmit` doesn't. Build only as the gate before a commit.
- **Commit every 30 minutes.** Rebasing a four-hour branch at 04:00 is how teams
  lose work on deadline night.
- **Never fake a verification result.** If the chain is unreachable, the page
  says "unanchored", not ✓. A judge who catches a false green has found a
  credibility problem, and credibility is the whole pitch.
- **eGov AI has 200 credits total.** Every Studio generation spends them. Check
  `GET /credits` before recording.
