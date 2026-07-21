import { NextResponse, type NextRequest } from 'next/server'
import { getLivenessResult } from '@/lib/egov/liveness'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> },
) {
  const { sessionToken } = await params
  if (!sessionToken) {
    return NextResponse.json({ error: 'session token is required' }, { status: 400 })
  }

  return NextResponse.json(await getLivenessResult(sessionToken))
}
