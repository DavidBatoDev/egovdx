import 'server-only'
import { createHash } from 'node:crypto'
import { callEgov, type EgovResult } from './client'

/**
 * eGOV chain — Hyperledger Besu over JSON-RPC, zero gas fee.
 *
 * We anchor the SHA-256 of each issued PDF in the calldata of a zero-value
 * transaction. That gives a tamper-evident, publicly checkable record: anyone
 * holding the document can hash it and confirm the same hash was anchored,
 * without calling the barangay.
 *
 * Why this matters here specifically: forged barangay clearances and indigency
 * certificates are a known problem, and the receiving party — a bank, an
 * employer, a school — currently has no way to check. This closes that.
 *
 * NOTE: the catalog publishes no endpoint list for this API, so the JSON-RPC
 * methods below are standard Ethereum ones that any Besu node exposes. Run
 * scripts/probe.ts to confirm before flipping EGOV_CHAIN_MODE to live.
 */

export type AnchorResult = {
  txHash: string
  /** false when we could not reach a real chain and produced a local receipt. */
  onChain: boolean
}

export type ChainVerification = {
  found: boolean
  txHash: string | null
  anchoredHash: string | null
  blockNumber: number | null
}

let rpcId = 0

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = process.env.EGOV_CHAIN_RPC_URL
  if (!url) throw new Error('EGOV_CHAIN_RPC_URL is not set')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Besu RPC ${method} → HTTP ${res.status}`)

    const json = await res.json()
    if (json.error) throw new Error(`Besu RPC ${method} → ${JSON.stringify(json.error)}`)

    return json.result as T
  } finally {
    clearTimeout(timer)
  }
}

/** Anchor a document hash as transaction calldata. */
export async function anchorHash(docHash: string): Promise<EgovResult<AnchorResult>> {
  return callEgov<AnchorResult>(
    'CHAIN',
    async () => {
      const accounts = await rpc<string[]>('eth_accounts', [])
      const from = accounts[0]
      if (!from) {
        throw new Error('Besu node exposed no unlocked account to send from')
      }

      const txHash = await rpc<string>('eth_sendTransaction', [
        {
          from,
          // Burn address: we are storing data, not transferring value.
          to: '0x0000000000000000000000000000000000000000',
          value: '0x0',
          data: `0x${docHash}`,
        },
      ])

      return { txHash, onChain: true }
    },
    () => ({ txHash: localReceipt(docHash), onChain: false }),
  )
}

/** Read an anchor back and confirm the calldata still matches the document. */
export async function verifyAnchor(
  txHash: string,
  expectedHash: string,
): Promise<EgovResult<ChainVerification>> {
  return callEgov(
    'CHAIN',
    async () => {
      const tx = await rpc<{ input: string; blockNumber: string | null } | null>(
        'eth_getTransactionByHash',
        [txHash],
      )

      if (!tx) return { found: false, txHash, anchoredHash: null, blockNumber: null }

      const anchoredHash = tx.input.replace(/^0x/, '')
      return {
        found: anchoredHash.toLowerCase() === expectedHash.toLowerCase(),
        txHash,
        anchoredHash,
        blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null,
      }
    },
    () => ({
      found: txHash === localReceipt(expectedHash),
      txHash,
      anchoredHash: expectedHash,
      blockNumber: null,
    }),
  )
}

/**
 * Deterministic stand-in so the demo has a stable, checkable reference when the
 * chain is unreachable. It is derived from the document hash, so it still
 * detects tampering — but it proves nothing about a distributed ledger, and the
 * UI labels it as unanchored rather than showing a green check.
 */
function localReceipt(docHash: string): string {
  return `0x${createHash('sha256').update(`egovdx-local:${docHash}`).digest('hex')}`
}
