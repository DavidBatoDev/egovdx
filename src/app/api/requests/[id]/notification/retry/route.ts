import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { retryIssuedNotification } from '@/lib/issuance/workflow'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const officer = await requireRole('officer')
    const { id } = await ctx.params
    const body = (await req.json()) as { note?: string }
    return NextResponse.json(await retryIssuedNotification(id, officer.sub, body.note ?? ''))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : ['FORBIDDEN','WRONG_OFFICE'].includes(message) ? 403 : message === 'NOT_FOUND' ? 404 : 422
    return NextResponse.json({ error: message }, { status })
  }
}
