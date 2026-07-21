import { LandingPage } from '@/components/landing/landing-page'

export const metadata = { title: 'Landing page — implementation harness' }

/**
 * Harness for the marketing landing page.
 *
 * A landing page is pure presentation, so unlike a data harness there is
 * nothing to trigger or dump — the composition lives in
 * src/components/landing/landing-page.tsx and this page just renders it. That
 * keeps unification a one-import move: drop <LandingPage /> onto a real route.
 */
export default function LandingHarness() {
  return <LandingPage />
}
