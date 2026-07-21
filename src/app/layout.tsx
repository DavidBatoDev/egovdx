import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { getSession } from '@/lib/auth/session'
import { Badge } from '@/components/ui'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'eGovDX Local — Configuration layer for eLGU',
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
                DX
              </span>
              <span className="font-semibold tracking-tight">eGovDX Local</span>
              <span className="hidden text-xs text-muted sm:inline">
                · Republic of the Philippines
              </span>
            </Link>

            <nav className="flex items-center gap-1 text-sm">
              {session?.role === 'officer' ? (
                <Link
                  href="/console"
                  className="rounded-lg px-3 py-1.5 font-medium text-brand hover:bg-brand-soft"
                >
                  Officer console
                </Link>
              ) : null}

              {session?.role === 'reviewer' ? (
                <Link
                  href="/review"
                  className="rounded-lg px-3 py-1.5 font-medium text-brand hover:bg-brand-soft"
                >
                  DICT review
                </Link>
              ) : null}

              {session ? (
                <>
                  <span className="hidden items-center gap-2 px-2 sm:flex">
                    <span className="text-muted">{session.name}</span>
                    <Badge tone="brand">{session.role}</Badge>
                  </span>
                  <Link
                    href="/api/auth/egov/logout"
                    className="rounded-lg px-3 py-1.5 text-muted hover:bg-background"
                  >
                    Sign out
                  </Link>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-hover"
                >
                  Sign in with eGovPH
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted">
            A DICT-funded configuration layer for eGovPH. Services publish only after
            automated validation, with flagged submissions routed to a human reviewer.
          </div>
        </footer>
      </body>
    </html>
  )
}
