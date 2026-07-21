import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getOrCreateDraft } from '@/lib/citizen/applications'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const citizen = await requireRole('citizen')
    const { serviceId } = await req.json() as { serviceId?: string }
    if (!serviceId) throw new Error('SERVICE_REQUIRED')
    const draft = await getOrCreateDraft(serviceId, citizen)
    return NextResponse.json({ requestId: draft.id, status: draft.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : message === 'SERVICE_NOT_AVAILABLE' ? 404 : 422 })
  }
}
