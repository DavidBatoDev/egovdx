'use client'

import { useState } from 'react'
import { Badge, Button, Card, CardBody, CardHeader, Field, inputClass } from '@/components/ui'
import type { PublishedService } from '@/lib/data'
import { LGU_SITE_ICONS, type LguSiteConfig, type LguSiteTarget } from '@/lib/lgu-site/schema'
import { LguSiteRenderer } from '@/components/lgu-site/site-renderer'

type Props = { lgu: { id: string; name: string; type: string }; initialConfig: LguSiteConfig; initialRevision: number; publishedAt: string | null; services: PublishedService[] }

export function WebsiteEditor({ lgu, initialConfig, initialRevision, publishedAt, services }: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [revision, setRevision] = useState(initialRevision)
  const [lastPublished, setLastPublished] = useState(publishedAt)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState<'branding' | 'banners' | 'links' | 'notices'>('branding')

  const update = (next: LguSiteConfig) => { setConfig(next); setMessage('') }
  async function saveDraft() {
    const response = await fetch('/api/lgu-site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, expectedRevision: revision }) })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error === 'CMS_REVISION_CONFLICT' ? 'Someone else updated this website. Reload before saving again.' : body.error || 'Could not save draft.')
    setRevision(body.revision)
    setMessage('Draft saved. Citizens still see the last published version.')
    return Number(body.revision)
  }
  async function run(action: 'save' | 'publish') {
    setBusy(true); setError(''); setMessage('')
    try {
      const savedRevision = await saveDraft()
      if (action === 'publish') {
        const response = await fetch('/api/lgu-site/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: savedRevision }) })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not publish website.')
        setLastPublished(body.publishedAt)
        setMessage('Website published to the citizen LGU page.')
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Website update failed.') }
    finally { setBusy(false) }
  }
  async function upload(file: File | null, kind: 'logo' | 'banner') {
    if (!file) return null
    setBusy(true); setError('')
    try {
      const data = new FormData(); data.append('file', file); data.append('kind', kind)
      const response = await fetch('/api/lgu-site/media', { method: 'POST', body: data })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Upload failed.')
      return body.media.storage_path as string
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed.'); return null }
    finally { setBusy(false) }
  }
  async function setLogo(file: File | null) { const path = await upload(file, 'logo'); if (path) update({ ...config, branding: { ...config.branding, logoPath: path } }) }
  async function addBanner(file: File | null) { const path = await upload(file, 'banner'); if (path) update({ ...config, banners: [...config.banners, { id: crypto.randomUUID(), imagePath: path, altText: '', headline: '', caption: '', ctaLabel: '', target: null }] }) }

  const sections = [
    { id: 'branding' as const, label: 'Brand', detail: 'Identity & colors' },
    { id: 'banners' as const, label: 'Banners', detail: `${config.banners.length}/6 slides` },
    { id: 'links' as const, label: 'Quick links', detail: `${config.quickLinks.length}/8 links` },
    { id: 'notices' as const, label: 'Updates', detail: `${config.notices.length}/10 posts` },
  ]

  return <div className="space-y-5">
    <div className="sticky top-2 z-20 overflow-hidden rounded-2xl border border-brand/20 bg-surface shadow-[0_16px_40px_rgba(19,51,109,0.15)]">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-brand to-blue-800 px-5 py-4 text-white">
        <div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-accent-yellow" /><p className="text-xs font-bold uppercase tracking-[.16em]">Website studio</p></div><p className="mt-1 font-display text-xl font-bold">{lgu.name}</p><p className="text-xs text-white/70">Draft revision {revision} · {lastPublished ? `Published ${new Date(lastPublished).toLocaleDateString('en-PH')}` : 'Not published yet'}</p></div>
        <div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => run('save')} className="bg-white/10 !text-white hover:bg-white/20">Save draft</Button><Button disabled={busy} onClick={() => run('publish')} className="bg-white !text-brand hover:bg-brand-soft">{busy ? 'Working…' : 'Publish website'}</Button></div>
      </div>
      <nav aria-label="Website editor sections" className="grid grid-cols-2 gap-1 bg-white p-2 sm:grid-cols-4">{sections.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`rounded-xl px-3 py-2.5 text-left ${section === item.id ? 'bg-brand-soft text-brand shadow-sm' : 'text-muted hover:bg-background'}`}><span className="block text-sm font-bold">{item.label}</span><span className="block text-[11px] opacity-75">{item.detail}</span></button>)}</nav>
    </div>
    {message ? <p className="rounded-xl border border-success/20 bg-success-soft p-3 text-sm font-bold text-success">{message}</p> : null}{error ? <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(34rem,1.2fr)]">
      <div className="space-y-5">

    {section === 'branding' ? <Card className="overflow-hidden"><CardHeader title="Branding and theme" description="Give citizens a clear, recognizable local-government destination." /><CardBody className="grid gap-5 sm:grid-cols-2">
      <Field label="LGU tagline"><input className={inputClass} value={config.branding.tagline} maxLength={140} onChange={(e) => update({ ...config, branding: { ...config.branding, tagline: e.target.value } })} /></Field>
      <Field label="LGU logo" hint="JPEG, PNG or WebP · maximum 5 MB"><input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></Field>
      <Field label="Primary color"><input className="h-12 w-full rounded border border-border p-1" type="color" value={config.branding.primaryColor} onChange={(e) => update({ ...config, branding: { ...config.branding, primaryColor: e.target.value } })} /></Field>
      <Field label="Accent color"><input className="h-12 w-full rounded border border-border p-1" type="color" value={config.branding.accentColor} onChange={(e) => update({ ...config, branding: { ...config.branding, accentColor: e.target.value } })} /></Field>
    </CardBody></Card> : null}

    {section === 'banners' ? <Card><CardHeader title="Banner carousel" description="Lead with the moments and services citizens need to see first." action={<label className="cursor-pointer rounded-full bg-brand px-4 py-2 text-sm font-bold text-white">Add banner<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={config.banners.length >= 6} onChange={(e) => addBanner(e.target.files?.[0] ?? null)} /></label>} /><CardBody className="space-y-4">{config.banners.length ? config.banners.map((banner, index) => <div key={banner.id} className="grid gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-2">
      <Field label="Headline"><input className={inputClass} value={banner.headline} onChange={(e) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, headline: e.target.value } : item) })} /></Field>
      <Field label="Image alternative text" required><input className={inputClass} value={banner.altText} onChange={(e) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, altText: e.target.value } : item) })} /></Field>
      <Field label="Caption"><input className={inputClass} value={banner.caption} onChange={(e) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, caption: e.target.value } : item) })} /></Field>
      <Field label="CTA label"><input className={inputClass} value={banner.ctaLabel} onChange={(e) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, ctaLabel: e.target.value, target: item.target ?? { type: 'builtin', route: 'services' } } : item) })} /></Field>
      {banner.target ? <TargetEditor target={banner.target} services={services} onChange={(target) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, target } : item) })} /> : null}
      <div className="flex items-end gap-2"><Button variant="secondary" disabled={index === 0} onClick={() => { const items=[...config.banners]; [items[index-1],items[index]]=[items[index],items[index-1]]; update({ ...config, banners: items }) }}>Move up</Button><Button variant="danger" onClick={() => update({ ...config, banners: config.banners.filter((item) => item.id !== banner.id) })}>Remove</Button></div>
    </div>) : <EmptyEditorState title="Build your first hero banner" detail="Upload a landscape photo, add a clear headline, and optionally link citizens to a service." />}</CardBody></Card> : null}

    {section === 'links' ? <Card><CardHeader title="Quick links" description="Create a visual shortcut grid for the most useful citizen destinations." action={<Button variant="secondary" disabled={config.quickLinks.length >= 8} onClick={() => update({ ...config, quickLinks: [...config.quickLinks, { id: crypto.randomUUID(), icon: 'document', title: 'New link', description: '', target: { type: 'builtin', route: 'services' } }] })}>Add quick link</Button>} /><CardBody className="space-y-4">{config.quickLinks.length ? config.quickLinks.map((link, index) => <div key={link.id} className="grid gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-2">
      <Field label="Title"><input className={inputClass} value={link.title} onChange={(e) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, title: e.target.value } : item) })} /></Field>
      <Field label="Icon"><select className={inputClass} value={link.icon} onChange={(e) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, icon: e.target.value as typeof link.icon } : item) })}>{LGU_SITE_ICONS.map((icon) => <option key={icon}>{icon}</option>)}</select></Field>
      <Field label="Description"><input className={inputClass} value={link.description} onChange={(e) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, description: e.target.value } : item) })} /></Field>
      <TargetEditor target={link.target} services={services} onChange={(target) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, target } : item) })} />
      <div className="flex gap-2"><Button variant="secondary" disabled={index === 0} onClick={() => { const items=[...config.quickLinks]; [items[index-1],items[index]]=[items[index],items[index-1]]; update({ ...config, quickLinks: items }) }}>Move up</Button><Button variant="danger" onClick={() => update({ ...config, quickLinks: config.quickLinks.filter((item) => item.id !== link.id) })}>Remove</Button></div>
    </div>) : <EmptyEditorState title="Add citizen shortcuts" detail="Use recognizable icons for permits, jobs, announcements, hotlines, and other popular destinations." />}</CardBody></Card> : null}

    {section === 'notices' ? <Card><CardHeader title="Notes and announcements" description="Publish timely, readable updates without changing the page layout." action={<Button variant="secondary" disabled={config.notices.length >= 10} onClick={() => update({ ...config, notices: [...config.notices, { id: crypto.randomUUID(), kind: 'announcement', title: 'New announcement', body: '', visible: true, startsAt: null }] })}>Add announcement</Button>} /><CardBody className="space-y-4">{config.notices.length ? config.notices.map((notice) => <div key={notice.id} className="grid gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-2">
      <Field label="Type"><select className={inputClass} value={notice.kind} onChange={(e) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, kind: e.target.value as 'note'|'announcement' } : item) })}><option value="announcement">Announcement</option><option value="note">Note</option></select></Field>
      <Field label="Title"><input className={inputClass} value={notice.title} onChange={(e) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, title: e.target.value } : item) })} /></Field>
      <Field label="Message"><textarea className={`${inputClass} min-h-28`} value={notice.body} onChange={(e) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, body: e.target.value } : item) })} /></Field>
      <div className="space-y-3"><Field label="Starts at"><input className={inputClass} type="datetime-local" value={notice.startsAt ? notice.startsAt.slice(0,16) : ''} onChange={(e) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, startsAt: e.target.value ? new Date(e.target.value).toISOString() : null } : item) })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notice.visible} onChange={(e) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, visible: e.target.checked } : item) })} />Visible</label><Button variant="danger" onClick={() => update({ ...config, notices: config.notices.filter((item) => item.id !== notice.id) })}>Remove</Button></div>
    </div>) : <EmptyEditorState title="Keep citizens informed" detail="Add a note for evergreen information or schedule an announcement to appear on a future date." />}</CardBody></Card> : null}
      </div>
      <aside className="xl:sticky xl:top-44"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand">What citizens will see</p><h2 className="font-display text-2xl font-bold">Live preview</h2></div><Badge tone="warn">Draft</Badge></div><div className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-2xl border border-border bg-background p-3 shadow-inner sm:p-4"><LguSiteRenderer lgu={lgu} config={config} services={services} preview /></div></aside>
    </div>
  </div>
}

function EmptyEditorState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-brand-soft/30 px-6 py-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl text-brand shadow-sm">＋</div><h3 className="mt-4 font-display text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{detail}</p></div>
}

function TargetEditor({ target, services, onChange }: { target: LguSiteTarget; services: PublishedService[]; onChange: (target: LguSiteTarget) => void }) {
  return <div className="space-y-2"><label className="text-sm font-bold">Destination</label><select className={inputClass} value={target.type} onChange={(e) => onChange(e.target.value === 'service' ? { type: 'service', serviceId: services[0]?.id ?? crypto.randomUUID() } : e.target.value === 'external' ? { type: 'external', url: 'https://' } : { type: 'builtin', route: 'services' })}><option value="builtin">Citizen page</option><option value="service" disabled={!services.length}>Published eService</option><option value="external">External HTTPS URL</option></select>{target.type === 'service' ? <select className={inputClass} value={target.serviceId} onChange={(e) => onChange({ type: 'service', serviceId: e.target.value })}>{services.map((service) => <option key={service.id} value={service.id}>{service.display_name || service.template.name}</option>)}</select> : target.type === 'external' ? <input className={inputClass} type="url" value={target.url} onChange={(e) => onChange({ type: 'external', url: e.target.value })} /> : <select className={inputClass} value={target.route} onChange={(e) => onChange({ type: 'builtin', route: e.target.value as 'services'|'requests'|'verify' })}><option value="services">This LGU page</option><option value="requests">My requests</option><option value="verify">Verify a document</option></select>}</div>
}
