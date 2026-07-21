import Link from 'next/link'
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
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
          description="Each button starts the same SSO flow. In live mode the persona is ignored and the role comes from the officers table."
          action={<Badge tone={mode === 'mock' ? 'neutral' : 'success'}>{mode} mode</Badge>}
        />
        <CardBody className="flex flex-wrap gap-3">
          <ButtonLink
            href="/api/auth/egov/login?persona=citizen&next=/implementation/egov-sso"
            variant="secondary"
          >
            Sign in as citizen
          </ButtonLink>
          <ButtonLink
            href="/api/auth/egov/login?persona=officer&next=/implementation/egov-sso"
            variant="secondary"
          >
            Sign in as officer
          </ButtonLink>
          <ButtonLink
            href="/api/auth/egov/login?persona=reviewer&next=/implementation/egov-sso"
            variant="secondary"
          >
            Sign in as reviewer
          </ButtonLink>
          <ButtonLink href="/api/auth/egov/logout" variant="ghost">
            Sign out
          </ButtonLink>
        </CardBody>
      </Card>

      {/* 2 — raw result */}
      <Card>
        <CardHeader
          title="Current session"
          description="Decoded from the httpOnly cookie. This is exactly what every other feature receives from getSession()."
        />
        <CardBody>
          {session ? (
            <pre className="overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs">
              {JSON.stringify(session, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted">
              Not signed in. Use a button above.
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
            <Link href="/signin" className="text-brand underline">
              /signin
            </Link>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
