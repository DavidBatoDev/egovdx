'use client'

import { useState, type MouseEvent } from 'react'
import { Badge, Button, ButtonLink, Field, inputClass } from '@/components/ui'
import type { PublishedService } from '@/lib/data'
import {
  LGU_SITE_ICONS,
  type LguSiteConfig,
  type LguSiteTarget,
} from '@/lib/lgu-site/schema'
import {
  LguSiteRenderer,
  type LguSiteEditorSection,
} from '@/components/lgu-site/site-renderer'

type Props = {
  lgu: { id: string; name: string; type: string }
  initialConfig: LguSiteConfig
  initialRevision: number
  publishedAt: string | null
  services: PublishedService[]
}

type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

const deviceWidths: Record<PreviewDevice, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
}

export function WebsiteEditor({
  lgu,
  initialConfig,
  initialRevision,
  publishedAt,
  services,
}: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [revision, setRevision] = useState(initialRevision)
  const [lastPublished, setLastPublished] = useState(publishedAt)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState<LguSiteEditorSection>('branding')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [previewOnly, setPreviewOnly] = useState(false)
  const [history, setHistory] = useState<LguSiteConfig[]>([])
  const [future, setFuture] = useState<LguSiteConfig[]>([])

  const sections: Array<{
    id: LguSiteEditorSection
    label: string
    detail: string
    icon: string
  }> = [
    { id: 'branding', label: 'Site identity', detail: 'Logo, tagline & colors', icon: 'Aa' },
    { id: 'banners', label: 'Hero banners', detail: `${config.banners.length}/6 slides`, icon: '▣' },
    { id: 'links', label: 'Quick links', detail: `${config.quickLinks.length}/8 links`, icon: '↗' },
    { id: 'notices', label: 'Announcements', detail: `${config.notices.length}/10 posts`, icon: '!' },
  ]

  function update(next: LguSiteConfig) {
    setHistory((items) => [...items.slice(-29), config])
    setFuture([])
    setConfig(next)
    setDirty(true)
    setMessage('')
    setError('')
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((items) => items.slice(0, -1))
    setFuture((items) => [config, ...items].slice(0, 30))
    setConfig(previous)
    setDirty(true)
    setMessage('Change undone.')
  }

  function redo() {
    const next = future[0]
    if (!next) return
    setFuture((items) => items.slice(1))
    setHistory((items) => [...items.slice(-29), config])
    setConfig(next)
    setDirty(true)
    setMessage('Change restored.')
  }

  async function saveDraft() {
    const response = await fetch('/api/lgu-site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, expectedRevision: revision }),
    })
    const body = await response.json()
    if (!response.ok) {
      throw new Error(
        body.error === 'CMS_REVISION_CONFLICT'
          ? 'Someone else updated this website. Reload before saving again.'
          : body.error || 'Could not save draft.',
      )
    }
    setRevision(body.revision)
    setDirty(false)
    setMessage('Draft saved. Citizens still see the last published version.')
    return Number(body.revision)
  }

  async function run(action: 'save' | 'publish') {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const savedRevision = await saveDraft()
      if (action === 'publish') {
        const response = await fetch('/api/lgu-site/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: savedRevision }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not publish website.')
        setLastPublished(body.publishedAt)
        setMessage('Website published to the citizen LGU page.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Website update failed.')
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File | null, kind: 'logo' | 'banner') {
    if (!file) return null
    setBusy(true)
    setError('')
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('kind', kind)
      const response = await fetch('/api/lgu-site/media', { method: 'POST', body: data })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Upload failed.')
      return body.media.storage_path as string
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function setLogo(file: File | null) {
    const path = await upload(file, 'logo')
    if (path) update({ ...config, branding: { ...config.branding, logoPath: path } })
  }

  async function addBanner(file: File | null) {
    const path = await upload(file, 'banner')
    if (!path) return
    update({
      ...config,
      banners: [
        ...config.banners,
        {
          id: crypto.randomUUID(),
          imagePath: path,
          altText: '',
          headline: '',
          caption: '',
          ctaLabel: '',
          target: null,
        },
      ],
    })
  }

  function selectFromCanvas(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const editable = target.closest<HTMLElement>('[data-cms-section]')
    const selected = editable?.dataset.cmsSection as LguSiteEditorSection | undefined
    if (selected) {
      event.preventDefault()
      setSection(selected)
      setPreviewOnly(false)
    }
    if (target.closest('a')) event.preventDefault()
  }

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[1600px] -translate-x-1/2 space-y-4">
      <header className="sticky top-2 z-30 overflow-hidden rounded-2xl border border-white/10 bg-surface-footer text-white shadow-[0_18px_50px_rgba(19,51,109,0.22)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-4">
            <ButtonLink href="/lgu" variant="ghost" className="h-9 shrink-0 border border-white/20 !text-white hover:bg-white/10">
              <BackIcon /> Workspace
            </ButtonLink>
            <div className="min-w-0 border-l border-white/15 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-lg font-bold sm:text-xl"><span className="sr-only">Website CMS — </span>{lgu.name} website</h1>
                <Badge tone={dirty ? 'warn' : 'success'}>{dirty ? 'Unsaved changes' : 'Up to date'}</Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-white/60">
                Revision {revision} · {lastPublished ? `Published ${new Date(lastPublished).toLocaleDateString('en-PH')}` : 'Not published yet'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex rounded-lg border border-white/15 bg-white/5 p-1">
              <ToolbarButton label="Undo" disabled={!history.length || busy} onClick={undo}><UndoIcon /></ToolbarButton>
              <ToolbarButton label="Redo" disabled={!future.length || busy} onClick={redo}><RedoIcon /></ToolbarButton>
            </div>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setPreviewOnly((value) => !value)} className="border-white/25 bg-white/5 !text-white hover:bg-white/10">
              <PreviewIcon /> {previewOnly ? 'Show editor' : 'Preview only'}
            </Button>
            <Button type="button" variant="secondary" disabled={busy || !dirty} onClick={() => run('save')} className="border-white/25 bg-white/5 !text-white hover:bg-white/10">Save draft</Button>
            <Button type="button" aria-label="Publish website" disabled={busy} onClick={() => run('publish')} className="bg-white !text-brand hover:bg-brand-soft">{busy ? 'Working…' : 'Publish'}</Button>
          </div>
        </div>
      </header>

      {message ? <div role="status" className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-bold text-success">{message}</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div> : null}

      <div className={`grid items-start gap-4 ${previewOnly ? 'grid-cols-1' : 'xl:grid-cols-[23rem_minmax(0,1fr)]'}`}>
        {!previewOnly ? (
          <aside className="overflow-hidden rounded-2xl border border-border bg-surface xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
            <div className="border-b border-border bg-brand-soft/40 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Page settings</p>
              <p className="mt-1 text-sm leading-5 text-muted">Choose a section here—or click it directly in the preview.</p>
            </div>
            <nav aria-label="Website editor sections" className="grid grid-cols-2 gap-2 border-b border-border p-3 xl:grid-cols-1">
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${section === item.id ? 'bg-brand text-white' : 'text-muted hover:bg-brand-soft hover:text-brand'}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold ${section === item.id ? 'bg-white/15' : 'bg-brand-soft text-brand'}`}>{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className={`block text-[11px] ${section === item.id ? 'text-white/65' : 'text-muted'}`}>{item.detail}</span>
                  </span>
                  <ArrowIcon />
                </button>
              ))}
            </nav>

            <div className="p-4">
              {section === 'branding' ? (
                <EditorPanel title="Site identity" description="Changes appear instantly in the highlighted page header.">
                  <Field label="LGU tagline" hint={<CharacterCount value={config.branding.tagline} max={140} />}>
                    <textarea className={`${inputClass} min-h-24 resize-y`} value={config.branding.tagline} maxLength={140} placeholder="A short promise to your community" onChange={(event) => update({ ...config, branding: { ...config.branding, tagline: event.target.value } })} />
                  </Field>
                  <Field label="LGU logo" hint={<span className="text-[10px] font-normal text-muted">JPEG, PNG or WebP · 5 MB maximum</span>}>
                    <input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Primary" value={config.branding.primaryColor} onChange={(value) => update({ ...config, branding: { ...config.branding, primaryColor: value } })} />
                    <ColorField label="Accent" value={config.branding.accentColor} onChange={(value) => update({ ...config, branding: { ...config.branding, accentColor: value } })} />
                  </div>
                </EditorPanel>
              ) : null}

              {section === 'banners' ? (
                <EditorPanel title="Hero banners" description="Use wide photos with a short, useful message." action={<label className={`inline-flex h-9 cursor-pointer items-center rounded-sm bg-brand px-3 text-xs font-bold text-white ${config.banners.length >= 6 || busy ? 'pointer-events-none opacity-50' : ''}`}><PlusIcon /> Add banner<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={config.banners.length >= 6 || busy} onChange={(event) => addBanner(event.target.files?.[0] ?? null)} /></label>}>
                  {config.banners.length ? config.banners.map((banner, index) => (
                    <div key={banner.id} className="space-y-3 rounded-xl border border-border bg-brand-soft/20 p-3">
                      <div className="flex items-center justify-between gap-2"><Badge tone="brand">Slide {index + 1}</Badge><div className="flex gap-1"><Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={index === 0} onClick={() => { const items = [...config.banners]; [items[index - 1], items[index]] = [items[index], items[index - 1]]; update({ ...config, banners: items }) }}>Move up</Button><Button type="button" variant="danger" className="h-8 px-2 text-xs" onClick={() => update({ ...config, banners: config.banners.filter((item) => item.id !== banner.id) })}>Remove</Button></div></div>
                      <Field label="Headline"><input className={inputClass} value={banner.headline} maxLength={100} onChange={(event) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, headline: event.target.value } : item) })} /></Field>
                      <Field label="Caption"><textarea className={`${inputClass} min-h-20`} value={banner.caption} maxLength={240} onChange={(event) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, caption: event.target.value } : item) })} /></Field>
                      <Field label="Image description" required><input className={inputClass} value={banner.altText} maxLength={180} onChange={(event) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, altText: event.target.value } : item) })} /></Field>
                      <Field label="Button label"><input className={inputClass} value={banner.ctaLabel} maxLength={40} onChange={(event) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, ctaLabel: event.target.value, target: item.target ?? { type: 'builtin', route: 'services' } } : item) })} /></Field>
                      {banner.target ? <TargetEditor target={banner.target} services={services} onChange={(target) => update({ ...config, banners: config.banners.map((item) => item.id === banner.id ? { ...item, target } : item) })} /> : null}
                    </div>
                  )) : <EmptyEditorState title="No hero banner yet" detail="Add a landscape photo to create a prominent community update." />}
                </EditorPanel>
              ) : null}

              {section === 'links' ? (
                <EditorPanel title="Quick links" description="Give citizens one-tap access to common destinations." action={<Button type="button" variant="secondary" className="h-9 px-3 text-xs" disabled={config.quickLinks.length >= 8} onClick={() => update({ ...config, quickLinks: [...config.quickLinks, { id: crypto.randomUUID(), icon: 'document', title: 'New link', description: '', target: { type: 'builtin', route: 'services' } }] })}><PlusIcon /> Add link</Button>}>
                  {config.quickLinks.length ? config.quickLinks.map((link, index) => (
                    <div key={link.id} className="space-y-3 rounded-xl border border-border bg-brand-soft/20 p-3">
                      <div className="flex items-center justify-between gap-2"><Badge tone="brand">Link {index + 1}</Badge><div className="flex gap-1"><Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={index === 0} onClick={() => { const items = [...config.quickLinks]; [items[index - 1], items[index]] = [items[index], items[index - 1]]; update({ ...config, quickLinks: items }) }}>Move up</Button><Button type="button" variant="danger" className="h-8 px-2 text-xs" onClick={() => update({ ...config, quickLinks: config.quickLinks.filter((item) => item.id !== link.id) })}>Remove</Button></div></div>
                      <div className="grid grid-cols-[1fr_7rem] gap-2"><Field label="Title"><input className={inputClass} value={link.title} maxLength={50} onChange={(event) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, title: event.target.value } : item) })} /></Field><Field label="Icon"><select className={inputClass} value={link.icon} onChange={(event) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, icon: event.target.value as typeof link.icon } : item) })}>{LGU_SITE_ICONS.map((icon) => <option key={icon}>{icon}</option>)}</select></Field></div>
                      <Field label="Description"><textarea className={`${inputClass} min-h-20`} value={link.description} maxLength={120} onChange={(event) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, description: event.target.value } : item) })} /></Field>
                      <TargetEditor target={link.target} services={services} onChange={(target) => update({ ...config, quickLinks: config.quickLinks.map((item) => item.id === link.id ? { ...item, target } : item) })} />
                    </div>
                  )) : <EmptyEditorState title="No quick links yet" detail="Add shortcuts for permits, hotlines, jobs, and other popular destinations." />}
                </EditorPanel>
              ) : null}

              {section === 'notices' ? (
                <EditorPanel title="Announcements" description="Post timely updates without changing the page structure." action={<Button type="button" variant="secondary" className="h-9 px-3 text-xs" disabled={config.notices.length >= 10} onClick={() => update({ ...config, notices: [...config.notices, { id: crypto.randomUUID(), kind: 'announcement', title: 'New announcement', body: '', visible: true, startsAt: null }] })}><PlusIcon /> Add post</Button>}>
                  {config.notices.length ? config.notices.map((notice, index) => (
                    <div key={notice.id} className="space-y-3 rounded-xl border border-border bg-brand-soft/20 p-3">
                      <div className="flex items-center justify-between gap-2"><Badge tone={notice.visible ? 'brand' : 'neutral'}>{notice.visible ? `Post ${index + 1}` : 'Hidden'}</Badge><Button type="button" variant="danger" className="h-8 px-2 text-xs" onClick={() => update({ ...config, notices: config.notices.filter((item) => item.id !== notice.id) })}>Remove</Button></div>
                      <Field label="Type"><select className={inputClass} value={notice.kind} onChange={(event) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, kind: event.target.value as 'note' | 'announcement' } : item) })}><option value="announcement">Announcement</option><option value="note">Note</option></select></Field>
                      <Field label="Title"><input className={inputClass} value={notice.title} maxLength={100} onChange={(event) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, title: event.target.value } : item) })} /></Field>
                      <Field label="Message"><textarea className={`${inputClass} min-h-28`} value={notice.body} maxLength={1000} onChange={(event) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, body: event.target.value } : item) })} /></Field>
                      <Field label="Starts at"><input className={inputClass} type="datetime-local" value={notice.startsAt ? notice.startsAt.slice(0, 16) : ''} onChange={(event) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null } : item) })} /></Field>
                      <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold"><input type="checkbox" checked={notice.visible} onChange={(event) => update({ ...config, notices: config.notices.map((item) => item.id === notice.id ? { ...item, visible: event.target.checked } : item) })} /> Show this post on the citizen page</label>
                    </div>
                  )) : <EmptyEditorState title="No announcements yet" detail="Add a note for evergreen information or schedule a future update." />}
                </EditorPanel>
              ) : null}
            </div>
          </aside>
        ) : null}

        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-[#e9edf3]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
            <div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /><h2 className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Live preview</h2><Badge tone="warn">Draft</Badge></div>
              <p className="mt-1 text-[11px] text-muted">Live citizen preview using the exact public component. Click a section to edit it.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border bg-brand-soft/30 p-1" aria-label="Preview size">
                {(['desktop', 'tablet', 'mobile'] as const).map((item) => <button key={item} type="button" aria-label={`${item} preview`} aria-pressed={device === item} onClick={() => setDevice(item)} className={`grid h-8 min-w-9 place-items-center rounded-md px-2 text-xs font-bold capitalize ${device === item ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-brand'}`}><DeviceIcon device={item} /><span className="sr-only">{item}</span></button>)}
              </div>
              <ButtonLink href={`/citizen/lgus/${lgu.id}`} target="_blank" variant="secondary" className="h-9">Open public page <ExternalIcon /></ButtonLink>
            </div>
          </div>

          <div className="h-[calc(100vh-12rem)] min-h-[680px] overflow-auto p-4 sm:p-6" onClickCapture={selectFromCanvas}>
            <div className="mx-auto min-h-full rounded-xl bg-white p-4 shadow-[0_18px_55px_rgba(19,51,109,0.16)] transition-[width] duration-200 sm:p-6" style={{ width: deviceWidths[device], maxWidth: '100%' }}>
              <LguSiteRenderer lgu={lgu} config={config} services={services} preview editorSection={section} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function EditorPanel({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-foreground">{title}</h2><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div>{action}</div><div className="space-y-4">{children}</div></div>
}

function EmptyEditorState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-border-strong bg-brand-soft/25 px-4 py-8 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-brand"><PlusIcon /></div><h3 className="mt-3 font-bold text-foreground">{title}</h3><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted">{detail}</p></div>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><label className="flex h-11 cursor-pointer items-center gap-2 rounded-sm border border-border-input bg-white px-2"><input className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" type="color" value={value} onChange={(event) => onChange(event.target.value)} /><span className="font-mono text-xs text-muted">{value.toUpperCase()}</span></label></Field>
}

function CharacterCount({ value, max }: { value: string; max: number }) {
  return <span className="ml-auto text-[10px] font-normal text-muted">{value.length}/{max}</span>
}

function ToolbarButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">{children}</button>
}

function TargetEditor({ target, services, onChange }: { target: LguSiteTarget; services: PublishedService[]; onChange: (target: LguSiteTarget) => void }) {
  return <div className="space-y-2"><label className="text-[13px] font-bold">Destination</label><select className={inputClass} value={target.type} onChange={(event) => onChange(event.target.value === 'service' ? { type: 'service', serviceId: services[0]?.id ?? crypto.randomUUID() } : event.target.value === 'external' ? { type: 'external', url: 'https://' } : { type: 'builtin', route: 'services' })}><option value="builtin">Citizen page</option><option value="service" disabled={!services.length}>Published eService</option><option value="external">External HTTPS URL</option></select>{target.type === 'service' ? <select className={inputClass} value={target.serviceId} onChange={(event) => onChange({ type: 'service', serviceId: event.target.value })}>{services.map((service) => <option key={service.id} value={service.id}>{service.display_name || service.template.name}</option>)}</select> : target.type === 'external' ? <input className={inputClass} type="url" value={target.url} onChange={(event) => onChange({ type: 'external', url: event.target.value })} /> : <select className={inputClass} value={target.route} onChange={(event) => onChange({ type: 'builtin', route: event.target.value as 'services' | 'requests' | 'verify' })}><option value="services">This LGU page</option><option value="requests">My requests</option><option value="verify">Verify a document</option></select>}</div>
}

function BackIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m15 18-6-6 6-6" /></svg> }
function ArrowIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-auto h-4 w-4 fill-none stroke-current stroke-2"><path d="m9 18 6-6-6-6" /></svg> }
function PlusIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-1 h-4 w-4 fill-none stroke-current stroke-2"><path d="M12 5v14M5 12h14" /></svg> }
function UndoIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" /></svg> }
function RedoIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6" /></svg> }
function PreviewIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg> }
function ExternalIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M14 4h6v6M20 4l-9 9M18 13v7H4V6h7" /></svg> }
function DeviceIcon({ device }: { device: PreviewDevice }) { return device === 'mobile' ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><rect x="7" y="2" width="10" height="20" rx="2" /></svg> : device === 'tablet' ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><rect x="5" y="2" width="14" height="20" rx="2" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg> }
