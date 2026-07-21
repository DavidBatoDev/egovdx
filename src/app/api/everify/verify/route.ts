import { NextResponse, type NextRequest } from 'next/server'
import { createVerificationReceipt } from '@/lib/auth/verification'
import { requireRole } from '@/lib/auth/session'
import { getService } from '@/lib/data'
import { verifyIdentity } from '@/lib/egov/everify'

export const runtime = 'nodejs'

/**
 * Verifies the authenticated citizen after the browser SDK has completed.
 * Demographics come from the signed SSO session, never from browser input.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('citizen')
    const body = await req.json().catch(() => null)
    if (!isRecord(body) || !nonEmptyString(body.serviceId) || !nonEmptyString(body.faceLivenessSessionId)) {
      return NextResponse.json(
        { error: 'serviceId and faceLivenessSessionId are required' },
        { status: 400 },
      )
    }

    if (!session.firstName || !session.lastName || !session.birthdate) {
      return NextResponse.json(
        { error: 'Your eGovPH profile is missing the demographics required for eVerify.' },
        { status: 422 },
      )
    }

    const service = await getService(body.serviceId)
    if (!service || service.status !== 'published') {
      return NextResponse.json({ error: 'This service is not available for requests.' }, { status: 404 })
    }

    const result = await verifyIdentity({
      firstName: session.firstName,
      middleName: session.middleName,
      lastName: session.lastName,
      suffix: session.suffix,
      birthdate: session.birthdate,
      faceLivenessSessionId: body.faceLivenessSessionId,
    })

    const verificationReceipt = await createVerificationReceipt({
      citizenSub: session.sub,
      serviceId: service.id,
      livenessSessionId: body.faceLivenessSessionId,
      source: result.source,
      identity: result.data,
    })

    return NextResponse.json({
      identity: result.data,
      source: result.source,
      ...(result.error ? { error: result.error } : {}),
      verificationReceipt,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Sign in as a citizen to verify your identity.' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Only citizens can submit requests.' }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : 'Unable to verify identity.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
