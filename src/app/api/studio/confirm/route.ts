import { requireRole } from '@/lib/auth/session'
import { parseGeneratedService } from '@/lib/studio/schema'
import { saveGeneratedService } from '@/lib/studio/persistence'
import { createHash, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let uploadedPath: string | null = null
  try {
    const session = await requireRole('officer')
    if (!session.lguId) return Response.json({ error: 'Officer is not assigned to an LGU' }, { status: 403 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'Upload the official PDF or DOCX template' }, { status: 400 })
    const allowed = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    if (!allowed.has(file.type)) return Response.json({ error: 'Only PDF and DOCX templates are supported' }, { status: 415 })
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: 'Template must be 4 MB or smaller' }, { status: 413 })
    const fileBytes = Buffer.from(await file.arrayBuffer())
    const expectedTemplateHash = String(form.get('expectedTemplateHash') ?? '')
    if (expectedTemplateHash && !/^[a-f0-9]{64}$/.test(expectedTemplateHash)) return Response.json({ error: 'Invalid analyzed template hash' }, { status: 400 })
    if (expectedTemplateHash && createHash('sha256').update(fileBytes).digest('hex') !== expectedTemplateHash) {
      return Response.json({ error: 'The attached template changed. Analyze this file again before submitting.' }, { status: 400 })
    }
    const service = parseGeneratedService(JSON.parse(String(form.get('service') ?? '{}')))
    const extension = file.type === 'application/pdf' ? 'pdf' : 'docx'
    uploadedPath = `${session.lguId}/${randomUUID()}.${extension}`
    const db = supabaseAdmin()
    let { error: uploadError } = await db.storage.from('service-templates').upload(uploadedPath, fileBytes, { contentType: file.type, upsert: false })
    if (uploadError && /bucket not found|does not exist/i.test(uploadError.message)) {
      await db.storage.createBucket('service-templates', { public: false, fileSizeLimit: 4 * 1024 * 1024, allowedMimeTypes: [...allowed] })
      ;({ error: uploadError } = await db.storage.from('service-templates').upload(uploadedPath, fileBytes, { contentType: file.type, upsert: false }))
    }
    if (uploadError) throw uploadError
    const saved = await saveGeneratedService({
      lguId: session.lguId,
      service,
      generation: { engine: String(form.get('engine') ?? 'manual'), model: String(form.get('model') ?? 'officer-entry') },
      sourcePrompt: form.get('sourcePrompt') ? String(form.get('sourcePrompt')) : null,
      generatedBy: form.get('generatedBy') === 'manual' ? 'manual' : form.get('generatedBy') === 'upload' ? 'upload' : 'ai',
      docTemplatePath: uploadedPath,
      supersedesServiceId: form.get('supersedesServiceId') ? String(form.get('supersedesServiceId')) : null,
    })
    return Response.json(saved)
  } catch (error) {
    if (uploadedPath) await supabaseAdmin().storage.from('service-templates').remove([uploadedPath]).catch(() => undefined)
    const message = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return Response.json({ error: message }, { status })
  }
}
