import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'

export function CreationHub({ baseHref }: { baseHref: string }) {
  return <div className="space-y-6">
    <PageHeader eyebrow="Create eService" title="How would you like to begin?" description="Both paths stay inside the same DICT-approved service flow and validation rules." />
    <div className="grid gap-5 md:grid-cols-2">
      <Card><CardHeader title="AI-assisted interview" action={<Badge tone="brand">OpenAI</Badge>} /><CardBody className="space-y-5"><p className="text-sm leading-6 text-muted">Describe the citizen service in your own words. The assistant asks one practical policy question at a time and prepares the form, fee, requirements, and routing for review.</p><ButtonLink href={`${baseHref}/studio/ai`}>Start AI interview</ButtonLink></CardBody></Card>
      <Card><CardHeader title="Manual setup" action={<Badge tone="neutral">Form builder</Badge>} /><CardBody className="space-y-5"><p className="text-sm leading-6 text-muted">Choose a DICT template and enter each approved configuration directly. Add or remove local fields, supporting documents, fee waivers, and eligibility conditions.</p><ButtonLink href={`${baseHref}/studio/manual`} variant="secondary">Create manually</ButtonLink></CardBody></Card>
    </div>
    <Card className="bg-brand-soft"><CardBody><p className="text-sm"><strong>Government oversight stays in place.</strong> Conforming configurations publish after confirmation; anything outside the approved bounds goes to DICT review while the current live version remains available.</p></CardBody></Card>
  </div>
}
