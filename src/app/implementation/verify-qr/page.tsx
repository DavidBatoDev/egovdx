import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { getFeature } from '../manifest'
import Link from 'next/link'

export const metadata = { title: 'Verify QR — implementation harness' }

export default function VerifyQrHarness() {
  const feature = getFeature('verify-qr')!

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Owner: ${feature.owner}`}
        title={feature.name}
        description={feature.summary}
        action={<Badge tone="accent">Building</Badge>}
      />

      {/* Live routes */}
      <Card>
        <CardHeader
          title="Live routes"
          description="These routes are already wired. No mock required — try them now."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-4">
              <code className="shrink-0 rounded bg-background px-2 py-1 font-mono text-xs">
                /verify
              </code>
              <div className="text-sm">
                <p className="text-foreground">Upload PDF or enter hash/control number</p>
                <p className="text-muted">The tamper-test entry point — hashes the uploaded file and looks it up in DB + chain.</p>
                <Link href="/verify" className="text-xs text-brand underline">
                  Open →
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <code className="shrink-0 rounded bg-background px-2 py-1 font-mono text-xs">
                /verify/[id]
              </code>
              <div className="text-sm">
                <p className="text-foreground">Public verification page (no auth required)</p>
                <p className="text-muted">Accepts a request UUID (from QR) or a 64-char SHA-256 hash (from upload). Shows verified citizen identity, chain anchor, and download link.</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* The 30-second demo loop */}
      <Card>
        <CardHeader
          title="The 30-second demo loop"
          description="This is the most demonstrable thing in the project. Film this first."
        />
        <CardBody className="space-y-2 text-sm text-muted">
          <ol className="list-inside list-decimal space-y-2">
            <li>Officer approves a request → <code className="font-mono text-xs">POST /api/issue</code> generates the PDF + QR + anchors on chain.</li>
            <li>Citizen receives the PDF. A QR code is printed on it linking to <code className="font-mono text-xs">/verify/[requestId]</code>.</li>
            <li>Bank clerk scans QR with phone → <span className="text-success font-medium">✓ VERIFIED</span> page with chain explorer link.</li>
            <li>
              Tamper test: alter one byte of the PDF, go to <code className="font-mono text-xs">/verify</code>, upload it.
              The file&rsquo;s SHA-256 changes → DB lookup returns nothing → <span className="text-danger font-medium">✗ REJECTED</span>.
            </li>
          </ol>
          <p className="pt-2 text-xs">
            <strong className="text-foreground">Why it matters:</strong> Forged barangay
            clearances are a real problem. The receiving party has no way to check a paper
            document. This closes that gap in 3 seconds, without calling the barangay.
          </p>
        </CardBody>
      </Card>

      {/* API */}
      <Card>
        <CardHeader title="Supporting API" />
        <CardBody>
          <pre className="overflow-x-auto rounded-lg bg-background px-4 py-3 font-mono text-xs">
            {`POST /api/issue           { requestId } → { hash, chainTx, verifyUrl, … }
GET  /api/issue/download  ?id=<requestId> → PDF file
GET  /api/verify/control  ?cn=BRGY-2026-000001 → redirect to /verify/<id>`}
          </pre>
        </CardBody>
      </Card>

      {/* Dependencies */}
      <Card>
        <CardHeader title="Dependencies satisfied" />
        <CardBody>
          <ul className="space-y-2 text-sm">
            {feature.dependsOn.map((dep) => (
              <li key={dep} className="flex items-center gap-2">
                <span className="text-success">✓</span>
                <code className="font-mono text-xs">{dep}</code>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
