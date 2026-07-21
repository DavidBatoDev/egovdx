'use client'

import type { FormEvent } from 'react'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import type { FormField } from '@/lib/supabase/types'

export function DynamicForm({ fields, prefill, onSubmit }: {
  fields: FormField[]
  prefill?: Partial<Record<string, string | number>>
  onSubmit: (data: Record<string, unknown>) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const raw = new FormData(event.currentTarget)
    const output: Record<string, unknown> = {}
    for (const field of fields) {
      const value = field.source === 'everify' ? prefill?.[field.key] : raw.get(field.key)
      if (value != null && value !== '') output[field.key] = field.type === 'number' ? Number(value) : value
    }
    onSubmit(output)
  }

  return <form onSubmit={submit} className="space-y-4">
    {fields.map((field) => {
      const verified = field.source === 'everify'
      const common = { id: field.key, name: field.key, required: field.required, disabled: verified, defaultValue: prefill?.[field.key] ?? '' }
      return <Field key={field.key} label={field.label} required={field.required} hint={verified ? <Badge tone="brand">Prefilled by eVerify</Badge> : undefined}>
        {field.type === 'textarea' ? <textarea {...common} className={inputClass} rows={4} /> : field.type === 'select' ? <select {...common} className={inputClass}><option value="">Select one</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input {...common} className={inputClass} type={field.type} />}
      </Field>
    })}
    <Button type="submit">Save and continue</Button>
  </form>
}
