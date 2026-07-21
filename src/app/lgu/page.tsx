import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getOfficerLguScope } from '@/lib/lgu-scope'

export const dynamic = 'force-dynamic'

export default async function LguEntryPage() {
  const session = await getSession()
  if (!session) redirect('/signin?next=/lgu')
  if (session.role !== 'officer') redirect('/')
  if (!session.lguId) redirect('/lgu/register')
  const scope = await getOfficerLguScope(session.lguId)
  redirect(scope.canonicalBase)
}
