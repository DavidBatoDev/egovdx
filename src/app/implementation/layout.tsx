import Link from 'next/link'
import { Badge } from '@/components/ui'

/**
 * Everything under /implementation is a harness, not the product.
 *
 * The banner exists so nobody screen-records a harness page thinking it's the
 * real citizen flow — these routes are deliberately ugly and show raw payloads.
 */
export default function ImplementationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
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

      {children}
    </div>
  )
}
