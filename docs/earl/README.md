# Earl — issuance, blockchain anchoring, public verification

**Role:** Full stack engineer
**Routes:** `/implementation/doc-issuance`, `/implementation/egov-chain`, `/implementation/verify-qr`
**API owned:** eGOV chain
**Blocked by:** nobody — start immediately
**You unblock:** Elton's SMS (needs the control number and PDF URL)

---

## You own the single most demonstrable thing in the project

```
issue → scan → verified
```

The brief calls this "the single most demonstrable thing in either concept", and
it's the 30-second loop the reel is built around. Forged barangay clearances are
a real, known problem, and the receiving party — a bank, an employer, a school —
currently has no way to check. You're building the thing that closes that.

Nothing blocks you. Start at 22:30.

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

Generate PDF → hash the bytes → anchor → **embed a QR pointing at
`/verify/<hash>`**. The QR contains the hash, so embedding it doesn't change the
hash it refers to. Don't hash after embedding or you'll chase your own tail.

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

### The problem with my implementation

`src/lib/egov/chain.ts` uses `eth_sendTransaction`, which requires an unlocked
account on the node. A public hackathon node almost certainly has none, so
`eth_accounts` will return `[]`.

**You need `eth_sendRawTransaction` with a locally signed transaction.** First
thing to check:

```bash
curl -X POST https://hackathon-blockchain.e.gov.ph \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}'
```

Empty result → signing path confirmed. Install `viem` (lighter than ethers),
generate a keypair, put the private key in `EGOV_CHAIN_PRIVATE_KEY`.

Anchor by putting the hash in transaction calldata, value 0, to the zero address.
Gas price is 0, so an unfunded key still works — **verify that assumption early**,
because if it needs funding you'll want the remaining hours to find out how.

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

Route: `/verify/[hash]` — **public, no auth.** A bank clerk scanning a QR must
not hit a login wall. This is the payoff shot.

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
