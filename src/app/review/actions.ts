'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function resolveFlag(form: FormData) {
  const reviewer = await requireRole('reviewer')
  const flagId = String(form.get('flagId') ?? '')
  const note = String(form.get('note') ?? '').trim()
  if (!flagId || !note) throw new Error('A resolution note is required')
  const { error } = await supabaseAdmin().from('validation_flags').update({
    resolved: true,
    resolution_note: note,
    resolved_by: reviewer.sub,
    resolved_at: new Date().toISOString(),
  }).eq('id', flagId).eq('resolved', false)
  if (error) throw error
  revalidatePath('/review')
}

export async function rejectService(form: FormData) {
  const reviewer = await requireRole('reviewer')
  const serviceId = String(form.get('serviceId') ?? '')
  const note = String(form.get('note') ?? '').trim()
  if (!serviceId || !note) throw new Error('A rejection note is required')
  const { error } = await supabaseAdmin().from('lgu_services').update({
    status: 'rejected',
    reviewed_by: reviewer.sub,
    reviewed_at: new Date().toISOString(),
  }).eq('id', serviceId).eq('status', 'flagged')
  if (error) throw error
  revalidatePath('/review')
}

export async function publishService(form: FormData) {
  const reviewer = await requireRole('reviewer')
  const serviceId = String(form.get('serviceId') ?? '')
  if (!serviceId) throw new Error('Service id is required')
  const { error } = await supabaseAdmin().rpc('publish_reviewed_service', {
    p_service_id: serviceId,
    p_reviewer: reviewer.sub,
  })
  if (error) throw error
  revalidatePath('/review')
}
