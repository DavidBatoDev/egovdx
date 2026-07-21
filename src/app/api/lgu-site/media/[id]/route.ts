import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { configReferencesPath } from '@/lib/lgu-site/data'
import { parseLguSiteConfig } from '@/lib/lgu-site/schema'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const officer = await requireRole('officer')
    if (!officer.lguId) throw new Error('FORBIDDEN')
    const db = supabaseAdmin()
    const { data: media, error } = await db.from('lgu_site_media').select('*').eq('id', (await params).id).eq('lgu_id', officer.lguId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!media) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    const { data: row } = await db.from('lgu_site_configs').select('draft_config,published_config').eq('lgu_id', officer.lguId).maybeSingle()
    const draft = row?.draft_config ? parseLguSiteConfig(row.draft_config) : null
    const published = row?.published_config ? parseLguSiteConfig(row.published_config) : null
    if (configReferencesPath(draft, media.storage_path) || configReferencesPath(published, media.storage_path)) {
      return NextResponse.json({ error: 'MEDIA_IN_USE' }, { status: 409 })
    }
    const { error: storageError } = await db.storage.from('lgu-site-media').remove([media.storage_path])
    if (storageError) throw new Error(storageError.message)
    await db.from('lgu_site_media').delete().eq('id', media.id).eq('lgu_id', officer.lguId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 422 })
  }
}
