import { ButtonLink, Card, CardBody, PageHeader, Badge } from '@/components/ui'
import { egovMode } from '@/lib/egov/client'

export const metadata = { title: 'Sign in — eSee LGU' }

/**
 * One identity provider, two consoles.
 *
 * In live mode all three buttons hit the same eGovPH authorize URL and the role
 * comes back from the `officers` lookup — the persona parameter is ignored.
 * In mock mode it picks which seeded persona signs in, which is what makes the
 * two-role flow demonstrable when the sandbox is unavailable.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next = '', error } = await searchParams
  const mock = egovMode('SSO') === 'mock'
  const q = (persona: string) =>
    `/api/auth/egov/login?persona=${persona}${next ? `&next=${encodeURIComponent(next)}` : ''}`

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="eGovPH Single Sign-On"
        title="Sign in to continue"
        description="eSee LGU uses your eGovPH account for both citizen requests and LGU configuration. Your role is assigned by DICT, not chosen here."
      />

      {error ? (
        <Card className="border-danger/30 bg-danger-soft">
          <CardBody className="space-y-2 text-sm text-danger">
            {error === 'database_unavailable' ? (
              <>
                <p className="font-medium">Can&apos;t reach the database.</p>
                <p>
                  Roles are stored in Supabase, so sign-in can&apos;t complete without it.
                  Fill the three Supabase values into{' '}
                  <code className="font-mono">.env.local</code>, run{' '}
                  <code className="font-mono">supabase/schema.sql</code> and{' '}
                  <code className="font-mono">supabase/seed.sql</code>, then restart the
                  dev server.
                </p>
              </>
            ) : (
              <p>Sign-in failed ({error}). Please try again.</p>
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-4">
          <ButtonLink href={q('citizen')} className="w-full">
            Continue as a citizen
          </ButtonLink>
          <p className="text-sm text-muted">
            Request a barangay clearance, certificate of indigency, or business permit
            endorsement from your barangay.
          </p>

          <div className="h-px bg-border" />

          <div className="grid gap-3 sm:grid-cols-2">
            <ButtonLink href={q('officer')} variant="secondary">
              LGU / barangay officer
            </ButtonLink>
            <ButtonLink href={q('reviewer')} variant="secondary">
              DICT reviewer
            </ButtonLink>
          </div>
          <p className="text-sm text-muted">
            Officers configure their own services within DICT-approved bounds. Reviewers
            clear anything the automated validation flags.
          </p>
        </CardBody>
      </Card>

      {mock ? (
        <Card className="border-warn/30 bg-warn-soft">
          <CardBody className="flex items-start gap-3 text-sm text-warn">
            <Badge tone="warn">Mock SSO</Badge>
            <p>
              <code className="font-mono">EGOV_SSO_MODE=mock</code>, so these buttons sign
              in as seeded demo personas without contacting eGovPH. Set it to{' '}
              <code className="font-mono">live</code> once your sandbox credentials are in{' '}
              <code className="font-mono">.env.local</code>.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
