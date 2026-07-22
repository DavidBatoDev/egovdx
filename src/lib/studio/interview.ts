import 'server-only'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { studioAgentMode } from './agent-mode'
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
  templateReady: boolean
}): Promise<InterviewTurn & { model: string; source: 'live' | 'mock' }> {
  const messages = interviewMessageSchema.array().max(30).parse(input.messages)
  const draft = interviewDraftSchema.parse(input.draft)

  if (studioAgentMode() === 'mock') {
    return { ...mockTurn(messages, draft, input.coveredTopics, input.templateReady), model: 'deterministic-interview-v3', source: 'mock' }
  }
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')

  const model = process.env.OPENAI_STUDIO_MODEL || 'gpt-5.4-mini'
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model,
    reasoning: { effort: 'low' },
    store: false,
    input: [
      { role: 'developer', content: interviewInstructions(draft, input.coveredTopics, input.templateReady) },
      ...messages.map(({ role, content }) => ({ role, content })),
    ],
    text: { format: zodTextFormat(interviewTurnSchema, 'lgu_service_interview') },
  })
  if (!response.output_parsed) throw new Error('OpenAI did not return a usable interview turn')
  const turn = interviewTurnSchema.parse(response.output_parsed)
  const reconciledDraft = reconcileOfficerAnswer(messages, turn.draft, input.coveredTopics)
  const finalized = finalizeTurn(messages, reconciledDraft, input.coveredTopics, input.templateReady)
  const useAgentMessage = !finalized.requiredAction
    && turn.nextTopic === finalized.nextTopic
    && isSafeAgentMessage(turn.assistantMessage, reconciledDraft.templateCode)
  return { ...turn, ...finalized, draft: reconciledDraft, assistantMessage: useAgentMessage ? turn.assistantMessage : finalized.assistantMessage, model, source: 'live' }
}

export function interviewInstructions(draft: InterviewDraft, covered: string[], templateReady: boolean) {
  return `You are an intake assistant for a Philippine city, municipality, or barangay creating an eService.
The workflow is fixed by DICT and cannot be changed. Ask exactly one short question at a time.
Speak and respond primarily in natural Tagalog. Use English only when an official office, document, or technical name is clearer in English. Accept answers in English, Filipino, or Taglish and extract each officer answer into the draft.
Cover these topics in order, skipping facts already supplied: description, eligibility, fields, documents, fee, waivers, office, review.
Never ask the officer to select, approve, or confirm a similar DICT template. The officer attaches the official PDF or DOCX separately, and a server tool performs the private DICT mapping.
Never reveal or discuss templateCode. Preserve its current value exactly; keep it null until the upload tool supplies one.
Government identity fields (name, birth date, mobile, email, address and address parts) must use source "everify" and must not be requested from citizens.
Use null for unknown scalar values and [] for known-none lists. Mark a topic covered only when the officer answered it or explicitly said none.
Never assume that a service is free. Keep feeAmount null until the officer explicitly gives an amount or says the service is free or has no fee.
The final review cannot complete until Template ready is true. Set requiredAction to "upload_template" only when the next step is review and no analyzed template is available; otherwise set it to null.
Set complete only after all eight topics are covered, the official template is ready, and the officer confirms the summary.

Current draft: ${JSON.stringify(draft)}
Covered topics: ${JSON.stringify(covered)}
Template ready: ${templateReady}`
}

export function buildAttachmentTurn(input: {
  messages: InterviewMessage[]
  draft: InterviewDraft
  coveredTopics: string[]
  fileName: string
  agentMessage?: string
}): InterviewTurn {
  const state = finalizeTurn(input.messages, input.draft, input.coveredTopics, true)
  const followUp = state.question ? ` ${state.question}` : ''
  return {
    ...state,
    assistantMessage: input.agentMessage && isSafeAgentMessage(input.agentMessage, input.draft.templateCode)
      ? input.agentMessage
      : `Nabasa at nasuri ko na ang “${input.fileName}”.${followUp}`,
    draft: input.draft,
  }
}

function mockTurn(messages: InterviewMessage[], draft: InterviewDraft, coveredInput: string[], templateReady: boolean): InterviewTurn {
  const last = messages.at(-1)
  const answeredTopic = interviewTopics.find((topic) => !coveredInput.includes(topic)) ?? null
  const answer = last?.role === 'user' && !last.attachment ? last.content : null
  const nextDraft = applyMockAnswer(draft, answeredTopic, answer)
  return { draft: nextDraft, ...finalizeTurn(messages, nextDraft, coveredInput, templateReady) }
}

function finalizeTurn(
  messages: InterviewMessage[],
  draft: InterviewDraft,
  coveredInput: string[],
  templateReady: boolean,
): Omit<InterviewTurn, 'draft'> {
  const coveredTopics = confirmedTopics(messages, coveredInput, draft, templateReady)
  const nextTopic = interviewTopics.find((topic) => !coveredTopics.includes(topic)) ?? null
  const templateRequired = nextTopic === 'review' && !templateReady
  const question = templateRequired ? null : nextTopic ? tagalogQuestion(nextTopic) : null
  const complete = nextTopic === null && templateReady
  return {
    assistantMessage: templateRequired
      ? 'Bago ang final review, i-attach ang opisyal na PDF o DOCX template gamit ang paperclip.'
      : question ?? 'Kumpleto na ang panayam. Handa na ang serbisyo para sa validation at submission.',
    nextTopic,
    question,
    coveredTopics,
    complete,
    requiredAction: templateRequired ? 'upload_template' : null,
  }
}

function confirmedTopics(messages: InterviewMessage[], coveredInput: string[], draft: InterviewDraft, templateReady: boolean): InterviewTopic[] {
  const covered = interviewTopics.filter((topic) => coveredInput.includes(topic))
  const topic = interviewTopics.find((item) => !covered.includes(item))
  const last = messages.at(-1)
  if (topic && last?.role === 'user' && !last.attachment && validAnswer(topic, last.content, draft) && (topic !== 'review' || templateReady)) covered.push(topic)
  return covered
}

function validAnswer(topic: InterviewTopic, answer: string, draft: InterviewDraft) {
  if (!answer.trim()) return false
  if (topic === 'description') return Boolean(draft.name && draft.purpose)
  if (topic === 'fee') return draft.feeAmount != null
  if (topic === 'office') return Boolean(draft.approvalOffice?.trim())
  if (topic === 'review') return /\b(oo|opo|yes|tama|wasto|handa|sige|confirm|confirmed|kumpirma|kumpirmado)\b/i.test(answer)
  return true
}

function applyMockAnswer(draft: InterviewDraft, topic: InterviewTopic | null, answer: string | null): InterviewDraft {
  const next: InterviewDraft = { ...draft, confidence: 0.82 }
  if (!topic || !answer) return next

  if (topic === 'description') {
    next.purpose = answer
    next.name = serviceNameFromDescription(answer)
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

function reconcileOfficerAnswer(messages: InterviewMessage[], draft: InterviewDraft, coveredInput: string[]): InterviewDraft {
  const topic = interviewTopics.find((item) => !coveredInput.includes(item)) ?? null
  const last = messages.at(-1)
  if (topic !== 'description' || last?.role !== 'user' || last.attachment) return draft
  return {
    ...draft,
    name: serviceNameFromDescription(last.content),
    purpose: last.content.trim(),
  }
}

function serviceNameFromDescription(description: string) {
  if (/tricycle/i.test(description)) return 'Tricycle Franchise Renewal'
  const cleaned = description
    .replace(/^(please\s+)?(create|set up|make|gumawa ng|mag-create ng)\s+(an?\s+)?/i, '')
    .replace(/\s+(for|para sa)\s+.+$/i, '')
    .replace(/[.!?]+$/, '')
    .trim()
  return (cleaned || 'New eService').slice(0, 80).replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function tagalogQuestion(topic: InterviewTopic) {
  const questions: Record<InterviewTopic, string> = {
    description: 'Anong serbisyo ang dapat ma-request ng mamamayan, at ano ang dokumento o resultang matatanggap nila?',
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

function isSafeAgentMessage(message: string, internalTemplateCode: string | null) {
  if (!message.trim()) return false
  if (/closest|pinakamalapit|DICT template|templateCode|template code/i.test(message)) return false
  return !internalTemplateCode || !message.includes(internalTemplateCode)
}
