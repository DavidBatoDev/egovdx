import { Badge, Card, CardBody, CardHeader, PageHeader, SourceBadge } from '@/components/ui'
import { getFeature } from '../manifest'
import { egovMode } from '@/lib/egov/client'
import { anchorHash, verifyAnchor } from '@/lib/egov/chain'
import { shortHash } from '@/lib/format'

export const metadata = { title: 'eGOV chain — implementation harness' }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEMO_HASH = '4d967a2e2c1b4a8c7f3e0d1a6b5c9f2e8a7b3d4e1c0f5a9b8e7d2c6a4f3b1d0e'

export default async function EgovChainHarness() {
  const feature = getFeature('egov-chain')!
  const mode = egovMode('CHAIN')

  // Anchor the demo hash
  const anchorResult = await anchorHash(DEMO_HASH)

  // Verify it back
  const verifyResult = await verifyAnchor(anchorResult.data.txHash, DEMO_HASH)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Owner: ${feature.owner}`}
        title={feature.name}
        description={feature.summary}
        action={
          <div className="flex gap-2">
            <Badge tone={mode === 'mock' ? 'neutral' : 'success'}>{mode} mode</Badge>
            <Badge tone="accent">Building</Badge>
          </div>
        }
      />

      {/* Chain probe */}
      <Card>
        <CardHeader
          title="Anchor + Verify (demo hash)"
          description="Sends a zero-value transaction with the demo hash as calldata, then reads it back."
          action={<SourceBadge source={anchorResult.source} />}
        />
        <CardBody className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted">Input hash</p>
              <p className="font-mono text-xs text-foreground">{shortHash(DEMO_HASH)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">On-chain</p>
              <p className={`font-mono text-xs ${anchorResult.data.onChain ? 'text-success' : 'text-warn'}`}>
                {anchorResult.data.onChain ? 'Yes' : 'No (local fallback)'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted">Transaction hash</p>
              {anchorResult.data.onChain ? (
                <a
                  href={`https://hackathon-explorer.e.gov.ph/tx/${anchorResult.data.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-brand underline"
                >
                  {shortHash(anchorResult.data.txHash)}
                </a>
              ) : (
                <p className="font-mono text-xs text-foreground">
                  {shortHash(anchorResult.data.txHash)}
                </p>
              )}
            </div>
          </div>

          <hr className="border-border" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted">Verify result</p>
              <p className={`font-mono text-xs ${verifyResult.data.found ? 'text-success' : 'text-danger'}`}>
                {verifyResult.data.found ? '✓ Hash matches' : '✗ Mismatch'}
              </p>
            </div>
            {verifyResult.data.blockNumber !== null && (
              <div>
                <p className="text-xs text-muted">Block</p>
                <p className="font-mono text-xs text-foreground">{verifyResult.data.blockNumber}</p>
              </div>
            )}
          </div>

          {anchorResult.source === 'fallback' && (
            <div className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              ⚠ Chain unreachable — using deterministic local receipt. The demo will say
              &ldquo;not yet anchored&rdquo; rather than showing a false green check.
            </div>
          )}
        </CardBody>
      </Card>

      {/* Contract */}
      <Card>
        <CardHeader
          title="What this feature provides"
          description="anchorHash() and verifyAnchor() — used by the issue endpoint and the verify page."
        />
        <CardBody>
          <pre className="overflow-x-auto rounded-lg bg-background px-4 py-3 font-mono text-xs">
            {`export async function anchorHash(
  hash: string
): Promise<EgovResult<AnchorResult>>
// AnchorResult = { txHash: string; onChain: boolean }

export async function verifyAnchor(
  txHash: string,
  expectedHash: string
): Promise<EgovResult<ChainVerification>>
// ChainVerification = { found: boolean; txHash; anchoredHash; blockNumber }`}
          </pre>
        </CardBody>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader title="Implementation notes" />
        <CardBody className="space-y-2 text-sm text-muted">
          <p>
            <strong className="text-foreground">Why eth_sendRawTransaction:</strong> The hackathon
            node exposes no unlocked accounts (eth_accounts → []). We sign locally with a secp256k1
            key from EGOV_CHAIN_PRIVATE_KEY using viem, then submit the signed tx.
          </p>
          <p>
            <strong className="text-foreground">Gas price 0:</strong> Confirmed in the API
            reference (eth_gasPrice → 0x0). An unfunded key still anchors data.
          </p>
          <p>
            <strong className="text-foreground">Fallback:</strong> If the chain is unreachable,
            localReceipt() produces a deterministic hash derived from the document hash — still
            detects tampering, but honest about not being on a distributed ledger.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
