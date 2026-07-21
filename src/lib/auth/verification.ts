import 'server-only'
import { jwtVerify, SignJWT } from 'jose'
import type { EgovSource } from '@/lib/egov/client'
import type { VerifiedIdentity } from '@/lib/egov/everify'

const RECEIPT_LIFETIME = '10m'

export type VerificationReceipt = {
  citizenSub: string
  serviceId: string
  livenessSessionId: string
  source: EgovSource
  identity: VerifiedIdentity
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 16) {
    throw new Error('SESSION_SECRET must be set to a random string of 16+ characters')
  }
  return new TextEncoder().encode(`${value}:everify-receipt`)
}

export async function createVerificationReceipt(receipt: VerificationReceipt): Promise<string> {
  return new SignJWT({
    serviceId: receipt.serviceId,
    livenessSessionId: receipt.livenessSessionId,
    source: receipt.source,
    identity: receipt.identity,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(receipt.citizenSub)
    .setIssuedAt()
    .setExpirationTime(RECEIPT_LIFETIME)
    .sign(secret())
}

export async function readVerificationReceipt(token: string): Promise<VerificationReceipt> {
  const { payload } = await jwtVerify(token, secret())
  const identity = payload.identity

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.serviceId !== 'string' ||
    typeof payload.livenessSessionId !== 'string' ||
    !isEgovSource(payload.source) ||
    !isVerifiedIdentity(identity)
  ) {
    throw new Error('Verification receipt is incomplete or invalid')
  }

  return {
    citizenSub: payload.sub,
    serviceId: payload.serviceId,
    livenessSessionId: payload.livenessSessionId,
    source: payload.source,
    identity,
  }
}

function isEgovSource(value: unknown): value is EgovSource {
  return value === 'live' || value === 'mock' || value === 'fallback'
}

function isVerifiedIdentity(value: unknown): value is VerifiedIdentity {
  if (!isRecord(value)) return false
  return (
    typeof value.verified === 'boolean' &&
    typeof value.fullName === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.middleName === 'string' &&
    typeof value.lastName === 'string' &&
    typeof value.birthdate === 'string' &&
    typeof value.address === 'string' &&
    (typeof value.yearsOfResidency === 'number' || value.yearsOfResidency === null) &&
    (typeof value.mobile === 'string' || value.mobile === null) &&
    (typeof value.philsysReference === 'string' || value.philsysReference === null) &&
    (typeof value.everifyReference === 'string' || value.everifyReference === null)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
