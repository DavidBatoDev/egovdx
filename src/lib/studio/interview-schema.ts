import { z } from 'zod'

export const interviewTopics = [
  'description', 'eligibility', 'fields', 'documents',
  'fee', 'waivers', 'office', 'review',
] as const

export type InterviewTopic = typeof interviewTopics[number]

export const interviewMessageSchema = z.object({
  role: z.enum(['assistant', 'user']),
  content: z.string().min(1).max(4000),
  attachment: z.object({
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(200),
    size: z.number().int().nonnegative(),
  }).optional(),
})

export const templateAttachmentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['analyzed', 'reattach_required']),
  source: z.enum(['live', 'mock', 'fallback']),
})

const formFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  required: z.boolean(),
  options: z.array(z.string()),
  source: z.enum(['everify']).nullable(),
})

const waiverSchema = z.object({
  category: z.string(),
  label: z.string(),
  waives: z.enum(['full', 'partial']),
  amount: z.number().nonnegative().nullable(),
})

export const interviewDraftSchema = z.object({
  purpose: z.string().nullable(),
  templateCode: z.string().nullable(),
  name: z.string().nullable(),
  formFields: z.array(formFieldSchema),
  feeAmount: z.number().nonnegative().nullable(),
  waivers: z.array(waiverSchema),
  requiredDocs: z.array(z.string()),
  eligibility: z.object({
    min_residency_years: z.number().nonnegative().nullable(),
    min_age: z.number().nonnegative().nullable(),
    max_monthly_income: z.number().nonnegative().nullable(),
  }),
  approvalOffice: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

export const interviewTurnSchema = z.object({
  assistantMessage: z.string(),
  nextTopic: z.enum(interviewTopics).nullable(),
  question: z.string().nullable(),
  draft: interviewDraftSchema,
  coveredTopics: z.array(z.enum(interviewTopics)),
  complete: z.boolean(),
  requiredAction: z.enum(['upload_template']).nullable(),
})

export type InterviewMessage = z.infer<typeof interviewMessageSchema>
export type InterviewDraft = z.infer<typeof interviewDraftSchema>
export type InterviewTurn = z.infer<typeof interviewTurnSchema>
export type TemplateAttachment = z.infer<typeof templateAttachmentSchema>

export const emptyInterviewDraft: InterviewDraft = {
  purpose: null,
  templateCode: null,
  name: null,
  formFields: [],
  feeAmount: null,
  waivers: [],
  requiredDocs: [],
  eligibility: { min_residency_years: null, min_age: null, max_monthly_income: null },
  approvalOffice: null,
  confidence: 0,
}
