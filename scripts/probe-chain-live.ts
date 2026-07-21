import { config } from 'dotenv'
import { createHash } from 'node:crypto'
config({ path: '.env.local' })

async function main() {
  if (process.env.EGOV_CHAIN_MODE !== 'live') throw new Error('Set EGOV_CHAIN_MODE=live for the explicit write probe')
  if (!process.env.EGOV_CHAIN_PRIVATE_KEY) throw new Error('EGOV_CHAIN_PRIVATE_KEY is not set')
  const { anchorHash, verifyAnchor } = await import('../src/lib/egov/chain')
  const hash = createHash('sha256').update(`eSee-LGU-chain-probe:${new Date().toISOString()}`).digest('hex')
  const anchored = await anchorHash(hash)
  if (anchored.source !== 'live' || !anchored.data.onChain) throw new Error(`Live anchor failed: ${anchored.error ?? anchored.source}`)
  const verified = await verifyAnchor(anchored.data.txHash, hash)
  if (verified.source !== 'live' || !verified.data.found) throw new Error('Live read-back failed')
  console.log(JSON.stringify({ status: 'confirmed', txHash: anchored.data.txHash, blockNumber: anchored.data.blockNumber, blockTimestamp: anchored.data.blockTimestamp, responseKeys: Object.keys(verified.data) }))
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
