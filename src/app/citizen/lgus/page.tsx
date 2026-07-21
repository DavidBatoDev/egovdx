import Link from 'next/link'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { Badge, Card, CardBody, EmptyState, PageHeader, inputClass } from '@/components/ui'
import { listPublishedServices } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function LgusPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim().toLowerCase() ?? ''
  const services = await listPublishedServices()
  const groups = new Map<string, { id: string; name: string; count: number }>()
  for (const service of services) groups.set(service.lgu.id, { id: service.lgu.id, name: service.lgu.name, count: (groups.get(service.lgu.id)?.count ?? 0) + 1 })
  const lgus = [...groups.values()].filter((lgu) => !query || lgu.name.toLowerCase().includes(query))
  return <CitizenShell active="/citizen/lgus"><PageHeader eyebrow="LGUs" title="Find your local government" description="Published services appear here immediately—no app release or redeployment." /><form className="flex gap-2"><input className={inputClass} name="q" defaultValue={query} placeholder="Search city, municipality, or barangay" /><button className="rounded-sm bg-brand px-4 font-bold text-white">Search</button></form>{lgus.length ? <div className="grid gap-3 sm:grid-cols-2">{lgus.map((lgu) => <Link key={lgu.id} href={`/citizen/lgus/${lgu.id}`}><Card className="h-full hover:border-brand"><CardBody><div className="flex items-center justify-between gap-3"><strong>{lgu.name}</strong><Badge tone="brand">{lgu.count} service{lgu.count === 1 ? '' : 's'}</Badge></div></CardBody></Card></Link>)}</div> : <Card><EmptyState title="No LGU found" description="Try another locality name." /></Card>}</CitizenShell>
}
