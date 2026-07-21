import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getLguSiteEditorState, saveLguSiteDraft } from '@/lib/lgu-site/data'

export const runtime = 'nodejs'

function statusFor(message: string) {
  if (message === 'UNAUTHENTICATED') return 401
  if (message === 'FORBIDDEN') return 403
  if (message === 'CMS_REVISION_CONFLICT') return 409
  return 422
}

export async function GET() {
  try {
    const officer = await requireRole('officer')
    if (!officer.lguId) throw new Error('FORBIDDEN')
    return NextResponse.json(await getLguSiteEditorState(officer.lguId))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: statusFor(message) })
  }
}

export async function PUT(request: Request) {
  try {
    const officer = await requireRole('officer')
    if (!officer.lguId) throw new Error('FORBIDDEN')
    const body = await request.json() as { config?: unknown; expectedRevision?: unknown }
    if (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) throw new Error('INVALID_REVISION')
    const row = await saveLguSiteDraft(officer.lguId, officer.sub, body.config, Number(body.expectedRevision))
    return NextResponse.json({ config: row.draft_config, revision: row.draft_revision, publishedRevision: row.published_revision, publishedAt: row.published_at })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: statusFor(message) })
  }
}
