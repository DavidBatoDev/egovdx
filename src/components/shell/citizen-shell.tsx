import type { ReactNode } from 'react'
import { Tabs } from '@/components/ui'

const ITEMS = [
  { href: '/citizen/services', label: 'Services' },
  { href: '/citizen/lgus', label: 'LGUs' },
  { href: '/citizen/requests', label: 'My requests' },
]

/**
 * Citizen transactions use the native eGovPH mobile frame. Published LGU
 * websites can opt into the wide surface because they are full public pages,
 * while immersive screens supply their own navigation and scrolling.
 */
export function CitizenShell({
  active,
  children,
  immersive = false,
  wide = false,
}: {
  active: string
  children: ReactNode
  immersive?: boolean
  wide?: boolean
}) {
  if (wide) {
    return <div className="mx-auto max-w-6xl overflow-hidden rounded-md border border-border bg-surface"><div className="bg-brand-soft px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-brand">eGovPH services</p><p className="font-display text-xl">Local government services</p></div><Tabs items={ITEMS} active={active} /><div className="space-y-6 p-4 sm:p-6">{children}</div></div>
  }

  return (
    <div className="mx-auto w-full max-w-[430px] rounded-[2.5rem] border-[8px] border-slate-950 bg-slate-950 p-1 shadow-2xl">
      <div className="relative h-[860px] overflow-hidden rounded-[2rem] bg-surface">
        {immersive ? children : <><div aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-slate-950" /><div className="bg-brand px-5 pb-4 pt-9 text-white"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">eGovPH</p><span className="text-xs font-semibold text-white/75">● Secure</span></div><p className="mt-1 font-display text-xl">Local government services</p></div><Tabs items={ITEMS} active={active} /><div className="h-[calc(100%-8.75rem)] overflow-y-auto overscroll-contain p-4 pb-8">{children}</div></>}
      </div>
    </div>
  )
}
