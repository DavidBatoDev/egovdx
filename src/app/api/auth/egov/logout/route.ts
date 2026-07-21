import { NextResponse, type NextRequest } from 'next/server'
import { clearSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  await clearSession()
  return NextResponse.redirect(new URL('/', req.nextUrl.origin))
}
