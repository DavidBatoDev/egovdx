import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { saveDraftForm } from '@/lib/citizen/applications'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const citizen = await requireRole('citizen')
    const { formData } = await req.json() as { formData?: unknown }
    return NextResponse.json({ formData: await saveDraftForm((await params).id, citizen.sub, formData) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 422 })
  }
}
