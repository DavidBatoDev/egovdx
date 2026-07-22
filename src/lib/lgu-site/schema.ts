import { z } from 'zod'

export const LGU_SITE_ICONS = ['document', 'briefcase', 'building', 'megaphone', 'heart', 'map', 'phone', 'shield'] as const

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.')
const safeText = (max: number) => z.string().trim().max(max)
const targetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('service'), serviceId: z.string().uuid() }),
  z.object({ type: z.literal('builtin'), route: z.enum(['services', 'requests', 'verify']) }),
  z.object({ type: z.literal('external'), url: z.string().url().refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password
    } catch { return false }
  }, 'External links must be HTTPS and cannot contain credentials.') }),
])

export const lguSiteConfigSchema = z.object({
  branding: z.object({
    tagline: safeText(140),
    logoPath: z.string().trim().max(500).nullable(),
    primaryColor: hexColor,
    accentColor: hexColor,
  }),
  banners: z.array(z.object({
    id: z.string().uuid(),
    imagePath: z.string().trim().min(1).max(500),
    altText: safeText(180).min(1, 'Banner alt text is required.'),
    headline: safeText(100),
    caption: safeText(240),
    ctaLabel: safeText(40),
    target: targetSchema.nullable(),
  })).max(6),
  quickLinks: z.array(z.object({
    id: z.string().uuid(),
    icon: z.enum(LGU_SITE_ICONS),
    title: safeText(50).min(1),
    description: safeText(120),
    target: targetSchema,
  })).max(8),
  notices: z.array(z.object({
    id: z.string().uuid(),
    kind: z.enum(['note', 'announcement']),
    title: safeText(100).min(1),
    body: safeText(1000).min(1),
    visible: z.boolean(),
    startsAt: z.string().datetime({ offset: true }).nullable(),
  })).max(10),
})

export type LguSiteConfig = z.infer<typeof lguSiteConfigSchema>
export type LguSiteTarget = z.infer<typeof targetSchema>
export type LguSiteIcon = typeof LGU_SITE_ICONS[number]

export const DEFAULT_LGU_SITE_CONFIG: LguSiteConfig = {
  branding: { tagline: '', logoPath: null, primaryColor: '#0032a0', accentColor: '#fdda25' },
  banners: [],
  quickLinks: [],
  notices: [],
}

export function parseLguSiteConfig(value: unknown): LguSiteConfig {
  return lguSiteConfigSchema.parse(value)
}

export function publicLguMediaUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? ''
  return `${base}/storage/v1/object/public/lgu-site-media/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function lguSiteTargetHref(target: LguSiteTarget, lguId: string): string {
  if (target.type === 'service') return `/citizen/apply/${target.serviceId}`
  if (target.type === 'external') return target.url
  if (target.route === 'requests') return '/citizen/requests'
  if (target.route === 'verify') return '/verify'
  return `/citizen/lgus/${lguId}`
}

export function visibleNotices(config: LguSiteConfig, now = new Date()) {
  return config.notices.filter((notice) => notice.visible && (!notice.startsAt || new Date(notice.startsAt) <= now))
}
