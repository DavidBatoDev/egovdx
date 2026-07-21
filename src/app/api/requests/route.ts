import { NextResponse, type NextRequest } from 'next/server'
import { readVerificationReceipt } from '@/lib/auth/verification'
import { requireRole } from '@/lib/auth/session'
import { getService, recordEvent } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { FormField } from '@/lib/supabase/types'

export const runtime = 'nodejs'

/**
 * Persist a citizen request only when it carries a fresh receipt issued by the
 * eVerify route. The browser cannot replace verified identity values or bind a
 * request to a different SDK liveness session.
 */
export async function POST(req: NextRequest) {
  try {
    const citizen = await requireRole('citizen')
    const body = await req.json().catch(() => null)
    if (!isRecord(body) || !nonEmptyString(body.serviceId) || !nonEmptyString(body.verificationReceipt)) {
      return NextResponse.json(
        { error: 'serviceId and verificationReceipt are required' },
        { status: 400 },
      )
    }

    const receipt = await readVerificationReceipt(body.verificationReceipt)
    if (receipt.citizenSub !== citizen.sub || receipt.serviceId !== body.serviceId) {
      return NextResponse.json({ error: 'The identity verification does not match this request.' }, { status: 403 })
    }

    const service = await getService(body.serviceId)
    if (!service || service.status !== 'published') {
      return NextResponse.json({ error: 'This service is not available for requests.' }, { status: 404 })
    }

    const submittedValues = stringValues(body.formData)
    const formData = buildFormData(service.form_fields, submittedValues, receipt.identity)

    const db = supabaseAdmin()
    const { data: existing, error: existingError } = await db
      .from('requests')
      .select('id')
      .eq('citizen_sub', citizen.sub)
      .eq('liveness_session', receipt.livenessSessionId)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) {
      return NextResponse.json(
        { error: 'This completed liveness session has already been used for a request.' },
        { status: 409 },
      )
    }

    const { data: request, error } = await db
      .from('requests')
      .insert({
        lgu_service_id: service.id,
        citizen_sub: citizen.sub,
        citizen_name: receipt.identity.fullName,
        citizen_mobile: receipt.identity.mobile ?? citizen.mobile,
        everify_payload: { ...receipt.identity, source: receipt.source },
        liveness_session: receipt.livenessSessionId,
        liveness_passed: true,
        // The eVerify browser SDK documents no confidence score. Never invent one.
        liveness_score: null,
        everify_reference: receipt.identity.everifyReference,
        form_data: formData,
        fee_due: service.fee_amount,
        fee_status: 'unpaid',
        status: 'submitted',
      })
      .select('id, status')
      .single()
    if (error || !request) throw new Error(error?.message ?? 'Request was not created')

    await recordEvent(request.id, 'citizen', 'request_submitted', {
      service_id: service.id,
      liveness_session: receipt.livenessSessionId,
      liveness_passed: true,
      liveness_score: null,
      everify_reference: receipt.identity.everifyReference,
      everify_source: receipt.source,
    })

    return NextResponse.json({ requestId: request.id, status: request.status }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Sign in as a citizen to submit a request.' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Only citizens can submit requests.' }, { status: 403 })
    }
    if (error instanceof Error && /JWT|receipt/i.test(error.message)) {
      return NextResponse.json({ error: 'Identity verification expired. Please verify again.' }, { status: 422 })
    }

    const message = error instanceof Error ? error.message : 'Unable to submit your request.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildFormData(
  fields: FormField[],
  submitted: Record<string, string>,
  identity: {
    fullName: string
    birthdate: string
    address: string
    mobile: string | null
  },
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const field of fields) {
    const value = isVerifiedIdentityField(field)
      ? verifiedValue(field.key, identity)
      : submitted[field.key]?.trim() ?? ''

    if (field.required && !value) throw new Error(`${field.label} is required.`)
    if (field.type === 'select' && value && field.options && !field.options.includes(value)) {
      throw new Error(`${field.label} contains an invalid option.`)
    }
    if (field.type === 'number' && value && !Number.isFinite(Number(value))) {
      throw new Error(`${field.label} must be a number.`)
    }
    result[field.key] = value
  }

  return result
}

function isVerifiedIdentityField(field: FormField): boolean {
  // Residency duration is never supplied by eVerify, even in seeded fields
  // that predate the corrected API contract.
  return field.source === 'everify' && field.key !== 'years_of_residency'
}

function verifiedValue(
  key: string,
  identity: { fullName: string; birthdate: string; address: string; mobile: string | null },
): string {
  const values: Record<string, string> = {
    full_name: identity.fullName,
    address: identity.address,
    birthdate: identity.birthdate,
    mobile: identity.mobile ?? '',
  }
  if (!(key in values)) {
    throw new Error(`${key} is configured as eVerify data but is not supplied by eVerify.`)
  }
  return values[key]
}

function stringValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === 'string' || typeof item === 'number' ? [[key, String(item)]] : [],
    ),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
