import type { ReactNode } from 'react'
import { Tabs } from '@/components/ui'

const ITEMS = [{ href: '/citizen/services', label: 'Services' }, { href: '/citizen/lgus', label: 'LGUs' }, { href: '/citizen/requests', label: 'My requests' }]

export function CitizenShell({ active, children, wide = false }: { active: string; children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto overflow-hidden rounded-md border border-border bg-surface ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}><div className="bg-brand-soft px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-brand">eGovPH services</p><p className="font-display text-xl">Local government services</p></div><Tabs items={ITEMS} active={active} /><div className="space-y-6 p-4 sm:p-6">{children}</div></div>
}
