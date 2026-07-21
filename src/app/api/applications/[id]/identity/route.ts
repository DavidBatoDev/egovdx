import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { verifyDraftIdentity } from '@/lib/citizen/applications'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const citizen = await requireRole('citizen')
    const { sessionId } = await req.json() as { sessionId?: string }
    if (!sessionId) throw new Error('LIVENESS_REQUIRED')
    return NextResponse.json(await verifyDraftIdentity((await params).id, citizen, sessionId))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 422 })
  }
}
