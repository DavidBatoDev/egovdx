'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui'

/**
 * The dev-harness banner, shown above every /implementation/<slug> test rig so
 * nobody mistakes a raw harness for the real app.
 *
 * The landing harness is the exception: it's a full marketing page, not a test
 * rig, so the banner is only noise there. Hidden on that route, kept on the rest.
 */
const HIDE_ON = ['/implementation/landing']

export function HarnessBanner() {
  const pathname = usePathname()
  if (HIDE_ON.includes(pathname)) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3">
      <Badge tone="accent">Implementation harness</Badge>
      <p className="text-sm text-accent">
        Development surface for building and testing one feature in isolation. Not the
        citizen-facing app — that lives at{' '}
        <Link href="/" className="font-medium underline">
          /
        </Link>
        .
      </p>
      <Link
        href="/implementation"
        className="ml-auto text-sm font-medium text-accent underline"
      >
        All features
      </Link>
    </div>
  )
}
