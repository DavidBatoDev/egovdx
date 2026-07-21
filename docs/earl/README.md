# Earl — issuance, blockchain anchoring, public verification

**Role:** Full stack engineer
**Routes:** `/implementation/doc-issuance`, `/implementation/egov-chain`, `/implementation/verify-qr`
**API owned:** eGOV chain
**Blocked by:** nobody — start immediately
**You unblock:** Elton's SMS (needs the control number and PDF URL)

---

## Current implementation status

| Task | Status | Confirmed behavior | Remaining before strict completion |
|---|---|---|---|
| PDF issuance | `unified` | Generates the final PDF from verified request data, adds the LGU identity, atomically allocated LGU/year control number, signature block and QR, hashes the final bytes, stores them at an immutable hash-addressed path, and persists issuance metadata. Elton's approval action invokes it directly and resumes failed attempts without regenerating completed steps. | None in Earl's owned scope. |
| eGOV chain | `unified` | Locally signs a zero-value transaction for chain `13371`, waits for its receipt, reads its calldata back, and fetches the containing block timestamp. Live proof transaction `0x2087fc017308eca297d5595ef15ec58ad731682331cba20f7af236aa4c5d9171` was confirmed in block `157496`. | None. |
| Public verification | `unified` | Public routes resolve request IDs, PDF hashes, and control numbers; uploaded PDFs are hashed in the browser; issued documents show their LGU, control number, hash, transaction, block, timestamp, and verification state. | None. |

The focused Earl suite passes **21/21** checks, including issuance, storage
integrity, duplicate-issuance rejection, verification lookups, and all three
implementation harnesses. Mock-mode chain success still confirms only the
fallback path; the live transaction above separately proves that a fresh,
zero-balance signer can anchor and read back calldata on the zero-fee chain.

---

## You own the single most demonstrable thing in the project

```
issue → scan → verified
```

The brief calls this "the single most demonstrable thing in either concept", and
it's the 30-second loop the reel is built around. Forged barangay clearances are
a real, known problem, and the receiving party — a bank, an employer, a school —
currently has no way to check. Earl's implementation now provides that verification
loop, subject to the live-chain confirmation recorded above.

---

## Task 1 — PDF issuance (`/implementation/doc-issuance`)

On approval, fill the LGU's template with verified data and produce a finished
PDF. **The officer retypes nothing** — that's what actually removes labour from
the barangay side, not just the intake step.

```ts
// src/lib/pdf/generate.ts
export async function generateDocument(request: RequestWithService): Promise<{
  pdf: Uint8Array
  hash: string            // sha256 hex of the PDF bytes
  controlNumber: string   // BRGY-2026-000001
}>
```

Use `pdf-lib` (already installed). The route needs `export const runtime = 'nodejs'`
— it will not work on Edge.

Must include: LGU letterhead and seal (Jasmin, `public/brand/`), the citizen's
**verified** details from `requests.everify_payload`, the form data, control
number, issue date, an officer signature block, and the QR.

`controlNumber()` already exists in `src/lib/format.ts` and produces
`BRGY-2026-000001`. Sequence per LGU per year — barangays file by control number,
so it has to look like something an officer recognises.

### Hash ordering matters

Render the complete PDF, including a QR pointing at `/verify/<requestId>` → hash
the final bytes → anchor that hash. Embedding the final hash inside the PDF would
create a self-reference and change the bytes being hashed. The verification route
accepts both request IDs (used by the QR) and final PDF hashes (used by uploads and
manual verification).

Upload to Supabase Storage, store the path in `requests.pdf_path` and the hash in
`requests.doc_hash`.

---

## Task 2 — chain anchoring (`/implementation/egov-chain`)

**This is the highest-risk item in the whole build.** Confirm it early.

Facts from `docs/API_Reference.md`:
- RPC: `https://hackathon-blockchain.e.gov.ph`
- Chain ID **13371** (`0x343b`), gas price **0** — no ETH needed
- Explorer: `https://hackathon-explorer.e.gov.ph` ← **show this on camera**
- No auth on the RPC

### Current implementation

`src/lib/egov/chain.ts` no longer relies on an unlocked node account. It derives
the account from `EGOV_CHAIN_PRIVATE_KEY`, signs locally with `viem`, and submits
the transaction through the public RPC. The PDF hash is transaction calldata on
a zero-value, zero-gas-price transaction to the zero address.

This path is certified live. Transaction
`0x2087fc017308eca297d5595ef15ec58ad731682331cba20f7af236aa4c5d9171`
was confirmed in block `157496`; its calldata matched the submitted PDF hash,
and the block timestamp was retrieved. The committed environment template still
defaults to mock for safe local setup, while production uses live chain mode.

### Verification reads it back

```ts
eth_getTransactionByHash(txHash) → tx.input === '0x' + docHash
```

That's what makes the anchor real rather than a stored string.

### If it doesn't work by 03:00 — stop and fall back

`localReceipt()` in `chain.ts` already produces a deterministic local hash. Ship
that, and have the UI say **"Document verified · not yet anchored on-chain"**.

**Do not show a green check for an unanchored document.** A judge who catches a
false verification has found a credibility problem, and credibility is the entire
pitch. An honest fallback costs you a sentence; a fake check costs the project.

---

## Task 3 — public verification (`/implementation/verify-qr`)

Route: `/verify/[id]` — **public, no auth.** The parameter accepts either the
request UUID embedded in the QR or the final 64-character PDF hash. A bank clerk
scanning a QR does not hit a login wall.

Show: ✓ or ✗, the document type, issuing LGU, control number, issue date, the
chain tx hash **linked to the explorer**, and the anchoring timestamp.

`getRequestByHash()` already exists in `src/lib/data.ts`.

Also build `/verify` with no hash — a paste-a-code / upload-a-PDF form, so the
feature works for someone without a scanner.

### The tamper test — build this deliberately

Let a visitor upload a PDF; hash it; compare. An altered document must show ✗.

**Put this in the video.** Showing only the success case proves nothing — anyone
can render a green check. Showing a tampered document getting *rejected* is what
proves the anchor is load-bearing rather than decorative, and that distinction is
exactly what the 30% integration score is measuring.

The current upload flow computes the SHA-256 hash in the browser and resolves it
against `requests.doc_hash`; an altered file therefore reaches the rejected state.
The remaining presentation gap is the chain anchoring timestamp.

---

## Contracts to freeze by 23:00

```ts
export async function generateDocument(r: RequestWithService): Promise<{
  pdf: Uint8Array; hash: string; controlNumber: string
}>
export async function anchorHash(hash: string): Promise<EgovResult<AnchorResult>>
export async function verifyAnchor(tx: string, hash: string): Promise<EgovResult<ChainVerification>>
```

Elton's SMS needs `controlNumber` and the verify URL — commit the signature early.

---

## Files you own

```
src/lib/pdf/
src/lib/egov/chain.ts
src/app/api/issue/
src/app/verify/
```
