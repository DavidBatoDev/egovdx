import 'server-only'
import { getRequest, recordEvent } from '@/lib/data'
import { anchorHash } from '@/lib/egov/chain'
import { issuedSmsBody, pushSms } from '@/lib/egov/emessage'
import { controlNumber } from '@/lib/format'
import { generateDocument } from '@/lib/pdf/generate'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { EgovSource } from '@/lib/egov/client'
import type { SmsStatus } from '@/lib/supabase/types'

export type ApprovalResult = {
  requestId: string
  status: 'approved' | 'issued'
  controlNumber: string
  verifyUrl: string
  chainSource: EgovSource
  smsStatus: Extract<SmsStatus, 'sent' | 'failed' | 'unknown'>
  smsSource: EgovSource | null
}

function verifyUrl(requestId: string) {
  return `${(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/verify/${requestId}`
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/[\r\n]+/g, ' ').slice(0, 300)
}

async function uploadPdf(requestId: string, hash: string, pdf: Uint8Array) {
  const db = supabaseAdmin()
  const path = `${requestId}/${hash}.pdf`
  let { error } = await db.storage.from('documents').upload(path, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error && /bucket not found|does not exist/i.test(error.message)) {
    await db.storage.createBucket('documents', { public: false })
    ;({ error } = await db.storage.from('documents').upload(path, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    }))
  }
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return path
}

async function sendIssuedNotification(requestId: string, actor: string, retryNote?: string) {
  const request = await getRequest(requestId)
  if (!request || request.status !== 'issued' || !request.control_number) throw new Error('NOT_ISSUED')
  if (request.sms_status === 'sent') return { status: 'sent' as const, source: request.sms_source }
  if (!request.citizen_mobile) {
    await supabaseAdmin().from('requests').update({ sms_status: 'failed', sms_error: 'No citizen mobile number.' }).eq('id', requestId)
    return { status: 'failed' as const, source: null }
  }

  await supabaseAdmin().from('requests').update({ sms_status: 'sending', sms_error: null }).eq('id', requestId)
  try {
    const result = await pushSms(
      request.citizen_mobile,
      issuedSmsBody(request.service.template.name, request.control_number, verifyUrl(requestId)),
    )
    const sent = result.data.accepted
    await supabaseAdmin().from('requests').update({
      sms_status: sent ? 'sent' : 'failed',
      sms_source: result.source,
      sms_message_id: result.data.messageId,
      sms_sent_at: sent ? new Date().toISOString() : null,
      sms_error: sent ? null : 'Provider did not accept the notification.',
    }).eq('id', requestId)
    await recordEvent(requestId, actor, retryNote ? 'notification_retried' : 'notification_sent', {
      accepted: sent,
      source: result.source,
      message_id: result.data.messageId,
      retry_note: retryNote,
    })
    return { status: sent ? 'sent' as const : 'failed' as const, source: result.source }
  } catch (error) {
    const message = safeError(error)
    await supabaseAdmin().from('requests').update({ sms_status: 'unknown', sms_error: message }).eq('id', requestId)
    await recordEvent(requestId, actor, 'notification_unknown', { error: message, retry_note: retryNote })
    return { status: 'unknown' as const, source: null }
  }
}

export async function approveAndIssue(requestId: string, officerSub: string): Promise<ApprovalResult> {
  const db = supabaseAdmin()
  const { data: claim, error: claimError } = await db.rpc('claim_request_approval', {
    p_request_id: requestId,
    p_officer_sub: officerSub,
  }).single()
  if (claimError) throw new Error(claimError.message)

  let request = await getRequest(requestId)
  if (!request) throw new Error('NOT_FOUND')
  if (!claim.claimed) {
    if (claim.reason === 'ALREADY_ISSUED' && request.control_number) {
      return {
        requestId,
        status: 'issued',
        controlNumber: request.control_number,
        verifyUrl: verifyUrl(requestId),
        chainSource: request.chain_source ?? 'fallback',
        smsStatus: request.sms_status === 'sent' ? 'sent' : request.sms_status === 'unknown' ? 'unknown' : 'failed',
        smsSource: request.sms_source,
      }
    }
    throw new Error(claim.reason)
  }

  try {
    if (!request.control_number) {
      if (claim.sequence_value == null) throw new Error('Control sequence was not allocated')
      const assigned = controlNumber(request.service.template.code, claim.sequence_value)
      const { error } = await db.from('requests').update({ control_number: assigned }).eq('id', requestId)
      if (error) throw new Error(error.message)
      request = (await getRequest(requestId))!
    }
    await recordEvent(requestId, `officer:${officerSub}`, 'approved', {
      approval_office: request.service.approval_office,
      control_number: request.control_number,
    })

    if (!request.doc_hash || !request.pdf_path) {
      const document = await generateDocument(request)
      const path = await uploadPdf(requestId, document.hash, document.pdf)
      const { error } = await db.from('requests').update({
        control_number: document.controlNumber,
        doc_hash: document.hash,
        pdf_path: path,
      }).eq('id', requestId)
      if (error) throw new Error(error.message)
      await recordEvent(requestId, 'system', 'document_generated', {
        control_number: document.controlNumber,
        hash: document.hash,
      })
      request = (await getRequest(requestId))!
    }

    if (!request.chain_tx) {
      const anchor = await anchorHash(request.doc_hash!)
      const { error } = await db.from('requests').update({
        chain_tx: anchor.data.txHash,
        chain_source: anchor.source,
      }).eq('id', requestId)
      if (error) throw new Error(error.message)
      await recordEvent(requestId, 'system', anchor.data.onChain ? 'hash_anchored' : 'hash_unanchored', {
        transaction: anchor.data.txHash,
        source: anchor.source,
      })
      request = (await getRequest(requestId))!
    }

    const issuedAt = request.issued_at ?? new Date().toISOString()
    const { error: issuedError } = await db.from('requests').update({
      status: 'issued',
      issued_at: issuedAt,
      issuance_status: 'issued',
      issuance_error: null,
    }).eq('id', requestId)
    if (issuedError) throw new Error(issuedError.message)
    await recordEvent(requestId, 'system', 'issued', {
      control_number: request.control_number,
      chain_source: request.chain_source,
    })
  } catch (error) {
    const message = safeError(error)
    await db.from('requests').update({ issuance_status: 'failed', issuance_error: message, status: 'approved' }).eq('id', requestId)
    await recordEvent(requestId, 'system', 'issuance_failed', { error: message })
    throw error
  }

  const sms = await sendIssuedNotification(requestId, 'system')
  const final = await getRequest(requestId)
  if (!final?.control_number) throw new Error('ISSUANCE_INCOMPLETE')
  return {
    requestId,
    status: 'issued',
    controlNumber: final.control_number,
    verifyUrl: verifyUrl(requestId),
    chainSource: final.chain_source ?? 'fallback',
    smsStatus: sms.status,
    smsSource: sms.source,
  }
}

export async function retryIssuedNotification(requestId: string, officerSub: string, note: string) {
  if (!note.trim()) throw new Error('NOTE_REQUIRED')
  const request = await getRequest(requestId)
  if (!request) throw new Error('NOT_FOUND')
  const { data: officer } = await supabaseAdmin().from('officers').select('lgu_id, office').eq('egov_sub', officerSub).eq('role', 'officer').maybeSingle()
  if (!officer || officer.lgu_id !== request.service.lgu_id) throw new Error('FORBIDDEN')
  if (officer.office && officer.office.toLowerCase() !== (request.service.approval_office ?? '').toLowerCase()) throw new Error('WRONG_OFFICE')
  if (!['failed', 'unknown'].includes(request.sms_status)) throw new Error('NOT_RETRYABLE')
  return sendIssuedNotification(requestId, `officer:${officerSub}`, note.trim())
}

