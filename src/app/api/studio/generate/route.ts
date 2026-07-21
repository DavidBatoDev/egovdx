import { requireRole } from '@/lib/auth/session'
import { tokenCredits } from '@/lib/egov/ai'
import { generateService } from '@/lib/studio/generate'
import { validateGeneratedService } from '@/lib/studio/persistence'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await requireRole('officer')
    if (!session.lguId) return Response.json({ error: 'Officer is not assigned to an LGU' }, { status: 403 })
    const { prompt } = await request.json()
    const generation = await generateService(String(prompt ?? ''), session.lguId)
    const [{ template, flags }, credits] = await Promise.all([
      validateGeneratedService(generation.data),
      tokenCredits(),
    ])
    return Response.json({ generation, template, flags, credits: credits.data.remaining })
  } catch (error) {
    const message = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return Response.json({ error: message }, { status })
  }
}
