# eGovDX Local — A Configuration Layer for eLGU Adoption

**Team PRODIGITALITY | eGovPH Hackathon**

---

## One-line pitch

DICT can't hand-build digital services for 1,634 municipalities and tens of thousands of barangays. eGovDX lets each LGU configure its own services within DICT-approved bounds — removing the configuration labor, not the oversight.

---

## Problem

The national eLGU rollout has reached roughly 57% of cities and municipalities (940+ of 1,634). That figure overstates real digital access:

- For most of these LGUs, "integration" means a link on eGovPH that **redirects to an external municipal website** — many with no working eServices at all.
- Reported adoption tracks **City and Municipal Halls only**. It does not cover **barangays**, which is where citizens actually go for the paperwork they need most often: clearances, indigency certificates, residency records.
- DICT cannot realistically hand-build and maintain custom workflows for 1,634 municipalities, let alone tens of thousands of barangays. Every LGU has its own fee structures, exemptions, and local ordinances, and a small central team can't absorb that volume of bespoke configuration requests.

**Adoption stalls not because software is hard to build, but because configuring it per-locality doesn't scale under a fully centralized model.**

> **Citation needed before you present this as fact:** the claim that most LGU eService links dead-end into non-functional sites needs even a small sample audit — 10–20 LGU sites, checked and tallied. This is a five-minute task that converts your central claim from assertion to evidence. Do it.

**Scope note (state this yourself):** targeting LGUs and barangays with meaningful transaction volume — dense urban and peri-urban first. Low-volume rural barangays are a later phase, not because their residents matter less, but because a configuration tool has no leverage without throughput. This is a sequencing decision, not a statement about whose access matters.

---

## What we're building

**This is not a workflow-authoring platform.** It is a bounded configuration layer on top of a fixed, DICT-approved service flow.

Every eService — indigency certificate, barangay clearance, business permit endorsement — follows the same centrally defined flow:

```
Request → Verification → Approval → Fee assessment → Issuance
```

**Issuance is automated.** Once an LGU maps its paper form or DOCX template during setup, that template becomes the generation source. On approval, the platform auto-populates it with verified applicant data and produces the finished PDF — with the LGU's own letterhead, seal placement, and control numbering preserved — ready for digital signature or e-issuance. The barangay officer doesn't retype a single field.

**This is what actually removes labor from the barangay side**, not just the request-intake step. Say it that way.

### What varies per LGU

A constrained parameter set, not free-form logic:

- Fee amount and fee waivers (e.g., waive if applicant is a student)
- Required supporting documents per service
- Eligibility conditions (e.g., minimum residency duration)
- Local form fields specific to that LGU's ordinance

An officer uploads a sample paper form or DOCX. The engine maps it against the closest matching pre-approved service template, flags fields or rules falling outside standard parameters, and presents them for confirmation or adjustment **from a bounded rule set**.

Document generation only works within the approved template and field mapping — populating a pre-cleared layout with verified data, not freely generating novel documents. That keeps it inside the same review boundary as everything else.

**This is deliberately a smaller claim than "no-code workflow builder," and that's what makes it fast, auditable, and approvable.**

---

## The approval layer

Nothing an LGU officer publishes goes live untouched:

1. **Draft** — LGU submits a configured service. Generates a standardized schema; not yet public.
2. **Automated validation** — engine checks the schema against DICT template rules. Flags anomalies (a fee waiver matching no known category, a required field absent from the eGovPH data model).
3. **Review queue** — flagged items route to a human reviewer (DICT-side or a regional focal person). Unflagged, template-conforming submissions go live faster since they carry no novel risk.
4. **Publish** — the schema renders **natively inside eGovPH**. No external redirect.

This is the honest version of "instant": routine configurations are near-instant; anything unusual gets human eyes before touching a citizen-facing app. **We are not removing government oversight — we're removing the manual configuration labor that currently makes oversight the bottleneck.**

---

## API integration map

| API | Role in eGovDX | Notes |
|---|---|---|
| eGOV PH | SSO for two distinct roles — LGU/barangay officer into the config console, and citizen into the request flow | Richer SSO story than a single-role app |
| eVerify | Pulls verified identity and residency directly rather than making citizens re-enter it | `POST /api/query` — the heart of the concept |
| FACE LIVENESS | Liveness check on the **citizen** at request time | See decision note below |
| eGov AI | Document Extractor for template mapping and auto-population; **Translator** for multilingual barangay forms | Was missing from the original write-up — it's load-bearing |
| eMessage | "Your barangay clearance is approved and ready for download" — removes a return trip to the hall | Cleanest impact story in the project |
| eGOV PAY | Fee assessment step — mandatory, it's a named stage in the core flow | ⚠️ Undocumented endpoints |
| eGOV chain | Anchors issued document hashes; verification QR printed on the PDF | See below |

### Decision needed: who gets the liveness check?

The original write-up listed FACE LIVENESS without saying who it checks. The defensible answer is **the citizen at request time** — an indigency certificate issued to an impersonator is a real fraud vector, and liveness is what replaces the barangay officer physically seeing the person at the counter.

State this explicitly in the pitch. An unjustified API on the list is exactly the weakness judges probe.

### Why eGOV chain fits especially well here

Fake barangay clearances and indigency certificates are a known problem — paper documents with a stamp, trivially forged, and the receiving party (a bank, employer, school) has no way to check. Anchoring the issued PDF's hash on-chain with a verification QR on the document means anyone can confirm authenticity without calling the barangay.

**That's a complete 30-second demo loop: issue → scan → verified.** It is the single most demonstrable thing in either of your two concepts.

---

## Data flow with eGovPH

Where eGovPH already holds verified citizen data (identity, registered residency), the engine pulls it directly rather than asking citizens to re-enter it — reducing the barangay's role in many transactions to verification and approval rather than data collection.

Where local records don't yet exist in eGovPH — common for barangay-level residency history, indigency status, prior clearances — the barangay's existing records remain the source of truth until digitized. **We are not assuming eGovPH already holds complete barangay-level data.** That gap is real, and part of what onboarding surfaces and fills over time.

---

## Positioning: a DICT-funded vendor layer, not a bottom-up insurgency

The useful analogy is **Shopify, not WordPress**. Shopify doesn't let merchants build arbitrary storefront logic — it provides a fixed checkout/payment/fulfillment pipeline and lets them configure products, pricing, and rules on top. Same shape here: a fixed request → verification → approval → fee → issuance pipeline, with LGUs configuring services, fees, eligibility, and templates on top.

**Where the analogy breaks — say it before a judge does:** Shopify merchants bear their own risk and answer to no regulator. An LGU issuing a wrong indigency certificate has legal and welfare consequences, which is exactly why the review queue exists. Use the analogy for the configuration UX, not the governance model.

**This is a DICT-funded, DICT-integrated tool** sitting between DICT's central platform and thousands of LGU offices. DICT retains approval authority, data ownership, and platform control. What's removed is the manual labor of DICT staff configuring each LGU by hand.

**The funding case:** a force multiplier for DICT's own team, not a competitor to their platform. The difference between DICT engineers hand-coding 1,634 municipal configs and DICT *reviewing* 1,634 pre-structured, self-submitted ones.

---

## Why an LGU would use this

- **Zero procurement cycle** — no RFP, no vendor contract, no local IT hire
- **No cost to the LGU** — funded through the DICT/eGovPH program, since this is infrastructure DICT needs regardless
- **Faster time-to-live** for services fitting the standard template (the majority case)
- **No loss of local policy control** over fees and eligibility within approved bounds

---

## Metrics — hackathon-scoped

Not claiming "all LGUs adopt" as a deliverable. That's the eventual mission, not a demoable outcome. What gets shown:

- **Pilot cohort** — N barangays/LGUs onboarded during the hackathon window
- **Time-to-live** — median from document upload to reviewed, published schema
- **Review-flag rate** — % of submissions passing automated validation without human review. *This is the real efficiency signal: it shows how much DICT labor the tool removes.*
- **Transaction completion** — citizen requests processed end-to-end through a piloted service

---

## Known open risks

- **Connectivity dependence** — a cloud-based AI-assisted tool needs decent internet. Offline/low-bandwidth fallback is phase 2, not this build.
- **Liability for AI misparse** — the review queue exists specifically to catch this before publish. Not claiming zero-error parsing.
- **Source data quality at eGovPH** — data-pull claims are only as good as what eGovPH holds. A dependency, not something under our control.
- **Two undocumented APIs in the critical path** — eGOV PAY (fee assessment is a named flow stage) and eGOV chain. Confirm sandbox connectivity early; this is the highest-probability build failure.
- **Citation gap** — the dead-end-LGU-website claim needs the sample audit described above.

---

## Rubric fit

| Criterion | Assessment |
|---|---|
| Impact (35%) | High leverage — unblocks the eLGU rollout itself, and barangay clearances are the most-touched government transaction in the country. Slightly less legible than a consumer app; fix with one named citizen persona walking through the flow. |
| Integration (30%) | Strong once eGov AI is properly credited. Two-role SSO and citizen-side liveness are more sophisticated than typical entries. |
| Presentation (15%) | **Strongest asset.** This document already states its own risks, corrects earlier framing, and kills its own analogy. That reads as competence. |
| UI/UX (10%) | Weakest area — an officer-facing config console doesn't dazzle. Mitigate by demoing the *citizen* side, which is clean and simple. |
| Reels (10%) | Needs deliberate work. Best footage: the issue → scan QR → verified loop. |
