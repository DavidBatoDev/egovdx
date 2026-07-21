import { NextResponse, type NextRequest } from 'next/server'
import {
  createLivenessSession,
  type CreateLivenessSessionOptions,
  type LivenessAction,
} from '@/lib/egov/liveness'

export const runtime = 'nodejs'

const ACTIONS = new Set<LivenessAction>(['redirect', 'post', 'close'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!isRecord(body) || !ACTIONS.has(body.action as LivenessAction)) {
    return NextResponse.json({ error: 'action must be redirect, post, or close' }, { status: 400 })
  }

  const options: CreateLivenessSessionOptions = {
    action: body.action as LivenessAction,
    ...(typeof body.callback_url === 'string' ? { callbackUrl: body.callback_url } : {}),
    ...(typeof body.delay === 'number' ? { delay: body.delay } : {}),
  }

  try {
    return NextResponse.json(await createLivenessSession(options))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create liveness session'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
