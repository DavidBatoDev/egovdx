import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { reconcileRequestPayment, startRequestPayment } from '@/lib/payments/workflow'

function statusFor(message: string) {
  if (message === 'UNAUTHENTICATED') return 401
  if (message === 'FORBIDDEN') return 403
  if (message === 'NOT_FOUND') return 404
  if (message === 'PAYMENT_IN_PROGRESS') return 409
  if (['INVALID_WAIVER', 'NOT_PAYABLE', 'PAYMENT_AMOUNT_MISMATCH'].includes(message)) return 422
  return 500
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const citizen = await requireRole('citizen')
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { waiverCategory?: string }
    return NextResponse.json(await startRequestPayment(id, citizen.sub, body.waiverCategory))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: statusFor(message) })
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const citizen = await requireRole('citizen')
    const { id } = await ctx.params
    return NextResponse.json(await reconcileRequestPayment(id, citizen.sub))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: statusFor(message) })
  }
}
