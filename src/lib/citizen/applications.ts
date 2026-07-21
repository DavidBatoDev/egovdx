import 'server-only'
import { getRequest, getService, recordEvent, type RequestWithService } from '@/lib/data'
import { verifyIdentity } from '@/lib/egov/everify'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { FormField, UploadedDocument } from '@/lib/supabase/types'
import type { Session } from '@/lib/auth/session'

export function validateFormData(fields: FormField[], value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_FORM_DATA')
  const input = value as Record<string, unknown>
  const allowed = new Set(fields.map((field) => field.key))
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error('UNKNOWN_FORM_FIELD')
  const output: Record<string, unknown> = {}
  for (const field of fields) {
    const current = input[field.key]
    if (field.source === 'everify') continue
    if (field.required && (current == null || String(current).trim() === '')) throw new Error(`REQUIRED_FIELD:${field.key}`)
    if (current == null || current === '') continue
    if (field.type === 'number') {
      const number = Number(current)
      if (!Number.isFinite(number)) throw new Error(`INVALID_NUMBER:${field.key}`)
      output[field.key] = number
    } else if (field.type === 'select') {
      if (!field.options?.includes(String(current))) throw new Error(`INVALID_OPTION:${field.key}`)
      output[field.key] = String(current)
    } else if (field.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(current))) throw new Error(`INVALID_DATE:${field.key}`)
      output[field.key] = String(current)
    } else output[field.key] = String(current).trim()
  }
  return output
}

export async function getOrCreateDraft(serviceId: string, citizen: Session): Promise<RequestWithService> {
  const service = await getService(serviceId)
  if (!service || service.status !== 'published') throw new Error('SERVICE_NOT_AVAILABLE')
  const db = supabaseAdmin()
  const { data: existing } = await db.from('requests').select('id').eq('lgu_service_id', serviceId).eq('citizen_sub', citizen.sub).eq('status', 'draft').maybeSingle()
  if (existing) return (await getRequest(existing.id))!
  const { data, error } = await db.from('requests').insert({
    lgu_service_id: serviceId,
    citizen_sub: citizen.sub,
    citizen_name: citizen.name,
    citizen_mobile: citizen.mobile,
    status: 'draft',
    fee_due: Number(service.fee_amount),
  }).select('id').single()
  if (error) {
    const { data: raced } = await db.from('requests').select('id').eq('lgu_service_id', serviceId).eq('citizen_sub', citizen.sub).eq('status', 'draft').maybeSingle()
    if (!raced) throw new Error(error.message)
    return (await getRequest(raced.id))!
  }
  await recordEvent(data.id, 'citizen', 'application_started', { service_id: serviceId })
  return (await getRequest(data.id))!
}

export async function ownedDraft(id: string, citizenSub: string): Promise<RequestWithService> {
  const request = await getRequest(id)
  if (!request) throw new Error('NOT_FOUND')
  if (request.citizen_sub !== citizenSub) throw new Error('FORBIDDEN')
  if (request.status !== 'draft') throw new Error('NOT_DRAFT')
  return request
}

export async function verifyDraftIdentity(id: string, citizen: Session, sessionId: string) {
  const request = await ownedDraft(id, citizen.sub)
  if (!sessionId.trim()) throw new Error('LIVENESS_REQUIRED')
  if (!citizen.firstName || !citizen.lastName || !citizen.birthDate) throw new Error('SSO_PROFILE_INCOMPLETE')
  const result = await verifyIdentity({
    firstName: citizen.firstName,
    middleName: citizen.middleName,
    lastName: citizen.lastName,
    suffix: citizen.suffix,
    birthDate: citizen.birthDate,
    faceLivenessSessionId: sessionId,
  })
  if (result.source === 'fallback' || !result.data.verified) throw new Error('IDENTITY_NOT_VERIFIED')
  // eVerify is authoritative for the match, but sandbox/profile responses can
  // omit demographic attributes that are already present in the signed eGovPH
  // session. Preserve those values so an eVerify-backed form never renders
  // blank date-of-birth or address fields after a successful verification.
  const identity = {
    ...result.data,
    fullName: result.data.fullName || citizen.name,
    birthdate: result.data.birthdate || citizen.birthdate || citizen.birthDate || '',
    address: result.data.address || citizen.address || '',
    mobile: result.data.mobile || citizen.mobile,
  }
  const payload = { ...identity, source: result.source, ssoAddress: citizen.address ?? '' }
  const { error } = await supabaseAdmin().from('requests').update({
    citizen_name: identity.fullName,
    citizen_mobile: identity.mobile,
    everify_payload: payload,
    everify_reference: result.data.philsysReference,
    liveness_session: sessionId,
    liveness_passed: true,
    liveness_score: null,
  }).eq('id', request.id).eq('citizen_sub', citizen.sub).eq('status', 'draft')
  if (error) throw new Error(error.message)
  await recordEvent(id, 'citizen', 'identity_verified', { source: result.source, reference: result.data.philsysReference })
  return { identity, source: result.source }
}

export async function saveDraftForm(id: string, citizenSub: string, formData: unknown) {
  const request = await ownedDraft(id, citizenSub)
  const normalized = validateFormData(request.service.form_fields, formData)
  const { error } = await supabaseAdmin().from('requests').update({ form_data: normalized }).eq('id', id).eq('citizen_sub', citizenSub).eq('status', 'draft')
  if (error) throw new Error(error.message)
  await recordEvent(id, 'citizen', 'form_saved', { fields: Object.keys(normalized) })
  return normalized
}

export function normalizeUploadedDocuments(value: unknown): UploadedDocument[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is UploadedDocument => Boolean(item && typeof item === 'object' && typeof (item as UploadedDocument).path === 'string'))
}

export async function addUploadedDocument(id: string, citizenSub: string, document: UploadedDocument) {
  const request = await ownedDraft(id, citizenSub)
  const documents = [...normalizeUploadedDocuments(request.uploaded_docs), document]
  const { error } = await supabaseAdmin().from('requests').update({ uploaded_docs: documents }).eq('id', id).eq('citizen_sub', citizenSub).eq('status', 'draft')
  if (error) throw new Error(error.message)
  await recordEvent(id, 'citizen', 'document_uploaded', { requirement: document.requirement, mime_type: document.mimeType, size: document.size })
  return documents
}

export async function submitDraft(id: string, citizenSub: string) {
  const request = await ownedDraft(id, citizenSub)
  if (!request.liveness_passed || !request.everify_reference) throw new Error('IDENTITY_REQUIRED')
  validateFormData(request.service.form_fields, request.form_data)
  const documents = normalizeUploadedDocuments(request.uploaded_docs)
  const missing = request.service.required_docs.filter((required) => !documents.some((document) => document.requirement === required))
  if (missing.length) throw new Error(`REQUIRED_DOCUMENT:${missing[0]}`)
  if (!['paid', 'waived'].includes(request.fee_status)) throw new Error('PAYMENT_REQUIRED')
  const { data, error } = await supabaseAdmin().from('requests').update({ status: 'submitted' }).eq('id', id).eq('citizen_sub', citizenSub).eq('status', 'draft').select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('SUBMISSION_CONFLICT')
  await recordEvent(id, 'citizen', 'submitted', { approval_office: request.service.approval_office })
  return { requestId: id, status: 'submitted' as const }
}
