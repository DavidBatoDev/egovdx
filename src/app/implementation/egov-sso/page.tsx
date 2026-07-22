import Link from 'next/link'
import {
  Badge,
  ButtonAnchor,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  SourceBadge,
} from '@/components/ui'
import { getSession } from '@/lib/auth/session'
import { egovMode } from '@/lib/egov/client'
import { getFeature } from '../manifest'

export const metadata = { title: 'eGovPH SSO — implementation harness' }

/**
 * REFERENCE HARNESS — copy this file's shape for your own feature.
 *
 * Note what this page does NOT contain: any SSO logic. It calls getSession()
 * from src/lib/auth/session.ts and renders the result. All the real work lives
 * in src/lib/egov/sso.ts and src/lib/auth/, which is why wiring SSO into the
 * real app took one import rather than a rewrite.
 *
 * A harness page has three jobs:
 *   1. Trigger the thing.
 *   2. Show the raw result, including which API mode produced it.
 *   3. State what the feature exports, so the next person can call it.
 */
export default async function EgovSsoHarness() {
  const feature = getFeature('egov-sso')!
  const session = await getSession().catch(() => null)
  const mode = egovMode('SSO')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Owner: ${feature.owner}`}
        title={feature.name}
        description={feature.summary}
        action={<Badge tone="accent">Contract frozen</Badge>}
      />

      {/* 1 — trigger */}
      <Card>
        <CardHeader
          title="Trigger"
          description={mode === 'mock'
            ? 'Each button uses a deterministic mock identity. The real role policy remains server-owned.'
            : 'Live sign-in starts at the eGovPH-registered callback. This harness intentionally has no local sign-in or sign-out control in live mode.'}
          action={<Badge tone={mode === 'mock' ? 'neutral' : 'success'}>{mode} mode</Badge>}
        />
        <CardBody className="flex flex-wrap gap-3">
          {mode === 'mock' ? (
            <>
              <ButtonAnchor
                href="/api/auth/egov/login?persona=citizen&next=/implementation/egov-sso"
                variant="secondary"
              >
                Sign in as citizen
              </ButtonAnchor>
              <ButtonAnchor
                href="/api/auth/egov/login?persona=officer&next=/implementation/egov-sso"
                variant="secondary"
              >
                Sign in as officer
              </ButtonAnchor>
              <ButtonAnchor
                href="/api/auth/egov/login?persona=reviewer&next=/implementation/egov-sso"
                variant="secondary"
              >
                Sign in as reviewer
              </ButtonAnchor>
              <ButtonAnchor href="/api/auth/egov/logout" className="text-brand hover:bg-brand-soft">
                Sign out
              </ButtonAnchor>
            </>
          ) : (
            <p className="text-sm text-muted">Open this URL from eGovPH after it appends a fresh <code>exchange_code</code>.</p>
          )}
        </CardBody>
      </Card>

      {/* 2 — raw result */}
      <Card>
        <CardHeader
          title="Current session"
          description="Decoded from the httpOnly cookie. This is exactly what every other feature receives from getSession()."
          action={session?.ssoSource ? <SourceBadge source={session.ssoSource} /> : undefined}
        />
        <CardBody>
          {session ? (
            <pre className="overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs">
              {JSON.stringify(session, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted">
              {mode === 'mock' ? 'Not signed in. Use a button above.' : 'Not signed in. Complete the eGovPH handoff to this callback.'}
            </p>
          )}
        </CardBody>
      </Card>

      {/* 3 — the contract */}
      <Card>
        <CardHeader
          title="What this feature provides"
          description="Call these from anywhere. Do not re-implement session handling in your own feature."
        />
        <CardBody>
          <ul className="space-y-2 text-sm">
            {feature.provides.map((item) => (
              <li key={item} className="font-mono text-xs">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            <code className="font-mono">requireRole(&apos;officer&apos;)</code> throws{' '}
            <code className="font-mono">UNAUTHENTICATED</code> or{' '}
            <code className="font-mono">FORBIDDEN</code> — catch it and redirect to{' '}
            {mode === 'mock' ? <><Link href="/signin" className="text-brand underline">/signin</Link>.</> : ' the eGovPH-managed handoff.'}
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
