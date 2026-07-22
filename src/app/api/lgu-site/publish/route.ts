import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { publishLguSite } from '@/lib/lgu-site/data'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const officer = await requireRole('officer')
    if (!officer.lguId) throw new Error('FORBIDDEN')
    const body = await request.json() as { expectedRevision?: unknown }
    if (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) <= 0) throw new Error('INVALID_REVISION')
    const row = await publishLguSite(officer.lguId, officer.sub, Number(body.expectedRevision))
    revalidatePath(`/citizen/lgus/${officer.lguId}`)
    revalidatePath('/citizen/lgus')
    return NextResponse.json({ publishedRevision: row.published_revision, publishedAt: row.published_at })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'CMS_REVISION_CONFLICT' ? 409 : 422
    return NextResponse.json({ error: message }, { status })
  }
}
