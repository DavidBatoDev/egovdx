import { requireRole } from '@/lib/auth/session'
import { extractDocument, tokenCredits } from '@/lib/egov/ai'
import { generateServiceFromExtraction } from '@/lib/studio/generate'
import { validateGeneratedService } from '@/lib/studio/persistence'

export const runtime = 'nodejs'
const MAX_FILE_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])

export async function POST(request: Request) {
  try {
    const session = await requireRole('officer')
    if (!session.lguId) return Response.json({ error: 'Officer is not assigned to an LGU' }, { status: 403 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'Choose a file to upload' }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: 'Only JPEG, PNG, and PDF files are supported' }, { status: 415 })
    if (file.size > MAX_FILE_BYTES) return Response.json({ error: 'File must be 4 MB or smaller' }, { status: 413 })
    const extraction = await extractDocument(file, file.name)
    const generation = await generateServiceFromExtraction(extraction.data, session.lguId)
    const [{ template, flags }, credits] = await Promise.all([
      validateGeneratedService(generation.data),
      tokenCredits(),
    ])
    return Response.json({ extraction, generation, template, flags, credits: credits.data.remaining })
  } catch (error) {
    const message = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return Response.json({ error: message }, { status })
  }
}
