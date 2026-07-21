import { Badge, Card, CardBody, CardHeader, PageHeader, SourceBadge } from '@/components/ui'
import { getFeature } from '../manifest'
import { egovMode } from '@/lib/egov/client'
import { generateDocument } from '@/lib/pdf/generate'
import type { RequestWithService } from '@/lib/data'

export const metadata = { title: 'Doc Issuance — implementation harness' }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildMockRequest(): RequestWithService {
  return {
    id: 'mock-request-id-12345',
    lgu_service_id: 'mock-service-id',
    citizen_sub: 'mock-citizen-sub',
    citizen_name: 'JOSIE DELA CRUZ',
    citizen_mobile: '+639090000000',
    everify_payload: {
      full_name: 'JOSIE SANTOS DELA CRUZ',
      birth_date: '1990-01-01',
      full_address: '123 Rizal St., Poblacion, City of Alaminos, Pangasinan',
      reference: 'EV-MOCK-2026-001',
    },
    liveness_session: null,
    liveness_passed: true,
    form_data: {
      purpose: 'Employment',
      years_of_residency: '5',
    },
    status: 'approved',
    fee_due: 150,
    fee_status: 'paid',
    waiver_applied: null,
    payment_ref: 'PAY-MOCK-001',
    payment_uuid: null,
    payment_url: null,
    payment_txnid: null,
    payment_source: 'mock',
    payment_checked_at: new Date().toISOString(),
    uploaded_docs: [],
    liveness_score: 98.5,
    everify_reference: 'EV-MOCK-2026-001',
    approved_by: 'mock-officer',
    approved_at: new Date().toISOString(),
    rejected_by: null,
    rejected_at: null,
    rejection_note: null,
    issuance_status: 'not_started',
    issuance_attempts: 0,
    issuance_started_at: null,
    issuance_error: null,
    control_number: null,
    pdf_path: null,
    doc_hash: null,
    chain_tx: null,
    chain_source: null,
    sms_status: 'not_sent',
    sms_source: null,
    sms_message_id: null,
    sms_sent_at: null,
    sms_error: null,
    issued_at: null,
    created_at: new Date().toISOString(),
    service: {
      id: 'mock-service-id',
      lgu_id: 'mock-lgu-id',
      template_id: 'mock-template-id',
      status: 'published',
      fee_amount: 150,
      waivers: [],
      required_docs: ['Valid ID', 'Proof of Residency'],
      eligibility: {},
      form_fields: [
        { key: 'purpose', label: 'Purpose', type: 'text', required: true },
        { key: 'years_of_residency', label: 'Years of Residency', type: 'number', required: true },
      ],
      doc_template_path: null,
      source_prompt: null,
      generated_by: 'manual',
      generator_model: null,
      generation_confidence: null,
      reviewed_by: null,
      reviewed_at: null,
      approval_office: 'Office of the Punong Barangay',
      submitted_at: null,
      published_at: null,
      created_at: new Date().toISOString(),
      lgu: { id: 'mock-lgu-id', name: 'Brgy. Poblacion, Marilao', type: 'barangay' },
      template: {
        id: 'mock-template-id',
        code: 'BRGY_CLEARANCE',
        name: 'Barangay Clearance',
        description: 'General-purpose barangay clearance',
        max_fee: 200,
      },
    },
  } as RequestWithService
}

export default async function DocIssuanceHarness() {
  const feature = getFeature('doc-issuance')!

  let result: { pdf: Uint8Array; hash: string; controlNumber: string } | null = null
  let errorMsg: string | null = null

  try {
    result = await generateDocument(buildMockRequest())
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Owner: ${feature.owner}`}
        title={feature.name}
        description={feature.summary}
        action={<Badge tone="accent">Building</Badge>}
      />

      {/* Result */}
      <Card>
        <CardHeader
          title="Generated Document (mock request)"
          description="generateDocument() called with a seeded mock request. In production this receives the real approved request."
        />
        <CardBody>
          {errorMsg ? (
            <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{errorMsg}</p>
          ) : result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted">Control Number</p>
                  <p className="font-mono text-foreground">{result.controlNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">PDF Size</p>
                  <p className="font-mono text-foreground">
                    {(result.pdf.byteLength / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted">SHA-256 Hash (doc_hash)</p>
                  <p className="break-all font-mono text-xs text-foreground">{result.hash}</p>
                </div>
              </div>
              <p className="text-sm text-muted">
                The hash above is what gets anchored on eGOV chain and embedded in the QR.
                Altering one byte of the PDF produces a different hash → verification fails.
              </p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Contract */}
      <Card>
        <CardHeader
          title="What this feature provides"
          description="Call generateDocument() from the approval handler."
        />
        <CardBody>
          <pre className="overflow-x-auto rounded-lg bg-background px-4 py-3 font-mono text-xs">
            {`export async function generateDocument(
  request: RequestWithService
): Promise<{
  pdf: Uint8Array      // the issued PDF bytes (with QR embedded)
  hash: string         // SHA-256 hex of the PDF bytes → stored as doc_hash
  controlNumber: string // e.g. BRGY-2026-000001
}>`}
          </pre>
        </CardBody>
      </Card>

      {/* Files */}
      <Card>
        <CardHeader title="Files owned" />
        <CardBody>
          <ul className="space-y-1 font-mono text-xs text-muted">
            {feature.owns.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
