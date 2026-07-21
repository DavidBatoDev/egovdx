import { requireRole } from '@/lib/auth/session'
import { parseGeneratedService } from '@/lib/studio/schema'
import { saveGeneratedService } from '@/lib/studio/persistence'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await requireRole('officer')
    if (!session.lguId) return Response.json({ error: 'Officer is not assigned to an LGU' }, { status: 403 })
    const body = await request.json()
    const service = parseGeneratedService(body.service)
    const saved = await saveGeneratedService({
      lguId: session.lguId,
      service,
      generation: { engine: body.engine, model: String(body.model) },
      sourcePrompt: body.sourcePrompt ? String(body.sourcePrompt) : null,
      generatedBy: body.generatedBy === 'upload' ? 'upload' : 'ai',
    })
    return Response.json(saved)
  } catch (error) {
    const message = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return Response.json({ error: message }, { status })
  }
}
