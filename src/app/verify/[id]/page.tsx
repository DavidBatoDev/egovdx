import Link from 'next/link'
import { getRequest, getRequestByHash } from '@/lib/data'
import { verifyAnchor } from '@/lib/egov/chain'
import { dateOnly, shortHash } from '@/lib/format'
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  SourceBadge,
  StatusBadge,
} from '@/components/ui'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `Document Verification — ${id.slice(0, 12)}…` }
}

export default async function VerifyPage({ params }: Props) {
  const { id } = await params

  // Support both UUID lookups (from QR code) and SHA256 hash lookups (from upload verify).
  const isHash = /^[0-9a-f]{64}$/i.test(id)
  const request = isHash ? await getRequestByHash(id).catch(() => null) : await getRequest(id).catch(() => null)

  if (!request || request.status !== 'issued') {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mb-6 text-5xl">✗</div>
        <h1 className="text-2xl font-bold text-danger">Document Not Verified</h1>
        <p className="mt-2 text-sm text-muted">
          No issued document was found for this identifier.
        </p>
        {isHash && (
          <p className="mt-1 text-xs text-muted">
            Hash searched: <code className="font-mono">{shortHash(id)}</code>
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          This document may have been tampered with, or the link is invalid.
        </p>
        <div className="mt-8">
          <Link href="/verify" className="text-sm text-brand underline">
            Try verifying another document
          </Link>
        </div>
      </main>
    )
  }

  const docHash = request.doc_hash
  const chainTx = request.chain_tx

  // Verify the chain anchor.
  const chainResult = docHash && chainTx ? await verifyAnchor(chainTx, docHash) : null

  const isVerified = chainResult?.data.found === true
  const isUnanchored = chainResult?.source === 'fallback' || chainResult?.source === 'mock'

  const service = request.service
  const lgu = service.lgu
  const payload = (request.everify_payload ?? {}) as Record<string, string>

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      {/* Verification result banner */}
      <div
        className={`rounded-2xl border-2 px-6 py-8 text-center ${
          isUnanchored
            ? 'border-warn/40 bg-warn-soft'
            : isVerified
              ? 'border-success/40 bg-success-soft'
              : 'border-danger/40 bg-danger-soft'
        }`}
      >
        <div className="mb-2 text-6xl">{isUnanchored ? '⚠' : isVerified ? '✓' : '✗'}</div>
        <h1
          className={`text-2xl font-bold ${
            isUnanchored ? 'text-warn' : isVerified ? 'text-success' : 'text-danger'
          }`}
        >
          {isUnanchored
            ? 'Document Verified · Not Yet Anchored On-Chain'
            : isVerified
              ? 'Document Verified'
              : 'Verification Failed'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isUnanchored
            ? 'The document is authentic, but chain anchoring is pending.'
            : isVerified
              ? 'This document is authentic and its hash matches the blockchain anchor.'
              : 'The document hash does not match the chain record. It may have been altered.'}
        </p>
        {chainResult && <SourceBadge source={chainResult.source} />}
      </div>

      {/* Document details */}
      <Card>
        <CardHeader
          title="Document Details"
          action={<StatusBadge status={request.status} />}
        />
        <CardBody className="space-y-3 text-sm">
          <Row label="Service" value={service.template.name} />
          <Row label="Issuing LGU" value={lgu.name} />
          <Row label="Control Number" value={request.control_number ?? '—'} mono />
          <Row label="Issue Date" value={dateOnly(request.issued_at)} />
        </CardBody>
      </Card>

      {/* Verified citizen identity */}
      <Card>
        <CardHeader title="Verified Identity (eVerify / PhilSys)" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Full Name" value={payload.full_name ?? request.citizen_name ?? '—'} />
          <Row label="Date of Birth" value={payload.birth_date ?? '—'} />
          <Row label="Address" value={payload.full_address ?? payload.present_full_address ?? '—'} />
          {payload.reference && (
            <Row label="eVerify Reference" value={payload.reference} mono />
          )}
        </CardBody>
      </Card>

      {/* Blockchain anchor */}
      <Card>
        <CardHeader
          title="Blockchain Anchor"
          action={
            isUnanchored ? (
              <Badge tone="warn">Local receipt only</Badge>
            ) : isVerified ? (
              <Badge tone="success">On-chain ✓</Badge>
            ) : (
              <Badge tone="danger">Hash mismatch ✗</Badge>
            )
          }
        />
        <CardBody className="space-y-3 text-sm">
          <Row label="Document Hash" value={shortHash(docHash ?? null)} mono />
          {chainTx && (
            <div className="flex justify-between gap-4">
              <span className="text-muted">Transaction Hash</span>
              <a
                href={`https://hackathon-explorer.e.gov.ph/tx/${chainTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-right font-mono text-xs text-brand underline"
              >
                {shortHash(chainTx)}
              </a>
            </div>
          )}
          {chainResult?.data.blockNumber != null && (
            <Row label="Block Number" value={String(chainResult.data.blockNumber)} mono />
          )}
          {(chainResult?.data.blockTimestamp ?? request.chain_anchored_at) && (
            <Row label="Anchored At" value={new Date(chainResult?.data.blockTimestamp ?? request.chain_anchored_at!).toLocaleString('en-PH')} />
          )}
        </CardBody>
      </Card>

      {/* Download */}
      {request.pdf_path && (
        <div className="text-center">
          <a
            href={`/api/issue/download?id=${request.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-brand/30 bg-brand-soft px-4 py-2 text-sm font-medium text-brand hover:bg-brand/10"
          >
            Download PDF
          </a>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Verified by{' '}
        <span className="font-semibold text-brand">eSee LGU</span> powered by eGovPH ·{' '}
        <Link href="/verify" className="underline">
          Verify another document
        </Link>
      </p>
    </main>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted">{label}</span>
      <span className={`text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
