# eGovPH Hackathon — Rules, Deadlines & Judging

**Team:** PRODIGITALITY
**Organizer:** DICT (Department of Information and Communications Technology), Philippines
**Submissions to:** eventsph@dict.gov.ph

---

## What this hackathon is

A government-run build competition centered on the **eGovPH platform** — DICT's national digital government super-app. Teams build a working solution that integrates with the published eGovPH API catalog (identity, payments, notifications, AI, blockchain, budget data, citizen reports).

The core ask is not "build a cool app." It is: **build something that plugs into government infrastructure and demonstrably helps Filipino citizens.** That framing explains the scoring weights below — 65% of the score is impact plus integration depth. Polish is worth comparatively little.

---

## Judging criteria

| Criterion | Weight |
|---|---|
| Impact to society | **35%** |
| Integration to eGovPH project | **30%** |
| Presentation | **15%** |
| UI/UX | **10%** |
| Reels | **10%** |
| **Total** | **100%** |

**How to read this:**

- **Impact (35%)** — the single largest bucket. Judges want a real, specific Filipino problem with a named affected population, not a generic efficiency claim. Quantify it.
- **Integration (30%)** — depth beats breadth. Real API calls, visible in the demo, where each API is load-bearing rather than decorative. A judge can tell the difference between an API you needed and one you added to lengthen the list.
- **Presentation (15%)** — structure and credibility. Stating your own risks before a judge finds them reads as competence.
- **UI/UX (10%)** — worth less than teams instinctively assume. Don't trade integration work for pixel work.
- **Reels (10%)** — equal weight to UI/UX, and much cheaper to earn. Do not treat the highlight video as an afterthought; it is 1/10 of the total score for 60 seconds of footage.

---

## Timeline & deliverables

### Day 1 — API registration
**Deadline: 8:00 PM**

Email your selected API integration to eventsph@dict.gov.ph.
Format: `TEAM [NAME] - [API LIST]` (slide sample: `TEAM BA - EGOV AI and DNI`)

Failure to submit by deadline = **automatic disqualification**.

✅ **PRODIGITALITY submitted 7:57 PM, Jul 21 2026** — eGOV PH, eVerify, Face Liveness, eMessage, eGov AI, eGovPay, eGov Chain.

### Day 2 — Video pitch
**Deadline: 7:00 AM**

One (1) Google Drive link via email to eventsph@dict.gov.ph.
Email subject: `TEAM NAME – Project Title (Government Project Name)`

**Teams submitting after 7:00 AM — including 7:01 AM — are automatically disqualified.** Send early; email and upload delays are not excused.

#### The Drive folder must contain:

**[1] 8-minute presentation video (MP4)**

No longer than 8 minutes. Must include all six components:

1. Team Introduction
2. Problem Statement
3. Proposed Solution & Integration to eGovPH
4. Impact, Value & Cost Benefit
5. Implementation & Scalability
6. Closing

Your PowerPoint must be **embedded within the presentation video** — not attached separately.

**[2] 1-minute team highlight video / Reels (MP4)**

#### Pre-submission checklist

- [ ] Drive link sharing set to **"Anyone with the link can view"**
- [ ] Both videos present and independently openable (test in an incognito window)
- [ ] PowerPoint embedded in the presentation video
- [ ] Presentation video ≤ 8:00
- [ ] Email subject matches required format exactly
- [ ] Sent well before 7:00 AM

---

## Final round

All submitted videos are evaluated by the judges. **Top 10 teams** are announced during the event and advance to the Final Pitch.

**Final Pitch format:**
- 8-minute live presentation
- 5-minute Q&A

Prepare for Q&A specifically. Weak answers on legal standing, data privacy, or "does this API actually return that field" are where technically strong teams lose.

---

## Registered API integrations — PRODIGITALITY

| API | Category | Status |
|---|---|---|
| eGOV PH | Single sign-on | Documented |
| #NationalID \| eVerify | Identity verification | Documented |
| FACE LIVENESS | Liveness detection | Documented |
| eMessage | Notifications | Documented |
| eGov AI | AI services | Documented |
| eGOV PAY | Digital payments | ⚠️ Endpoints not documented in catalog |
| eGOV chain | Blockchain (Hyperledger Besu, JSON-RPC) | ⚠️ Endpoints not documented in catalog |

**Not registered:** DBM COMPASS, eReport.

Two of seven have no published endpoints. Confirm sandbox connectivity on both early — they sit in the critical path of either project concept.

---

## Endpoint reference (as published)

**eGOV PH — Single sign-on**
- `POST {{base_url}}/api/token` — Generate Access Token
- `POST {{base_url}}/api/partner/sso_authentication` — SSO Authentication

**#NationalID | eVerify — Identity verification**
- `POST {{base_url}}/api/auth` — Authenticate (Generate Access Token)
- `POST {{base_url}}/api/query` — Verify Personal Information
- `POST {{base_url}}/api/query/qr/check` — QR Check
- `POST {{base_url}}/api/query/qr` — QR Verify

**FACE LIVENESS — Liveness detection**
- `POST {{baseUrl}}/v1/liveness/session` — Create Session
- `GET {{baseUrl}}/v1/liveness/result/{{sessionToken}}` — Get Verification Result

**eMessage — Notifications**
- `POST {{base_url}}/messaging/v1/sms/push` — Push SMS

**eGov AI — AI services**
- POST: Generate Access Token · AI Assistant · Speech Maker · Tourism · Laws & Regulations · Translator · Document Extractor
- GET: Token Credits *(check quota before demo day)*

**eGOV PAY — Digital payments**
- `POST` — Generate Payment
- `GET` — Check Transaction Details
- `PUT` — Void Transaction

**eGOV chain — Blockchain**
- Hyperledger Besu over JSON-RPC. No endpoint list published in the catalog.
