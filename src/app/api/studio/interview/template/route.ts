import { requireRole } from '@/lib/auth/session'
import {
  emptyInterviewDraft,
  interviewDraftSchema,
  interviewMessageSchema,
} from '@/lib/studio/interview-schema'
import { processTemplateAttachment } from '@/lib/studio/template-tool'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export async function POST(request: Request) {
  try {
    const session = await requireRole('officer')
    if (!session.lguId) return Response.json({ error: 'Officer is not assigned to an LGU' }, { status: 403 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'Choose a PDF or DOCX template' }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: 'Only DOCX and PDF templates are supported' }, { status: 415 })
    if (file.size > MAX_FILE_BYTES) return Response.json({ error: 'File must be 4 MB or smaller' }, { status: 413 })

    const rawState = JSON.parse(String(form.get('state') ?? '{}'))
    const messages = interviewMessageSchema.array().max(30).parse(rawState.messages ?? [])
    const draft = interviewDraftSchema.parse(rawState.draft ?? emptyInterviewDraft)
    const coveredTopics = Array.isArray(rawState.coveredTopics) ? rawState.coveredTopics.map(String) : []
    const turn = await processTemplateAttachment({ file, lguId: session.lguId, messages, draft, coveredTopics })
    return Response.json(turn)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return Response.json({ error: message }, { status })
  }
}
