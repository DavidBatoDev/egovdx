import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getRequest } from '@/lib/data'
import { normalizeUploadedDocuments } from '@/lib/citizen/applications'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  const { id, index } = await params
  const request = await getRequest(id); if (!request) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const allowed = (session.role === 'citizen' && request.citizen_sub === session.sub) || session.role === 'reviewer' || (session.role === 'officer' && request.service.lgu_id === session.lguId)
  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const document = normalizeUploadedDocuments(request.uploaded_docs)[Number(index)]
  if (!document) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const { data, error } = await supabaseAdmin().storage.from('application-documents').download(document.path)
  if (error || !data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return new NextResponse(data, { headers: { 'Content-Type': document.mimeType, 'Content-Disposition': `inline; filename="${document.filename.replace(/["\r\n]/g, '_')}"`, 'Cache-Control': 'private, no-store' } })
}
