import { createHash, randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { addUploadedDocument, normalizeUploadedDocuments, ownedDraft } from '@/lib/citizen/applications'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { UploadedDocument } from '@/lib/supabase/types'

export const runtime = 'nodejs'
const ALLOWED = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const MAX_FILE = 4 * 1024 * 1024
const MAX_TOTAL = 12 * 1024 * 1024

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const citizen = await requireRole('citizen')
    const id = (await params).id
    const draft = await ownedDraft(id, citizen.sub)
    const form = await req.formData()
    const file = form.get('file')
    const requirement = String(form.get('requirement') ?? '').trim()
    if (!(file instanceof File)) throw new Error('FILE_REQUIRED')
    if (!draft.service.required_docs.includes(requirement)) throw new Error('INVALID_REQUIREMENT')
    if (!ALLOWED.has(file.type)) throw new Error('UNSUPPORTED_FILE_TYPE')
    if (file.size <= 0 || file.size > MAX_FILE) throw new Error('FILE_TOO_LARGE')
    const existing = normalizeUploadedDocuments(draft.uploaded_docs)
    if (existing.reduce((sum, item) => sum + item.size, 0) + file.size > MAX_TOTAL) throw new Error('TOTAL_UPLOAD_TOO_LARGE')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const citizenKey = createHash('sha256').update(citizen.sub).digest('hex').slice(0, 16)
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${citizenKey}/${id}/${randomUUID()}.${ext}`
    const db = supabaseAdmin()
    let { error } = await db.storage.from('application-documents').upload(path, bytes, { contentType: file.type, upsert: false })
    if (error && /bucket not found|does not exist/i.test(error.message)) {
      await db.storage.createBucket('application-documents', { public: false, fileSizeLimit: MAX_FILE, allowedMimeTypes: [...ALLOWED] })
      ;({ error } = await db.storage.from('application-documents').upload(path, bytes, { contentType: file.type, upsert: false }))
    }
    if (error) throw new Error(`UPLOAD_FAILED:${error.message}`)
    const document: UploadedDocument = { path, requirement, filename: file.name.slice(0, 160), mimeType: file.type as UploadedDocument['mimeType'], size: file.size }
    try {
      return NextResponse.json({ documents: await addUploadedDocument(id, citizen.sub, document), document })
    } catch (error) {
      await db.storage.from('application-documents').remove([path])
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 422 })
  }
}
