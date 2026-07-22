import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { publicLguMediaUrl } from '@/lib/lgu-site/schema'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
const MAX_FILE = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

function validSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return bytes.slice(0, 8).every((value, index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index])
  return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
}

export async function POST(request: Request) {
  try {
    const officer = await requireRole('officer')
    if (!officer.lguId) throw new Error('FORBIDDEN')
    const form = await request.formData()
    const file = form.get('file')
    const kind = form.get('kind') === 'logo' ? 'logo' : form.get('kind') === 'banner' ? 'banner' : null
    if (!(file instanceof File) || !kind) throw new Error('FILE_REQUIRED')
    if (!ALLOWED.has(file.type)) throw new Error('UNSUPPORTED_FILE_TYPE')
    if (file.size <= 0 || file.size > MAX_FILE) throw new Error('FILE_TOO_LARGE')
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!validSignature(bytes, file.type)) throw new Error('INVALID_IMAGE_FILE')
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const path = `${officer.lguId}/${randomUUID()}.${ext}`
    const db = supabaseAdmin()
    let { error } = await db.storage.from('lgu-site-media').upload(path, bytes, { contentType: file.type, upsert: false })
    if (error && /bucket not found|does not exist/i.test(error.message)) {
      await db.storage.createBucket('lgu-site-media', { public: true, fileSizeLimit: MAX_FILE, allowedMimeTypes: [...ALLOWED] })
      ;({ error } = await db.storage.from('lgu-site-media').upload(path, bytes, { contentType: file.type, upsert: false }))
    }
    if (error) throw new Error(`UPLOAD_FAILED:${error.message}`)
    const { data: media, error: mediaError } = await db.from('lgu_site_media').insert({
      lgu_id: officer.lguId, storage_path: path, kind, mime_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      size_bytes: file.size, original_name: file.name.slice(0, 160), created_by: officer.sub,
    }).select('*').single()
    if (mediaError) {
      await db.storage.from('lgu-site-media').remove([path])
      throw new Error(mediaError.message)
    }
    return NextResponse.json({ media, url: publicLguMediaUrl(path) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 422 })
  }
}
