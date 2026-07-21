import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_LGU_SITE_CONFIG, lguSiteConfigSchema, visibleNotices } from './schema'

test('accepts the bounded default LGU site', () => {
  assert.deepEqual(lguSiteConfigSchema.parse(DEFAULT_LGU_SITE_CONFIG), DEFAULT_LGU_SITE_CONFIG)
})

test('allows HTTPS links and rejects unsafe schemes or credentials', () => {
  const link = { id: crypto.randomUUID(), icon: 'document' as const, title: 'Portal', description: '', target: { type: 'external' as const, url: 'https://example.gov.ph/path' } }
  assert.equal(lguSiteConfigSchema.safeParse({ ...DEFAULT_LGU_SITE_CONFIG, quickLinks: [link] }).success, true)
  assert.equal(lguSiteConfigSchema.safeParse({ ...DEFAULT_LGU_SITE_CONFIG, quickLinks: [{ ...link, target: { type: 'external', url: 'http://example.com' } }] }).success, false)
  assert.equal(lguSiteConfigSchema.safeParse({ ...DEFAULT_LGU_SITE_CONFIG, quickLinks: [{ ...link, target: { type: 'external', url: 'https://user:pass@example.com' } }] }).success, false)
})

test('enforces module limits and required banner alternative text', () => {
  const banner = { id: crypto.randomUUID(), imagePath: 'lgu/banner.png', altText: 'Community event', headline: '', caption: '', ctaLabel: '', target: null }
  assert.equal(lguSiteConfigSchema.safeParse({ ...DEFAULT_LGU_SITE_CONFIG, banners: Array.from({ length: 7 }, () => ({ ...banner, id: crypto.randomUUID() })) }).success, false)
  assert.equal(lguSiteConfigSchema.safeParse({ ...DEFAULT_LGU_SITE_CONFIG, banners: [{ ...banner, altText: '' }] }).success, false)
})

test('shows only visible notices whose start time has arrived', () => {
  const config = { ...DEFAULT_LGU_SITE_CONFIG, notices: [
    { id: crypto.randomUUID(), kind: 'note' as const, title: 'Now', body: 'Visible', visible: true, startsAt: null },
    { id: crypto.randomUUID(), kind: 'announcement' as const, title: 'Later', body: 'Future', visible: true, startsAt: '2030-01-01T00:00:00.000Z' },
    { id: crypto.randomUUID(), kind: 'note' as const, title: 'Hidden', body: 'Hidden', visible: false, startsAt: null },
  ] }
  assert.deepEqual(visibleNotices(config, new Date('2029-01-01T00:00:00.000Z')).map((notice) => notice.title), ['Now'])
})
