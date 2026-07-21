export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getRequest, recordEvent } from '@/lib/data'
import { generateDocument } from '@/lib/pdf/generate'
import { anchorHash } from '@/lib/egov/chain'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * POST /api/issue
 *
 * Called by the officer approval flow. Accepts a request ID, generates the PDF,
 * anchors the hash on-chain, uploads to storage, and updates the request row.
 *
 * This is the step where "the officer retypes nothing" — all citizen data was
 * verified earlier, and now it just flows into the template.
 *
 * Body: { requestId: string }
 */
export async function POST(req: NextRequest) {
  let requestId: string
  try {
    const body = await req.json()
    requestId = body.requestId
    if (!requestId) throw new Error('requestId required')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const request = await getRequest(requestId).catch(() => null)
  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  if (request.status !== 'approved') {
    return NextResponse.json({ error: 'Request must be approved before issuance' }, { status: 422 })
  }

  // Mark as issued upfront so concurrent calls don't double-issue.
  const db = supabaseAdmin()
  const issuedAt = new Date().toISOString()
  await db.from('requests').update({ status: 'issued', issued_at: issuedAt }).eq('id', requestId)

  try {
    // 1. Generate the PDF (includes QR pointing to /verify/<requestId>).
    const { pdf, hash, controlNumber } = await generateDocument({
      ...request,
      issued_at: issuedAt,
    })

    // 2. Upload to Supabase Storage (bucket: documents).
    // Issued documents are immutable. A content-addressed path also prevents a
    // storage/CDN cache from returning bytes from an earlier issuance while the
    // request row already contains the newly generated hash.
    const storagePath = `${requestId}/${hash}.pdf`
    const { error: uploadError } = await db.storage
      .from('documents')
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      // Bucket may not exist yet — create it and retry once.
      if (/bucket not found|does not exist/i.test(uploadError.message)) {
        await db.storage.createBucket('documents', { public: false })
        const { error: retryError } = await db.storage
          .from('documents')
          .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true })
        if (retryError) throw new Error(`Storage upload failed: ${retryError.message}`)
      } else {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }
    }

    // 3. Anchor the hash on-chain (or local fallback).
    const anchorResult = await anchorHash(hash)

    // 4. Persist everything.
    await db
      .from('requests')
      .update({
        control_number: controlNumber,
        doc_hash: hash,
        chain_tx: anchorResult.data.txHash,
        pdf_path: storagePath,
      })
      .eq('id', requestId)

    await recordEvent(requestId, 'system', 'issued', {
      controlNumber,
      hash,
      chain_tx: anchorResult.data.txHash,
      onChain: anchorResult.data.onChain,
      source: anchorResult.source,
    })

    return NextResponse.json({
      ok: true,
      requestId,
      controlNumber,
      hash,
      chainTx: anchorResult.data.txHash,
      onChain: anchorResult.data.onChain,
      chainSource: anchorResult.source,
      pdfPath: storagePath,
      verifyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify/${requestId}`,
    })
  } catch (err) {
    // Roll back the optimistic issued status so the officer can retry.
    await db.from('requests').update({ status: 'approved' }).eq('id', requestId)
    const message = err instanceof Error ? err.message : String(err)
    console.error('[issue] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
