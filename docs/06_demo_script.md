# 8-Minute Presentation Script

**Team PRODIGITALITY | eGovDX Local**
Expanded from [`draft-flow.md`](draft-flow.md), which covered 0:00–3:30. This
covers the full eight minutes and all six mandated components.

> **Hard rule: 8:00 maximum.** Rehearse with a timer. Going over is a scored
> failure, and the six components below are required by the rules — a missing
> one is a gap a judge will notice.

| # | Required component | Where |
|---|---|---|
| 1 | Team Introduction | 0:00–0:25 |
| 2 | Problem Statement | 0:25–1:10 |
| 3 | Proposed Solution & Integration to eGovPH | 1:10–5:40 |
| 4 | Impact, Value & Cost Benefit | 5:40–6:40 |
| 5 | Implementation & Scalability | 6:40–7:25 |
| 6 | Closing | 7:25–8:00 |

The PowerPoint must be **embedded in the video**, not attached separately.

---

## 0:00 – 0:25 · Team Introduction

**Visual:** Title slide — five names, roles, "Team PRODIGITALITY".

> "We're Team PRODIGITALITY. We build for the public sector, and we picked the
> problem that decides whether the eLGU rollout actually reaches people."

Keep it to fifteen seconds of names. Impact is 35% of the score; introductions
are 0%.

---

## 0:25 – 1:10 · Problem Statement

**Visual:** Map of the Philippines, 1,634 municipalities. Then the real number.

> "The national eLGU rollout has reached about 57% of cities and municipalities.
> But for most of them, 'integrated' means a link on eGovPH that redirects to a
> municipal website — and many of those have no working eServices at all.
>
> That figure also only counts city and municipal halls. It doesn't count
> **barangays** — which is where Filipinos actually go for the paperwork they
> need most: clearances, indigency certificates, residency records.
>
> DICT cannot hand-build workflows for 1,634 municipalities, let alone 42,000
> barangays. Every LGU has its own fees, its own exemptions, its own ordinances.
> **Adoption isn't stalling because software is hard. It's stalling because
> configuring it per-locality doesn't scale under a fully centralised model.**"

> ⚠️ **Do the sample audit before you say this.** Check 10–20 LGU eService links
> and tally how many dead-end. "We checked twenty and fourteen were dead links"
> converts your central claim from assertion to evidence, and it costs five
> minutes. Say the actual number.

---

## 1:10 – 1:45 · Act 1 · LGU Onboarding

**Visual:** The eGovDX officer console. Sign in via **eGovPH SSO**.

**Actions**
1. Sign in — narrate that this is the same eGovPH account citizens use.
2. Click **Register LGU**. Search "Marilao" — a real lookup against PSA
   geographic data, not a dropdown.
3. Enter the official email. Register.
4. Land on the dashboard: **"Marilao currently has 0 active eServices."**

> "Right now, if Marilao wants to digitise a permit, they hire contractors for
> millions of pesos, or they wait months. Watch what this takes instead."

**API on screen:** eGOV PH (SSO)

---

## 1:45 – 3:00 · Act 2 · The AI eService Studio

**The centrepiece. Do not rush it.**

**Visual:** "Create New eService with AI".

**Actions**
1. Type — actually type it, don't paste:

   > *"Create a Business Sanitation Permit Request for Marilao. Require proof of
   > business address and Mayor's Permit number. Charge a fee of ₱150. Route
   > approvals to the Municipal Health Office."*

2. **Generate.** Show eGov AI producing:
   - input fields — file uploader for proof of address, text field for permit no.
   - fee rule — ₱150 fixed
   - approval routing — Municipal Health Office
   - required documents

3. **Then show the validation pass.** This is the part that makes the pitch
   defensible:

   > "The AI drafts. It doesn't decide. Every generated service is checked
   > against the DICT-approved template for this service type — fee ceilings,
   > allowed waiver categories, eligibility rules. Conforming services publish
   > immediately. Anything outside those bounds is flagged for a human reviewer.
   >
   > **We are not removing government oversight. We're removing the manual
   > configuration labour that currently makes oversight the bottleneck.**"

4. Briefly open the **review queue** and show a service that *was* flagged —
   a fee above the approved ceiling, an unrecognised waiver category. Ten seconds.
5. **Publish to eGovPH.**

**API on screen:** eGov AI

> **Have a second, unrehearsed prompt ready.** If the Q&A asks whether it only
> works on that one sentence, generating a tricycle franchise renewal live is the
> strongest possible answer.

---

## 3:00 – 4:30 · Act 3 · The Citizen Experience

**Visual:** Switch to the eGovPH app shell. Phone framing.

**Actions**
1. eGovPH dashboard → **LGUs** tab → search **Marilao**.
2. The Business Sanitation Permit **you just created** is already there.

   > "No deployment. No app release. It was published thirty seconds ago."

3. Tap to apply. Sign in as a citizen — **same eGovPH SSO, different role.**
4. **Face liveness check.** Real camera.

   > "Liveness is what replaces the barangay officer physically seeing you at
   > the counter. We accept a session only at 95% confidence or above."

5. **eVerify** — name, address, birthdate populate from PhilSys.

   > "The citizen types none of this. It's already verified government data."

6. Upload proof of business address.
7. **Pay ₱150** through eGovPay.
8. Submit → **"Pending Municipal Health Office Approval."**

**APIs on screen:** eGOV PH · FACE LIVENESS · eVerify · eGOV PAY

---

## 4:30 – 5:40 · Act 4 & 5 · Issuance and Verification

**The strongest 70 seconds you have. Film this first, while there's time to reshoot.**

**Actions**
1. Switch to the officer. The request is in the Municipal Health Office queue,
   showing what was verified: liveness score, eVerify reference.
2. **Approve.** Then, without any further clicks:
   - the PDF generates — LGU letterhead, seal, control number, citizen's
     verified details, QR code
   - its SHA-256 hash is anchored on **eGOV chain**
   - an **SMS** arrives on a real handset in shot

   > "The officer retyped nothing. Not one field."

3. Open **hackathon-explorer.e.gov.ph** and show the transaction on-chain.
4. **Scan the QR with a phone.** The public verification page loads: ✓ verified,
   issuing barangay, control number, chain transaction.

   > "Fake barangay clearances are a real problem, and the bank or employer
   > receiving one has no way to check. Now anyone can, in three seconds,
   > without calling the barangay."

5. **The tamper test.** Alter one byte of the PDF, re-upload → **✗ rejected.**

   > "That's what makes this real rather than a green checkmark."

**APIs on screen:** eGOV chain · eMessage

---

## 5:40 – 6:40 · Impact, Value & Cost Benefit

**Visual:** Numbers, not prose.

> "For the citizen: one trip becomes zero. No re-entering data the government
> already holds, no return trip to ask if it's ready.
>
> For the barangay: no retyping, no manual issuance, no filing.
>
> For DICT: this is the difference between engineers hand-coding 1,634 municipal
> configurations, and *reviewing* 1,634 pre-structured, self-submitted ones.
> It's a force multiplier for DICT's own team, not a competitor to the platform.
>
> For the LGU: zero procurement cycle. No RFP, no vendor contract, no local IT
> hire. Funded through the eGovPH programme, because this is infrastructure DICT
> needs regardless."

State your pilot metrics: time-to-live from prompt to published service, and the
**review-flag rate** — the percentage passing automated validation without human
review. That last one is the real efficiency signal, because it shows how much
DICT labour the tool actually removes.

---

## 6:40 – 7:25 · Implementation & Scalability

**Visual:** Architecture diagram — eGovPH APIs, the configuration layer, the LGU
console, the citizen surface.

> "Seven eGovPH APIs, each load-bearing: SSO for both roles, eVerify and Face
> Liveness for identity, eGov AI for generation, eGovPay for fees, eMessage for
> notification, eGov chain for authenticity.
>
> Scaling is a database row, not a deployment. A new LGU registers, configures,
> and publishes — nobody ships code."

**Name your limits before a judge finds them.** This reads as competence:

> "What we're not claiming: this needs connectivity, so offline capture is phase
> two. AI misparsing is possible — which is exactly why the review queue exists.
> And where eGovPH doesn't hold barangay-level residency history, the barangay's
> own records stay the source of truth until they're digitised."

---

## 7:25 – 8:00 · Closing

> "DICT can't hand-build digital services for 1,634 municipalities and tens of
> thousands of barangays. eGovDX lets each LGU configure its own — within
> DICT-approved bounds, under DICT review, rendered natively inside eGovPH.
>
> We're not asking government to give up control. We're removing the manual
> labour that's currently making control the bottleneck.
>
> Team PRODIGITALITY. Thank you."

---

## 1-minute reel — shot list

Ten percent of the score for sixty seconds. Cheapest points on the board.

| Shot | Length | Content |
|---|---|---|
| 1 | 8s | Type the prompt → service generates. Screen recording, sped up |
| 2 | 6s | Service appears in the eGovPH app on a phone |
| 3 | 8s | Face liveness → eVerify fields populating |
| 4 | 10s | Officer approves → PDF assembles itself |
| 5 | **12s** | **Phone scans the QR → ✓ VERIFIED.** The hero shot |
| 6 | 6s | Tamper → ✗ rejected |
| 7 | 10s | Team, logo, one line |

Shoot 5 first and shoot it properly — real phone, real scan, steady hands.

---

## Pre-submission checklist

- [ ] Presentation video ≤ **8:00**
- [ ] PowerPoint **embedded in the video**, not attached
- [ ] All six required components present
- [ ] 1-minute reel exported separately
- [ ] Drive link set to **"Anyone with the link can view"**
- [ ] Both videos open in an **incognito window**
- [ ] Email subject: `TEAM PRODIGITALITY – eGovDX Local (eGovPH)`
- [ ] Sent to **eventsph@dict.gov.ph** well before 07:00

> Send by 06:30. A 07:01 submission is disqualified, and upload times are not
> excused.
