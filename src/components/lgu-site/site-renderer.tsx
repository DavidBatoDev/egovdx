/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Badge, ButtonLink } from '@/components/ui'
import type { PublishedService } from '@/lib/data'
import { peso } from '@/lib/format'
import { lguSiteTargetHref, publicLguMediaUrl, visibleNotices, type LguSiteConfig, type LguSiteIcon } from '@/lib/lgu-site/schema'
import { BannerCarousel } from './banner-carousel'

function readableText(hex: string) {
  const [r, g, b] = [hex.slice(1,3), hex.slice(3,5), hex.slice(5,7)].map((part) => Number.parseInt(part, 16) / 255).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  const luminance = .2126 * r + .7152 * g + .0722 * b
  return (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#25282a' : '#ffffff'
}

function Icon({ name, small = false }: { name: LguSiteIcon; small?: boolean }) {
  const paths: Record<LguSiteIcon, string> = {
    document: 'M6 2h9l5 5v15H6z M14 2v6h6 M9 13h8 M9 17h8', briefcase: 'M3 8h18v12H3z M8 8V5h8v3 M3 13h18',
    building: 'M4 22V7l8-5 8 5v15 M8 10h2 M14 10h2 M8 14h2 M14 14h2 M10 22v-4h4v4', megaphone: 'M3 11v4h4l10 4V7L7 11z M7 15l2 6',
    heart: 'M12 21S3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12z', map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
    phone: 'M7 2h4l2 6-3 2a15 15 0 0 0 4 4l2-3 6 2v4c0 3-3 5-6 4C9 19 5 15 3 8 2 5 4 2 7 2z', shield: 'M12 2l8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V5z M9 12l2 2 4-5',
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`${small ? 'h-5 w-5' : 'h-8 w-8'} fill-none stroke-current stroke-2`}><path d={paths[name]} /></svg>
}

function SectionTitle({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em]" style={{ color: 'var(--lgu-primary)' }}>{eyebrow}</p><h2 id={id} className="mt-1 font-display text-2xl font-bold sm:text-3xl">{title}</h2></div><span className="hidden h-1 w-16 rounded-full sm:block" style={{ backgroundColor: 'var(--lgu-accent)' }} /></div>
}

export function LguSiteRenderer({ lgu, config, services, preview = false }: { lgu: { id: string; name: string; type: string }; config: LguSiteConfig; services: PublishedService[]; preview?: boolean }) {
  const text = readableText(config.branding.primaryColor)
  const style = { '--lgu-primary': config.branding.primaryColor, '--lgu-accent': config.branding.accentColor, '--lgu-primary-text': text } as CSSProperties
  const notices = visibleNotices(config)
  return <div style={style} className="space-y-8">
    {preview ? <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand"><span className="font-bold">Live citizen preview</span><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">Draft only</span></div> : null}
    <header className="relative isolate overflow-hidden rounded-[1.75rem] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,51,109,0.2)] sm:px-10 sm:py-10" style={{ background: `linear-gradient(135deg, ${config.branding.primaryColor}, #132b5c)` }}>
      <div aria-hidden="true" className="absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full border-[56px] border-white/10" />
      <div aria-hidden="true" className="absolute -bottom-32 right-40 -z-10 h-72 w-72 rounded-full bg-white/5" />
      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-center gap-5 sm:gap-7">
          {config.branding.logoPath ? <img src={publicLguMediaUrl(config.branding.logoPath)} alt={`${lgu.name} logo`} className="h-24 w-24 shrink-0 rounded-2xl bg-white object-contain p-2 shadow-xl sm:h-32 sm:w-32" /> : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white text-3xl font-black shadow-xl sm:h-32 sm:w-32 sm:text-4xl" style={{ color: config.branding.primaryColor }}>{lgu.name.split(/\s+/).slice(0,2).map((word) => word[0]).join('').toUpperCase()}</div>}
          <div className="min-w-0"><span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.18em]">Official eGovPH LGU portal</span><h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">{lgu.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 opacity-85 sm:text-base">{config.branding.tagline || 'Local services, community updates, and trusted government information in one place.'}</p></div>
        </div>
        <div className="flex gap-3 md:flex-col"><a href="#lgu-services" className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-bold shadow-lg" style={{ color: config.branding.primaryColor }}>Browse services</a><Link href="/verify" className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-center text-sm font-bold text-white">Verify document</Link></div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ backgroundColor: config.branding.accentColor }} />
    </header>
    <BannerCarousel banners={config.banners} lguId={lgu.id} />
    {notices.length ? <section aria-labelledby="lgu-updates"><SectionTitle eyebrow="Stay informed" title="Latest from your LGU" id="lgu-updates" /><div className="grid gap-4 sm:grid-cols-2">{notices.map((notice, index) => <article key={notice.id} className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_12px_35px_rgba(19,51,109,0.08)] ${index === 0 && notices.length > 2 ? 'sm:col-span-2' : ''}`} style={{ borderColor: `${notice.kind === 'announcement' ? config.branding.accentColor : config.branding.primaryColor}55` }}><div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: notice.kind === 'announcement' ? config.branding.accentColor : config.branding.primaryColor }} /><Badge tone={notice.kind === 'announcement' ? 'accent' : 'brand'}>{notice.kind}</Badge><h3 className="mt-3 font-display text-xl font-bold">{notice.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{notice.body}</p></article>)}</div></section> : null}
    {config.quickLinks.length ? <section aria-labelledby="lgu-links"><SectionTitle eyebrow="Quick access" title={`Connect with ${lgu.name}`} id="lgu-links" /><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{config.quickLinks.map((link) => { const href = lguSiteTargetHref(link.target, lgu.id); return <a key={link.id} href={href} target={link.target.type === 'external' ? '_blank' : undefined} rel={link.target.type === 'external' ? 'noopener noreferrer' : undefined} className="group rounded-2xl border border-border bg-white p-5 text-center shadow-[0_10px_30px_rgba(19,51,109,0.07)] hover:-translate-y-0.5 hover:border-[var(--lgu-primary)] hover:shadow-[0_16px_36px_rgba(19,51,109,0.14)]"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl group-hover:scale-105" style={{ backgroundColor: config.branding.accentColor, color: readableText(config.branding.accentColor) }}><Icon name={link.icon} /></span><strong className="mt-4 block text-base">{link.title}</strong>{link.description ? <span className="mt-1.5 block text-xs leading-5 text-muted">{link.description}</span> : null}</a> })}</div></section> : null}
    <section aria-labelledby="lgu-services-title" id="lgu-services"><SectionTitle eyebrow="Available online" title="Government services" id="lgu-services-title" /><p className="-mt-4 mb-5 max-w-2xl text-sm leading-6 text-muted">Apply using your verified eGovPH identity. Your information stays attached to your request from submission through issuance.</p>{services.length ? <div className="grid gap-4 md:grid-cols-2">{services.map((service) => <article key={service.id} className="flex min-h-56 flex-col rounded-2xl border border-border bg-white p-5 shadow-[0_12px_35px_rgba(19,51,109,0.08)]"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ backgroundColor: config.branding.primaryColor }}><Icon name="document" small /></span><Badge tone={service.fee_amount ? 'accent' : 'brand'}>{service.fee_amount ? peso(Number(service.fee_amount)) : 'No fee'}</Badge></div><h3 className="mt-4 font-display text-xl font-bold">{service.display_name || service.template.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{service.template.description || 'Apply for this local government service online.'}</p><div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4"><span className="text-xs text-muted">{service.required_docs.length} document{service.required_docs.length === 1 ? '' : 's'} required</span><ButtonLink href={`/citizen/apply/${service.id}`}>Start application</ButtonLink></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-border bg-brand-soft/40 px-6 py-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand shadow-sm"><Icon name="building" /></span><h3 className="mt-4 font-display text-xl font-bold">Online services are coming soon</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">This LGU has published its community page and is preparing digital services for citizens.</p></div>}</section>
  </div>
}
