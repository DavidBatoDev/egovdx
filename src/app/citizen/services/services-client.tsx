'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Badge, ButtonLink, Card, CardBody, inputClass } from '@/components/ui'
import { peso } from '@/lib/format'

export type CitizenService = {
  id: string
  display_name: string | null
  fee_amount: number
  waivers: { category: string; label: string }[]
  required_docs: string[]
  template: { name: string; description: string | null }
}

export type CitizenLgu = {
  id: string
  name: string
  type: string
  services: CitizenService[]
}

export function ServicesClient({ lgus }: { lgus: CitizenLgu[] }) {
  const [view, setView] = useState<'home' | 'lgus' | 'services'>('home')
  const [selectedLguId, setSelectedLguId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const selectedLgu = lgus.find((lgu) => lgu.id === selectedLguId) ?? null
  const matchingLgus = lgus.filter((lgu) => lgu.name.toLowerCase().includes(query.trim().toLowerCase()))

  function openLgu(id: string) {
    setSelectedLguId(id)
    setView('services')
  }

  return (
    <div className="h-full">
      {view === 'home' ? <div className="relative h-full overflow-hidden bg-white"><Image src="/egov_UI.png" alt="eGovPH app home screen" fill priority sizes="430px" className="object-cover object-top" /><button type="button" onClick={() => setView('lgus')} className="absolute inset-x-5 bottom-8 z-20 flex items-center justify-between rounded-2xl bg-brand px-5 py-4 text-left text-white shadow-xl ring-4 ring-white"><span><span className="block text-lg font-bold">Open LGU services</span><span className="mt-0.5 block text-sm text-white/85">Find services from your city, municipality, or barangay</span></span><span className="text-2xl">→</span></button></div> : <div className="min-h-full p-5">

        {view === 'lgus' ? <div className="space-y-5"><button type="button" onClick={() => setView('home')} className="text-sm font-bold text-brand">← Home</button><div><p className="text-sm font-bold uppercase tracking-wide text-brand">LGUs</p><h2 className="mt-1 font-display text-3xl text-foreground">My local government</h2><p className="mt-2 text-sm text-muted">Search a city, municipality, or barangay to see whether services are available.</p></div><label className="relative block"><span className="sr-only">Search LGUs</span><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} h-11 rounded-xl pl-10`} placeholder="Search LGUs" /><span aria-hidden="true" className="absolute left-4 top-3 text-sm text-muted">⌕</span></label>{lgus.length ? matchingLgus.length ? <div className="space-y-3">{matchingLgus.map((lgu) => <button key={lgu.id} type="button" onClick={() => openLgu(lgu.id)} className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-border transition hover:ring-brand"><span><strong className="block text-foreground">{lgu.name}</strong><span className="mt-1 block text-sm text-muted">{lgu.type} · {lgu.services.length} available service{lgu.services.length === 1 ? '' : 's'}</span></span><span className="text-xl text-brand">›</span></button>)}</div> : <Card><CardBody><p className="text-sm text-muted">No published services found for “{query}”. Try another LGU.</p></CardBody></Card> : <Card><CardBody><p className="text-sm text-muted">There are no participating LGUs with published services yet.</p></CardBody></Card>}</div> : null}

        {view === 'services' && selectedLgu ? <div className="space-y-5"><button type="button" onClick={() => setView('lgus')} className="text-sm font-bold text-brand">← LGUs</button><div><p className="text-sm font-bold uppercase tracking-wide text-brand">{selectedLgu.type}</p><h2 className="mt-1 font-display text-3xl text-foreground">{selectedLgu.name}</h2><p className="mt-2 text-sm text-muted">Available eServices</p></div>{selectedLgu.services.length ? <div className="space-y-3">{selectedLgu.services.map((service) => <Card key={service.id} className="bg-white"><CardBody className="space-y-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-foreground">{service.display_name || service.template.name}</h3>{service.template.description ? <p className="mt-1 text-sm text-muted">{service.template.description}</p> : null}</div><Badge tone={service.fee_amount > 0 ? 'accent' : 'success'}>{service.fee_amount > 0 ? peso(service.fee_amount) : 'Free'}</Badge></div><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted">{service.required_docs.length} supporting document{service.required_docs.length === 1 ? '' : 's'} required</p><ButtonLink href={`/citizen/apply/${service.id}`}>Apply</ButtonLink></div></CardBody></Card>)}</div> : <Card className="rounded-xl bg-white"><CardBody className="py-10 text-center"><p className="font-semibold text-foreground">No eServices found</p><p className="mt-2 text-sm text-muted">This LGU has not published online services yet. Please check back later.</p></CardBody></Card>}</div> : null}
      </div>}
    </div>
  )
}
