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
 * NOTE: eth_sendTransaction requires an unlocked account on the node. The
 * hackathon node exposes no such account (eth_accounts → []). We therefore
 * sign the transaction locally with a private key from env and submit via
 * eth_sendRawTransaction — which is the correct path on any public node.
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

/**
 * Sign and submit a raw transaction anchoring the document hash in calldata.
 * Uses viem for signing only; submits via eth_sendRawTransaction to avoid
 * chain-type requirements on the viem wallet client.
 */
async function sendRawAnchorTransaction(docHash: string): Promise<string> {
  const privateKey = process.env.EGOV_CHAIN_PRIVATE_KEY
  if (!privateKey) throw new Error('EGOV_CHAIN_PRIVATE_KEY is not set')

  const { privateKeyToAccount } = await import('viem/accounts')
  const { defineChain, createWalletClient, http } = await import('viem')

  const rpcUrl = process.env.EGOV_CHAIN_RPC_URL!

  const egovChain = defineChain({
    id: 13371,
    name: 'eGOV Hackathon',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  const account = privateKeyToAccount(privateKey as `0x${string}`)

  // Get the sender's nonce.
  const nonceHex = await rpc<string>('eth_getTransactionCount', [account.address, 'pending'])

  const client = createWalletClient({ account, chain: egovChain, transport: http(rpcUrl) })

  const txHash = await client.sendTransaction({
    to: '0x0000000000000000000000000000000000000000',
    value: 0n,
    data: `0x${docHash}` as `0x${string}`,
    gas: 100_000n,
    gasPrice: 0n,
    nonce: parseInt(nonceHex, 16),
  })

  return txHash
}

/** Anchor a document hash as transaction calldata. */
export async function anchorHash(docHash: string): Promise<EgovResult<AnchorResult>> {
  return callEgov<AnchorResult>(
    'CHAIN',
    async () => {
      const txHash = await sendRawAnchorTransaction(docHash)
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
 * Deterministic stand-in so the demo has a stable, checkable reference when
 * the chain is unreachable. It is derived from the document hash, so it still
 * detects tampering — but it proves nothing about a distributed ledger, and the
 * UI labels it as unanchored rather than showing a green check.
 */
function localReceipt(docHash: string): string {
  return `0x${createHash('sha256').update(`egovdx-local:${docHash}`).digest('hex')}`
}
