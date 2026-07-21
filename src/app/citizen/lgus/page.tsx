import Link from 'next/link'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { Badge, Card, CardBody, EmptyState, inputClass } from '@/components/ui'
import { listPublishedServices } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function LgusPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim().toLowerCase() ?? ''
  const services = await listPublishedServices()
  const groups = new Map<string, { id: string; name: string; count: number }>()
  for (const service of services) {
    groups.set(service.lgu.id, { id: service.lgu.id, name: service.lgu.name, count: (groups.get(service.lgu.id)?.count ?? 0) + 1 })
  }
  const lgus = [...groups.values()].filter((lgu) => !query || lgu.name.toLowerCase().includes(query))

  return <CitizenShell active="/citizen/lgus"><div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Explore</p><h1 className="mt-1 font-display text-3xl">Find your LGU</h1><p className="mt-2 text-sm text-muted">Select a local government to see available online services.</p></div><form className="relative"><input className={`${inputClass} h-11 rounded-xl pr-16`} name="q" defaultValue={query} placeholder="Search LGU" /><button className="absolute right-1 top-1 h-9 rounded-lg bg-brand px-3 text-sm font-bold text-white">Search</button></form>{lgus.length ? <div className="space-y-3">{lgus.map((lgu) => <Link key={lgu.id} href={`/citizen/lgus/${lgu.id}`} className="block"><Card className="rounded-xl bg-white hover:border-brand"><CardBody className="flex items-center justify-between gap-3 p-4"><div><strong>{lgu.name}</strong><p className="mt-1 text-sm text-muted">Local government services</p></div><Badge tone="brand">{lgu.count}</Badge></CardBody></Card></Link>)}</div> : <Card className="rounded-xl"><EmptyState title="No LGU found" description="Try another city, municipality, or barangay." /></Card>}</div></CitizenShell>
}
