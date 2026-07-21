'use client'

import { useEffect, useState } from 'react'
import { publicLguMediaUrl, lguSiteTargetHref, type LguSiteConfig } from '@/lib/lgu-site/schema'

export function BannerCarousel({ banners, lguId }: { banners: LguSiteConfig['banners']; lguId: string }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || banners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActive((value) => (value + 1) % banners.length), 6000)
    return () => window.clearInterval(timer)
  }, [banners.length, paused])

  if (!banners.length) return null
  const safeActive = active < banners.length ? active : 0
  const banner = banners[safeActive]
  const href = banner.target ? lguSiteTargetHref(banner.target, lguId) : null

  return <section aria-roledescription="carousel" aria-label="LGU highlights" className="group relative overflow-hidden rounded-[1.75rem] bg-black shadow-[0_22px_60px_rgba(19,51,109,0.18)]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={publicLguMediaUrl(banner.imagePath)} alt={banner.altText} className="aspect-[16/7] w-full object-cover opacity-85 sm:aspect-[16/6]" />
    {(banner.headline || banner.caption || href) ? <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent px-6 pb-7 pt-28 text-white sm:px-10 sm:pb-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-white/70">Featured update</p>
      {banner.headline ? <h2 className="max-w-3xl font-display text-3xl font-bold leading-tight sm:text-5xl">{banner.headline}</h2> : null}
      {banner.caption ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">{banner.caption}</p> : null}
      {href && banner.ctaLabel ? <a href={href} target={banner.target?.type === 'external' ? '_blank' : undefined} rel={banner.target?.type === 'external' ? 'noopener noreferrer' : undefined} className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black shadow-lg">{banner.ctaLabel} <span aria-hidden="true" className="ml-2">→</span></a> : null}
    </div> : null}
    {banners.length > 1 ? <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
      <button type="button" aria-label="Previous banner" onClick={() => setActive((safeActive - 1 + banners.length) % banners.length)} className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/45 text-2xl text-white backdrop-blur-sm">‹</button>
      <button type="button" aria-label="Next banner" onClick={() => setActive((safeActive + 1) % banners.length)} className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/45 text-2xl text-white backdrop-blur-sm">›</button>
    </div> : null}
    {banners.length > 1 ? <div className="absolute bottom-3 right-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-2 text-white backdrop-blur-sm">
      {banners.map((item, index) => <button key={item.id} type="button" aria-label={`Show banner ${index + 1}`} aria-current={index === safeActive} onClick={() => setActive(index)} className={`h-2 w-2 rounded-full ${index === safeActive ? 'bg-white' : 'bg-white/40'}`} />)}
      <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Resume carousel' : 'Pause carousel'} className="ml-1 text-xs font-bold">{paused ? 'Play' : 'Pause'}</button>
    </div> : null}
  </section>
}
