export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getRequest } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/issue/download?id=<requestId>
 * Returns the issued PDF from Supabase Storage.
 * Serves the exact bytes that were hashed at issuance — no regeneration.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const request = await getRequest(id).catch(() => null)
  if (!request || request.status !== 'issued' || !request.pdf_path) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db.storage.from('documents').download(request.pdf_path)
  if (error || !data) {
    return NextResponse.json({ error: 'Could not retrieve document from storage' }, { status: 503 })
  }

  const bytes = new Uint8Array(await data.arrayBuffer())
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${request.control_number ?? id}.pdf"`,
    },
  })
}
