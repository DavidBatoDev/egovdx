import Link from 'next/link'
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import {
  FEATURES,
  STATUS_LABEL,
  dependents,
  featuresByOwner,
  getFeature,
  isBlocked,
  type Feature,
  type FeatureStatus,
} from './manifest'

export const metadata = { title: 'Implementation status — eGovDX Local' }

const STATUS_TONE: Record<FeatureStatus, 'neutral' | 'brand' | 'success' | 'accent'> = {
  todo: 'neutral',
  building: 'brand',
  ready: 'accent',
  unified: 'success',
}

/**
 * Team dashboard. Renders src/app/implementation/manifest.ts, which is the one
 * place ownership and status live — a status table duplicated into markdown
 * goes stale within a day.
 */
export default function ImplementationIndex() {
  const counts = FEATURES.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team PRODIGITALITY"
        title="Implementation status"
        description="Each feature is built in isolation under /implementation/<slug>, then wired into the real /app routes once its contract is frozen. Edit manifest.ts to update your row."
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABEL) as FeatureStatus[]).map((status) => (
          <Badge key={status} tone={STATUS_TONE[status]}>
            {STATUS_LABEL[status]}: {counts[status] ?? 0}
          </Badge>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[...featuresByOwner().entries()].map(([owner, owned]) => {
          const done = owned.filter((f) => f.status === 'unified').length
          return (
            <Card key={owner}>
              <CardBody className="space-y-1">
                <p className="font-medium">{owner}</p>
                <p className="text-xs text-muted">
                  {done}/{owned.length} unified
                </p>
                <ul className="pt-1 text-xs text-muted">
                  {owned.map((f) => (
                    <li key={f.slug} className="truncate">
                      <Link
                        href={`/implementation/${f.slug}`}
                        className="hover:text-brand hover:underline"
                      >
                        {f.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader
          title="Features"
          description="A feature is unblocked once its dependencies reach “Contract frozen” — not once they are live in /app."
        />
        <ul className="divide-y divide-border">
          {FEATURES.map((feature) => (
            <FeatureRow key={feature.slug} feature={feature} />
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="How this works" />
        <CardBody className="space-y-2 text-sm text-muted">
          <p>
            <strong className="text-foreground">Logic goes in <code>src/lib/</code>.</strong>{' '}
            The page under <code>/implementation/&lt;slug&gt;</code> is only a harness that
            calls it and shows the result. If your logic lives inside a page component,
            unification means rewriting it.
          </p>
          <p>
            <strong className="text-foreground">Freeze your contract early.</strong> Export
            the function signature and return type before the implementation works, with
            mock data behind it. That unblocks everyone downstream immediately instead of
            at the end.
          </p>
          <p>
            Full guide:{' '}
            <code className="font-mono">docs/04_implementation_workflow.md</code>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function FeatureRow({ feature }: { feature: Feature }) {
  const blocked = isBlocked(feature)
  const unblocks = dependents(feature.slug)

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/implementation/${feature.slug}`}
              className="font-medium text-brand hover:underline"
            >
              {feature.name}
            </Link>
            <Badge tone={STATUS_TONE[feature.status]}>
              {STATUS_LABEL[feature.status]}
            </Badge>
            {blocked && feature.status === 'todo' ? (
              <Badge tone="warn">Blocked</Badge>
            ) : null}
          </div>

          <p className="mt-1 max-w-3xl text-sm text-muted">{feature.summary}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              Owner:{' '}
              <span
                className={
                  feature.owner === 'unassigned' ? 'text-warn' : 'text-foreground'
                }
              >
                {feature.owner}
              </span>
            </span>
            <span className="font-mono">/implementation/{feature.slug}</span>
            {feature.dependsOn.length > 0 ? (
              <span>
                Needs:{' '}
                {feature.dependsOn
                  .map((slug) => getFeature(slug)?.name ?? slug)
                  .join(', ')}
              </span>
            ) : null}
            {unblocks.length > 0 ? (
              <span className="text-brand">Unblocks {unblocks.length}</span>
            ) : null}
          </div>
        </div>

        {feature.apis.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {feature.apis.map((api) => (
              <Badge key={api} tone="brand">
                {api}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  )
}
