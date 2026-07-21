'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, inputClass } from '@/components/ui'
import type { PsgcEntry } from '@/lib/supabase/types'

function geographicTrail(entry: PsgcEntry) {
  return [entry.level, entry.province_code, entry.region_code].filter(Boolean).join(' · ')
}

export function RegisterLguForm({ initialResults }: { initialResults: PsgcEntry[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(initialResults)
  const [selected, setSelected] = useState<PsgcEntry | null>(null)
  const [officialEmail, setOfficialEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function search() {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/lgus/search?q=${encodeURIComponent(term)}`)
      const body = (await response.json()) as { data?: PsgcEntry[]; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'PSA lookup failed.')
      setResults(body.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PSA lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) {
      setError('Select an LGU from the PSA search results.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/lgus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psgcCode: selected.code, officialEmail }),
      })
      const body = (await response.json()) as { id?: string; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not register the LGU.')
      router.push('/lgu')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register the LGU.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Search PSA geographic reference" hint="Type at least two characters" required>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass} placeholder="e.g. Marilao" />
          <Button type="button" variant="secondary" onClick={search} disabled={loading}>Search</Button>
        </div>
      </Field>

      {results.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {results.map((entry) => (
            <button key={entry.code} type="button" onClick={() => setSelected(entry)} className={`block w-full border-b border-border px-4 py-3 text-left last:border-b-0 ${selected?.code === entry.code ? 'bg-brand-soft' : 'hover:bg-background'}`}>
              <span className="block text-sm font-medium">{entry.name}</span>
              <span className="text-xs text-muted">{geographicTrail(entry)} · PSGC {entry.code}</span>
            </button>
          ))}
        </div>
      ) : null}

      <Field label="Official LGU email" required>
        <input value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)} className={inputClass} type="email" placeholder="mayor@lgu.gov.ph" />
      </Field>
      {selected ? <p className="text-sm text-muted">Selected: <span className="font-medium text-foreground">{selected.name}</span></p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button disabled={loading || !selected}>{loading ? 'Saving…' : 'Register LGU'}</Button>
    </form>
  )
}
