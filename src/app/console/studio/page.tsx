import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth/session'
import StudioClient from './studio-client'

export default async function StudioPage() {
  const officer = await requireRole('officer').catch(() => redirect('/signin?next=/console/studio'))
  if (!officer.lguId) redirect('/console/register')
  return <div className="space-y-6"><PageHeader eyebrow="Officer console" title="AI eService Studio" description="Draft inside DICT-approved bounds, inspect every field, then publish or route anomalies for review." /><StudioClient /></div>
}
