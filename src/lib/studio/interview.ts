import 'server-only'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { ServiceTemplate } from '@/lib/supabase/types'
import {
  interviewDraftSchema,
  interviewMessageSchema,
  interviewTopics,
  interviewTurnSchema,
  type InterviewDraft,
  type InterviewMessage,
  type InterviewTopic,
  type InterviewTurn,
} from './interview-schema'

export async function continueServiceInterview(input: {
  messages: InterviewMessage[]
  draft: InterviewDraft
  coveredTopics: string[]
}): Promise<InterviewTurn & { model: string; source: 'live' | 'mock' }> {
  const messages = interviewMessageSchema.array().max(30).parse(input.messages)
  const draft = interviewDraftSchema.parse(input.draft)
  const templates = await loadTemplates()
  if (!templates.length) throw new Error('No DICT service templates are configured')

  if (process.env.EGOV_AI_MODE === 'mock') {
    return { ...mockTurn(messages, draft, input.coveredTopics, templates), model: 'deterministic-interview-v2', source: 'mock' }
  }
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')

  const model = process.env.OPENAI_STUDIO_MODEL || 'gpt-5.4-mini'
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model,
    reasoning: { effort: 'low' },
    store: false,
    input: [
      { role: 'developer', content: interviewInstructions(templates, draft, input.coveredTopics) },
      ...messages,
    ],
    text: { format: zodTextFormat(interviewTurnSchema, 'lgu_service_interview') },
  })
  if (!response.output_parsed) throw new Error('OpenAI did not return a usable interview turn')
  const turn = interviewTurnSchema.parse(response.output_parsed)
  if (turn.draft.templateCode && !templates.some((item) => item.code === turn.draft.templateCode)) {
    throw new Error('OpenAI selected an unknown DICT template')
  }

  const coveredTopics = confirmedTopics(messages, input.coveredTopics, turn.draft)
  const nextTopic = interviewTopics.find((topic) => !coveredTopics.includes(topic)) ?? null
  const templateName = templates.find((item) => item.code === turn.draft.templateCode)?.name ?? templates[0].name
  const question = nextTopic ? tagalogQuestion(nextTopic, templateName) : null
  return {
    ...turn,
    assistantMessage: question ?? 'Kumpleto na ang panayam. Ilakip ang opisyal na template upang ma-validate at maisumite ang serbisyo.',
    coveredTopics,
    nextTopic,
    question,
    complete: nextTopic === null,
    model,
    source: 'live',
  }
}

async function loadTemplates(): Promise<ServiceTemplate[]> {
  const { data, error } = await supabaseAdmin().from('service_templates').select('*').order('code')
  if (error) throw error
  return data ?? []
}

function interviewInstructions(templates: ServiceTemplate[], draft: InterviewDraft, covered: string[]) {
  const catalog = templates.map((item) => ({
    code: item.code,
    name: item.name,
    description: item.description,
    baseFields: item.base_fields,
    allowedRules: item.allowed_rules,
    maxFee: item.max_fee,
  }))
  return `You are an intake assistant for a Philippine city, municipality, or barangay creating an eService.
The workflow is fixed by DICT and cannot be changed. Ask exactly one short question at a time.
Speak and respond primarily in natural Tagalog. Use English only when an official office, document, template, or technical name is clearer in English. Accept answers in English, Filipino, or Taglish and extract each officer answer into the draft.
Cover these topics in order, skipping facts already supplied: description, template, eligibility, fields, documents, fee, waivers, office, review.
Never invent a template code, eligibility key, waiver category, or workflow stage. Suggest one catalog template and explicitly ask the officer to confirm it.
Government identity fields (name, birth date, mobile, email, address and address parts) must use source "everify" and must not be requested from citizens.
Use null for unknown scalar values and [] for known-none lists. Mark a topic covered only when the officer answered it or explicitly said none.
Never assume that a service is free. Keep feeAmount null until the officer explicitly gives an amount or says the service is free or has no fee.
Set complete only after all nine topics are covered and the officer confirms the summary.

DICT catalog: ${JSON.stringify(catalog)}
Current draft: ${JSON.stringify(draft)}
Covered topics: ${JSON.stringify(covered)}`
}

function mockTurn(messages: InterviewMessage[], draft: InterviewDraft, coveredInput: string[], templates: ServiceTemplate[]): InterviewTurn {
  const last = messages.at(-1)
  const answeredTopic = interviewTopics.find((topic) => !coveredInput.includes(topic)) ?? null
  const answer = last?.role === 'user' ? last.content : null
  const template = selectMockTemplate(answer ?? draft.purpose ?? '', templates)
  const nextDraft = applyMockAnswer(draft, answeredTopic, answer, template)
  const coveredTopics = confirmedTopics(messages, coveredInput, nextDraft)
  const nextTopic = interviewTopics.find((topic) => !coveredTopics.includes(topic)) ?? null
  const question = nextTopic ? tagalogQuestion(nextTopic, template.name) : null
  return {
    assistantMessage: question ?? 'Kumpleto na ang panayam. Ilakip ang opisyal na template upang ma-validate at maisumite ang serbisyo.',
    nextTopic,
    question,
    draft: nextDraft,
    coveredTopics,
    complete: nextTopic === null,
  }
}

function confirmedTopics(messages: InterviewMessage[], coveredInput: string[], draft: InterviewDraft): InterviewTopic[] {
  const covered = interviewTopics.filter((topic) => coveredInput.includes(topic))
  const topic = interviewTopics.find((item) => !covered.includes(item))
  const last = messages.at(-1)
  if (topic && last?.role === 'user' && validAnswer(topic, last.content, draft)) covered.push(topic)
  return covered
}

function validAnswer(topic: InterviewTopic, answer: string, draft: InterviewDraft) {
  if (!answer.trim()) return false
  if (topic === 'description') return Boolean(draft.name && draft.purpose)
  if (topic === 'template') return Boolean(draft.templateCode)
  if (topic === 'fee') return draft.feeAmount != null
  if (topic === 'office') return Boolean(draft.approvalOffice?.trim())
  if (topic === 'review') return /\b(oo|opo|yes|tama|wasto|handa|sige|confirm|confirmed|kumpirma|kumpirmado)\b/i.test(answer)
  return true
}

function applyMockAnswer(draft: InterviewDraft, topic: InterviewTopic | null, answer: string | null, template: ServiceTemplate): InterviewDraft {
  const next: InterviewDraft = { ...draft, confidence: 0.82 }
  if (!topic || !answer) return next

  if (topic === 'description') {
    next.purpose = answer
    next.name = serviceNameFromDescription(answer, template.name)
    next.templateCode = template.code
    next.formFields = template.base_fields.map((field) => ({ ...field, options: field.options ?? [], source: field.source ?? null }))
  } else if (topic === 'fee') {
    const amount = answer.match(/[\d,]+(?:\.\d{1,2})?/)
    if (/\b(libre|free|walang bayad|no fee|zero)\b/i.test(answer)) next.feeAmount = 0
    else if (amount) next.feeAmount = Number(amount[0].replaceAll(',', ''))
  } else if (topic === 'documents') {
    next.requiredDocs = /\b(wala|none|no attachments?|hindi kailangan)\b/i.test(answer)
      ? []
      : answer.split(/,|\band\b|\bat\b/i).map((item) => item.trim()).filter(Boolean)
  } else if (topic === 'office') {
    next.approvalOffice = answer.trim()
  }
  return next
}

function selectMockTemplate(description: string, templates: ServiceTemplate[]) {
  const lower = description.toLowerCase()
  return templates.find((item) => {
    if (/indigen|financial assistance|medical assistance/.test(lower)) return item.code.includes('INDIGENCY')
    if (/business|permit|franchise|tricycle|sanitation/.test(lower)) return item.code.includes('BIZ')
    return item.code.includes('CLEARANCE')
  }) ?? templates[0]
}

function serviceNameFromDescription(description: string, fallback: string) {
  if (/tricycle/i.test(description)) return 'Tricycle Franchise Renewal'
  const cleaned = description
    .replace(/^(please\s+)?(create|set up|make|gumawa ng|mag-create ng)\s+(an?\s+)?/i, '')
    .replace(/\s+(for|para sa)\s+.+$/i, '')
    .replace(/[.!?]+$/, '')
    .trim()
  if (!cleaned) return fallback
  return cleaned.slice(0, 80).replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function tagalogQuestion(topic: InterviewTopic, templateName: string) {
  const questions: Record<InterviewTopic, string> = {
    description: 'Anong serbisyo ang dapat ma-request ng mamamayan, at ano ang dokumento o resultang matatanggap nila?',
    template: `Ang pinakamalapit na DICT template ay ${templateName}. Ito ba ang dapat nating gamitin?`,
    eligibility: 'Sino ang maaaring mag-apply? May kailangan bang edad, tagal ng paninirahan, o limitasyon sa kita?',
    fields: 'Bukod sa verified eGovPH profile, anong lokal na impormasyon ang kailangang ibigay ng mamamayan?',
    documents: 'Anong mga supporting document ang kailangang ilakip? Sabihin ang “wala” kung walang kailangan.',
    fee: 'Magkano ang eksaktong bayad para sa serbisyong ito? Sabihin ang “libre” kung walang bayad.',
    waivers: 'Sino ang maaaring hindi pagbayarin o mabigyan ng bawas? Sabihin ang “wala” kung walang waiver.',
    office: 'Aling tanggapan ng LGU ang mag-aapruba at mag-iisyu ng serbisyong ito?',
    review: 'Pakisuri ang buod. Tama at handa na ba itong i-validate?',
  }
  return questions[topic]
}
