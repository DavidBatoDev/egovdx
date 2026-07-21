import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import './globals.css'
import { getSession } from '@/lib/auth/session'
import { Badge } from '@/components/ui'

export const metadata: Metadata = {
  title: 'eSee LGU — Configuration layer for eLGU',
  description:
    'Lets each LGU configure its own eServices within DICT-approved bounds — removing the configuration labor, not the oversight.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Reading the session here means every page gets the right nav without each
  // one having to ask. Cheap: it's a cookie read plus a JWT verify.
  const session = await getSession().catch(() => null)

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/*
         * Nav is Royal Blue with white text — the "eGovPH family" signal. DICT
         * and eGovPH marks come first as institutional endorsement, ahead of
         * the product wordmark, per esee_lgu_design_system.md "Logo Usage".
         * Both logos are mostly blue/dark artwork that disappears against
         * Royal Blue, so each sits on its own small white chip — the doc's
         * own suggested fix for the DICT seal, extended to eGovPH for the
         * same contrast reason. The source PNGs are never cropped or recolored.
         */}
        <header className="bg-surface-nav">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center rounded-sm bg-white px-1.5 py-1">
                <Image src="/brand/dict-logo.png" alt="DICT" width={32} height={32} />
              </span>
              <span className="flex items-center rounded-sm bg-white px-1.5 py-1">
                <Image src="/brand/egovph-logo.png" alt="eGovPH" width={98} height={28} />
              </span>
              <Link href="/" className="flex items-center gap-2 border-l border-white/25 pl-3">
                <span className="font-bold tracking-tight text-white">eSee LGU</span>
              </Link>
              <span className="hidden text-xs text-white/70 sm:inline">
                · Republic of the Philippines
              </span>
            </div>

            <nav className="flex items-center gap-1 text-sm">
              {session?.role === 'officer' ? (
                <Link
                  href="/console"
                  className="rounded-sm px-3 py-1.5 font-bold text-white hover:bg-white/10"
                >
                  Officer console
                </Link>
              ) : null}

              {session?.role === 'reviewer' ? (
                <Link
                  href="/review"
                  className="rounded-sm px-3 py-1.5 font-bold text-white hover:bg-white/10"
                >
                  DICT review
                </Link>
              ) : null}

              {session ? (
                <>
                  <span className="hidden items-center gap-2 px-2 sm:flex">
                    <span className="text-white/70">{session.name}</span>
                    <Badge tone="accent">{session.role}</Badge>
                  </span>
                  <a
                    href="/api/auth/egov/logout"
                    className="rounded-sm px-3 py-1.5 text-white/70 hover:bg-white/10"
                  >
                    Sign out
                  </a>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="rounded-sm border border-white bg-white px-3 py-1.5 font-bold text-brand hover:bg-brand-soft"
                >
                  Sign in with eGovPH
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="bg-surface-footer">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-white/60">
            DICT · eGovPH · eSee LGU — a DICT-funded configuration layer for eGovPH.
            Services publish only after automated validation, with flagged submissions
            routed to a human reviewer.
          </div>
        </footer>
      </body>
    </html>
  )
}
