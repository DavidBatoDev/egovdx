import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { submitDraft } from '@/lib/citizen/applications'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const citizen = await requireRole('citizen')
    return NextResponse.json(await submitDraft((await params).id, citizen.sub))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'SUBMISSION_CONFLICT' ? 409 : 422 })
  }
}
