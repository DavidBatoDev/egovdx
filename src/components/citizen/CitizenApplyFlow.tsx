'use client'

import { type FormEvent, type ReactNode, useState } from 'react'
import { LivenessCapture, type EverifyLivenessCapture } from '@/components/liveness/LivenessCapture'
import { Badge, Button, Card, CardBody, CardHeader, Field, PageHeader, SourceBadge, inputClass } from '@/components/ui'
import type { EgovSource } from '@/lib/egov/client'
import type { VerifiedIdentity } from '@/lib/egov/everify'
import type { FormField } from '@/lib/supabase/types'
import { peso } from '@/lib/format'

export type ApplyService = {
  id: string
  lguName: string
  templateName: string
  description: string | null
  feeAmount: number
  requiredDocs: string[]
  formFields: FormField[]
  approvalOffice: string | null
  livenessMode: 'live' | 'mock'
}

type Verification = {
  identity: VerifiedIdentity
  source: EgovSource
  verificationReceipt: string
}

type Submission = { requestId: string; status: string }

export function CitizenApplyFlow({ service }: { service: ApplyService }) {
  const [capture, setCapture] = useState<EverifyLivenessCapture | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<Submission | null>(null)

  const handleCapture = (nextCapture: EverifyLivenessCapture) => {
    setCapture(nextCapture)
    setVerification(null)
    setSubmission(null)
    setError(null)
  }

  const verify = async () => {
    if (!capture) return
    setError(null)
    setSubmission(null)
    setVerifying(true)

    try {
      const response = await fetch('/api/everify/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          faceLivenessSessionId: capture.sessionId,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !isVerification(payload)) {
        throw new Error(readError(payload, 'eVerify could not verify your identity. Please try again.'))
      }

      setVerification(payload)
      setFormData((current) => ({ ...current, ...identityFieldValues(payload.identity) }))
    } catch (cause) {
      setVerification(null)
      setError(cause instanceof Error ? cause.message : 'eVerify could not verify your identity.')
    } finally {
      setVerifying(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!verification) return
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          verificationReceipt: verification.verificationReceipt,
          formData,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !isSubmission(payload)) {
        throw new Error(readError(payload, 'Your request could not be submitted. Please try again.'))
      }
      setSubmission(payload)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={`${service.lguName} · citizen request`}
        title={service.templateName}
        description={service.description ?? 'Complete your verified request for this LGU service.'}
        action={
          <Badge tone={service.feeAmount > 0 ? 'accent' : 'success'}>
            {service.feeAmount > 0 ? peso(service.feeAmount) : 'No fee'}
          </Badge>
        }
      />

      <p className="border-l-2 border-brand pl-3 text-sm text-muted">
        Your eGovPH identity is used only to verify this request. Capture first, then eVerify
        retrieves your record, then you submit the service details.
      </p>

      <StepCard number="01" title="Confirm you are present" description="Complete the eVerify face liveness check.">
        <LivenessCapture mode={service.livenessMode} onComplete={handleCapture} />
      </StepCard>

      <StepCard
        number="02"
        title="Verify your PhilSys record"
        description="Your completed SDK session is sent to eVerify with your eGovPH profile."
        action={
          <Button type="button" onClick={verify} disabled={!capture || verifying}>
            {verifying ? 'Verifying identity…' : verification ? 'Verify again' : 'Verify identity'}
          </Button>
        }
      >
        {!capture ? (
          <p className="text-sm text-muted">Complete face liveness before verifying your identity.</p>
        ) : null}

        {verification ? <VerifiedIdentityCard verification={verification} /> : null}
      </StepCard>

      {verification ? (
        <form onSubmit={submit} className="space-y-6">
          <StepCard
            number="03"
            title="Add request details"
            description="Fields from PhilSys are locked. Residency duration is declared by you because eVerify does not verify it."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {service.formFields.map((field) => (
                <RequestField
                  key={field.key}
                  field={field}
                  value={formData[field.key] ?? ''}
                  onChange={(value) => setFormData((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </div>

            {service.requiredDocs.length > 0 ? (
              <div className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
                <p className="font-medium">Bring or upload these supporting documents when prompted</p>
                <p className="mt-1">{service.requiredDocs.join(' · ')}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted">
                {service.approvalOffice
                  ? `Routes to ${service.approvalOffice} after submission.`
                  : 'Routes to the LGU approval queue after submission.'}
              </p>
              <Button type="submit" disabled={submitting || Boolean(submission)}>
                {submitting ? 'Submitting request…' : submission ? 'Request submitted' : 'Submit request'}
              </Button>
            </div>
          </StepCard>
        </form>
      ) : null}

      {error ? (
        <Card className="border-danger/30 bg-danger-soft">
          <CardBody className="text-sm text-danger">{error}</CardBody>
        </Card>
      ) : null}

      {submission ? (
        <Card className="border-success/30 bg-success-soft">
          <CardBody className="space-y-1 text-sm text-success">
            <p className="font-semibold">Pending LGU approval</p>
            <p>Your request has been submitted to the approval queue.</p>
            <p className="font-mono text-xs opacity-80">Request {submission.requestId}</p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
  action,
  children,
}: {
  number: string
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-brand">{number}</span>
            {title}
          </span>
        }
        description={description}
        action={action}
      />
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  )
}

function VerifiedIdentityCard({ verification }: { verification: Verification }) {
  const { identity } = verification
  return (
    <div className="rounded-lg border border-success/20 bg-success-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-success">Identity record retrieved</p>
        <SourceBadge source={verification.source} />
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <IdentityValue label="Name" value={identity.fullName} />
        <IdentityValue label="Birth date" value={identity.birthdate} />
        <IdentityValue label="Registered address" value={identity.address} className="sm:col-span-2" />
        {identity.everifyReference ? <IdentityValue label="eVerify reference" value={identity.everifyReference} /> : null}
      </dl>
      {verification.source !== 'live' ? (
        <p className="mt-3 text-xs text-warn">
          This is fixture data, not a live PhilSys verification. The request records its source.
        </p>
      ) : null}
    </div>
  )
}

function IdentityValue({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{value}</dd>
    </div>
  )
}

function RequestField({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: string
  onChange: (value: string) => void
}) {
  const verified = isVerifiedIdentityField(field)
  const declaredResidency = field.key === 'years_of_residency'
  const hint = verified ? <Badge tone="success">Verified</Badge> : declaredResidency ? <Badge tone="neutral">Your declaration</Badge> : undefined

  return (
    <Field label={field.label} required={field.required} hint={hint}>
      {field.type === 'select' ? (
        <select
          className={inputClass}
          value={value}
          required={field.required}
          disabled={verified}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          className={inputClass}
          value={value}
          required={field.required}
          disabled={verified}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
        />
      ) : (
        <input
          className={inputClass}
          type={field.type === 'number' || field.type === 'date' ? field.type : 'text'}
          value={value}
          required={field.required}
          disabled={verified}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}

function isVerifiedIdentityField(field: FormField): boolean {
  return field.source === 'everify' && field.key !== 'years_of_residency'
}

function identityFieldValues(identity: VerifiedIdentity): Record<string, string> {
  return {
    full_name: identity.fullName,
    address: identity.address,
    birthdate: identity.birthdate,
    mobile: identity.mobile ?? '',
  }
}

function isVerification(value: unknown): value is Verification {
  if (!isRecord(value) || typeof value.verificationReceipt !== 'string' || !isSource(value.source)) return false
  return isIdentity(value.identity)
}

function isSubmission(value: unknown): value is Submission {
  return isRecord(value) && typeof value.requestId === 'string' && typeof value.status === 'string'
}

function isIdentity(value: unknown): value is VerifiedIdentity {
  return (
    isRecord(value) &&
    typeof value.verified === 'boolean' &&
    typeof value.fullName === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.middleName === 'string' &&
    typeof value.lastName === 'string' &&
    typeof value.birthdate === 'string' &&
    typeof value.address === 'string' &&
    value.yearsOfResidency === null &&
    (typeof value.mobile === 'string' || value.mobile === null) &&
    value.philsysReference === null &&
    (typeof value.everifyReference === 'string' || value.everifyReference === null)
  )
}

function isSource(value: unknown): value is EgovSource {
  return value === 'live' || value === 'mock' || value === 'fallback'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readError(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === 'string' ? value.error : fallback
}
