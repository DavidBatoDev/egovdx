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
  blockNumber: number | null
  blockTimestamp: string | null
}

export type ChainVerification = {
  found: boolean
  txHash: string | null
  anchoredHash: string | null
  blockNumber: number | null
  blockTimestamp: string | null
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

  try {
    return await client.sendTransaction({ to: '0x0000000000000000000000000000000000000000', value: 0n, data: `0x${docHash}` as `0x${string}`, gas: 100_000n, gasPrice: 0n, nonce: parseInt(nonceHex, 16) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/nonce|already known|replacement/i.test(message)) throw error
    const refreshed = await rpc<string>('eth_getTransactionCount', [account.address, 'pending'])
    return client.sendTransaction({ to: '0x0000000000000000000000000000000000000000', value: 0n, data: `0x${docHash}` as `0x${string}`, gas: 100_000n, gasPrice: 0n, nonce: parseInt(refreshed, 16) })
  }
}

type Receipt = { status: string | null; blockNumber: string | null }

async function confirmedAnchor(txHash: string, expectedHash: string): Promise<Omit<AnchorResult, 'txHash'>> {
  let receipt: Receipt | null = null
  for (let attempt = 0; attempt < 15; attempt++) {
    receipt = await rpc<Receipt | null>('eth_getTransactionReceipt', [txHash])
    if (receipt?.blockNumber) break
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  if (!receipt?.blockNumber) throw new Error('Chain transaction was not mined within 30 seconds')
  if (receipt.status && receipt.status !== '0x1') throw new Error('Chain transaction reverted')
  const tx = await rpc<{ input?: string } | null>('eth_getTransactionByHash', [txHash])
  if (!tx || tx.input?.replace(/^0x/, '').toLowerCase() !== expectedHash.toLowerCase()) throw new Error('Chain calldata read-back did not match the document hash')
  const block = await rpc<{ timestamp?: string } | null>('eth_getBlockByNumber', [receipt.blockNumber, false])
  const timestamp = block?.timestamp ? new Date(parseInt(block.timestamp, 16) * 1000).toISOString() : null
  return { onChain: true, blockNumber: parseInt(receipt.blockNumber, 16), blockTimestamp: timestamp }
}

/** Anchor a document hash as transaction calldata. */
export async function anchorHash(docHash: string): Promise<EgovResult<AnchorResult>> {
  if (!/^[0-9a-f]{64}$/i.test(docHash)) throw new Error('Document hash must be 64 hexadecimal characters')
  return callEgov<AnchorResult>(
    'CHAIN',
    async () => {
      const txHash = await sendRawAnchorTransaction(docHash)
      return { txHash, ...(await confirmedAnchor(txHash, docHash)) }
    },
    () => ({ txHash: localReceipt(docHash), onChain: false, blockNumber: null, blockTimestamp: null }),
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

      if (!tx) return { found: false, txHash, anchoredHash: null, blockNumber: null, blockTimestamp: null }

      const anchoredHash = tx.input.replace(/^0x/, '')
      const block = tx.blockNumber ? await rpc<{ timestamp?: string } | null>('eth_getBlockByNumber', [tx.blockNumber, false]) : null
      return {
        found: anchoredHash.toLowerCase() === expectedHash.toLowerCase(),
        txHash,
        anchoredHash,
        blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null,
        blockTimestamp: block?.timestamp ? new Date(parseInt(block.timestamp, 16) * 1000).toISOString() : null,
      }
    },
    () => ({
      found: txHash === localReceipt(expectedHash),
      txHash,
      anchoredHash: expectedHash,
      blockNumber: null,
      blockTimestamp: null,
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
