import type { FormField } from '@/lib/supabase/types'
import type { ExtractionResult } from '@/lib/egov/ai'

export function parseExtractionHtml(html: string): ExtractionResult {
  const text = html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  const entries = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf(':')
    return separator < 0 ? { label: line, value: '' } : { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() }
  })
  const title = entries.find((entry) => /document\s*(type|title)/i.test(entry.label))
  return { documentTitle: title?.value || null, fields: entries.filter((entry) => entry !== title).map(({ label, value }) => ({ label, key: toKey(label), type: guessType(label, value), sampleValue: value || undefined, confidence: null })) }
}

export function toKey(label: string) { return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) }
export function guessType(label: string, value: unknown): FormField['type'] {
  const normalized = label.toLowerCase()
  if (/(date|birth|issued|expiry|petsa)/.test(normalized)) return 'date'
  if (/(amount|fee|income|capital|number of|age|years|bilang)/.test(normalized)) return 'number'
  if (/(purpose|remarks|address|reason|layunin)/.test(normalized)) return 'textarea'
  return typeof value === 'number' ? 'number' : 'text'
}
