import { HarnessBanner } from './harness-banner'

/**
 * Everything under /implementation is a harness, not the product.
 *
 * The banner (see harness-banner.tsx) exists so nobody screen-records a harness
 * page thinking it's the real citizen flow — these routes are deliberately ugly
 * and show raw payloads. It hides itself on the full-page landing harness.
 */
export default function ImplementationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <HarnessBanner />
      {children}
    </div>
  )
}
