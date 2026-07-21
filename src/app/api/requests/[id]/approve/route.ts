export const runtime = 'nodejs'

import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { approveAndIssue } from '@/lib/issuance/workflow'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const officer = await requireRole('officer')
    const { id } = await ctx.params
    return NextResponse.json(await approveAndIssue(id, officer.sub))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : ['FORBIDDEN','WRONG_LGU','WRONG_OFFICE'].includes(message) ? 403 : message === 'NOT_FOUND' ? 404 : ['PAYMENT_REQUIRED','LIVENESS_REQUIRED','NOT_APPROVABLE','IN_PROGRESS'].includes(message) ? 422 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
