import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { searchPsgc } from '@/lib/psgc'

export async function GET(req: NextRequest) {
  try {
    await requireRole('officer')
    return NextResponse.json({ data: await searchPsgc(req.nextUrl.searchParams.get('q') ?? '') })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'PSA lookup failed.' : message }, { status })
  }
}
