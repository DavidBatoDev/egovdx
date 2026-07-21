import { requireRole } from '@/lib/auth/session'
import { continueServiceInterview } from '@/lib/studio/interview'
import { emptyInterviewDraft, interviewDraftSchema, interviewMessageSchema } from '@/lib/studio/interview-schema'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await requireRole('officer')
    if (!session.lguId) return Response.json({ error: 'Officer is not assigned to an LGU' }, { status: 403 })
    const body = await request.json()
    const turn = await continueServiceInterview({
      messages: interviewMessageSchema.array().parse(body.messages ?? []),
      draft: interviewDraftSchema.parse(body.draft ?? emptyInterviewDraft),
      coveredTopics: Array.isArray(body.coveredTopics) ? body.coveredTopics.map(String) : [],
    })
    return Response.json(turn)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return Response.json({ error: message }, { status })
  }
}
