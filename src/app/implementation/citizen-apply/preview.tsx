'use client'

import { useState } from 'react'
import { DynamicForm } from '@/components/form/dynamic-form'
import { SourceBadge, Toast } from '@/components/ui'
import type { FormField } from '@/lib/supabase/types'

const fields: FormField[] = [
  { key: 'full_name', label: 'Full name', type: 'text', required: true, source: 'everify' },
  { key: 'permit_number', label: 'Permit number', type: 'text', required: true },
  { key: 'employees', label: 'Employees', type: 'number', required: false },
  { key: 'inspection_date', label: 'Preferred inspection date', type: 'date', required: true },
  { key: 'business_type', label: 'Business type', type: 'select', required: true, options: ['Retail', 'Food service', 'Professional'] },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

export function CitizenApplyHarness() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  return <div className="space-y-4"><SourceBadge source="mock" /><DynamicForm fields={fields} prefill={{ full_name: 'JUANA SANTOS DELA CRUZ' }} onSubmit={setResult} />{result ? <Toast><pre className="overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre></Toast> : null}</div>
}
