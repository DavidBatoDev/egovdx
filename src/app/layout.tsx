import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import './globals.css'
import { getSession } from '@/lib/auth/session'
import { Badge, SourceBadge } from '@/components/ui'

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
         * White nav with a bottom hairline. DICT and eGovPH marks come first as
         * institutional endorsement, ahead of the product wordmark, per
         * esee_lgu_design_system.md "Logo Usage". Both logos sit directly on the
         * white bar; the source PNGs are never cropped or recolored.
         */}
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3">
              <Image src="/brand/dict-logo.png" alt="DICT" width={32} height={32} />
              <Image src="/brand/egovph-logo.png" alt="eGovPH" width={98} height={28} />
              <Link href="/" className="flex items-center gap-2 border-l border-border pl-3">
                <span className="font-bold tracking-tight text-brand">eSee LGU</span>
              </Link>
              <span className="hidden text-xs text-muted sm:inline">
                · Republic of the Philippines
              </span>
            </div>

            <nav className="flex items-center gap-1 text-sm">
              {session?.role === 'officer' ? (
                <Link
                  href="/console"
                  className="rounded-sm px-3 py-1.5 font-bold text-brand hover:bg-brand-soft"
                >
                  Officer console
                </Link>
              ) : null}

              {session?.role === 'reviewer' ? (
                <Link
                  href="/review"
                  className="rounded-sm px-3 py-1.5 font-bold text-brand hover:bg-brand-soft"
                >
                  DICT review
                </Link>
              ) : null}

              {session ? (
                <>
                  <span className="hidden items-center gap-2 px-2 sm:flex">
                    <span className="text-muted">{session.name}</span>
                    <Badge tone="brand">{session.role}</Badge>
                    {session.ssoSource ? <SourceBadge source={session.ssoSource} /> : null}
                  </span>
                  <a
                    href="/api/auth/egov/logout"
                    className="rounded-sm px-3 py-1.5 text-muted hover:bg-brand-soft"
                  >
                    Sign out
                  </a>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="rounded-sm bg-brand px-3 py-1.5 font-bold text-white hover:bg-brand-hover"
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
