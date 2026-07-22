import 'server-only'
import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { extractDocument } from '@/lib/egov/ai'
import { generateServiceFromExtraction } from './generate'
import { buildAttachmentTurn, interviewInstructions } from './interview'
import {
  interviewTurnSchema,
  interviewTopics,
  type InterviewDraft,
  type InterviewMessage,
  type InterviewTurn,
  type TemplateAttachment,
} from './interview-schema'
import { validateGeneratedService } from './persistence'
import { studioAgentMode } from './agent-mode'

const TOOL_NAME = 'process_uploaded_template'
const TEMPLATE_TOOL: OpenAI.Responses.Tool = {
  type: 'function',
  name: TOOL_NAME,
  description: 'Analyze the official PDF or DOCX template attached by the LGU officer and privately map it to the bounded DICT service configuration.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  strict: true,
}

export async function processTemplateAttachment(input: {
  file: File
  lguId: string
  messages: InterviewMessage[]
  draft: InterviewDraft
  coveredTopics: string[]
}): Promise<InterviewTurn & { attachment: TemplateAttachment; model: string; source: 'live' | 'mock' }> {
  const bytes = Buffer.from(await input.file.arrayBuffer())
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const officerContext = input.messages
    .filter((message) => message.role === 'user' && !message.attachment)
    .map((message) => message.content)
    .join('\n') || input.draft.purpose || 'Configure the eService represented by the attached official LGU template.'

  if (studioAgentMode() === 'mock') {
    const analysis = await executeTemplateTool(input.file, input.lguId, officerContext, input.draft, input.coveredTopics)
    const turn = buildAttachmentTurn({ messages: input.messages, draft: analysis.draft, coveredTopics: input.coveredTopics, fileName: input.file.name })
    return {
      ...turn,
      attachment: attachmentMetadata(input.file, sha256, analysis.source),
      model: 'deterministic-template-tool-v1',
      source: 'mock',
    }
  }

  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')
  const model = process.env.OPENAI_STUDIO_MODEL || 'gpt-5.4-mini'
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const baseInput: OpenAI.Responses.ResponseInput = [
    { role: 'developer', content: `${interviewInstructions(input.draft, input.coveredTopics, true)}\nAn officer attached “${input.file.name}”. You must call ${TOOL_NAME} exactly once. Never reveal the internal DICT match.` },
    ...input.messages.map(({ role, content }) => ({ role, content })),
  ]
  const toolResponse = await client.responses.create({
    model,
    reasoning: { effort: 'low' },
    store: false,
    tools: [TEMPLATE_TOOL],
    tool_choice: { type: 'function', name: TOOL_NAME },
    input: baseInput,
  })
  const calls = toolResponse.output.filter((item) => item.type === 'function_call')
  if (calls.length !== 1 || calls[0].name !== TOOL_NAME) throw new Error('OpenAI did not call the expected template tool')

  const analysis = await executeTemplateTool(input.file, input.lguId, officerContext, input.draft, input.coveredTopics)
  const toolOutput = JSON.stringify({
    analyzed: true,
    documentTitle: analysis.documentTitle,
    mappedFieldCount: analysis.draft.formFields.length,
    requiredDocumentCount: analysis.draft.requiredDocs.length,
    validationFlagCount: analysis.validationFlagCount,
    internalServiceConfiguration: analysis.draft,
  })
  const finalInput = [
    ...baseInput,
    ...toolResponse.output,
    { type: 'function_call_output' as const, call_id: calls[0].call_id, output: toolOutput },
  ] as OpenAI.Responses.ResponseInput
  const finalResponse = await client.responses.parse({
    model,
    reasoning: { effort: 'low' },
    store: false,
    tools: [TEMPLATE_TOOL],
    tool_choice: 'none',
    input: finalInput,
    text: { format: zodTextFormat(interviewTurnSchema, 'lgu_service_interview') },
  })
  if (!finalResponse.output_parsed) throw new Error('OpenAI did not acknowledge the template tool result')

  const parsedTurn = interviewTurnSchema.parse(finalResponse.output_parsed)
  const turn = buildAttachmentTurn({
    messages: input.messages,
    draft: analysis.draft,
    coveredTopics: input.coveredTopics,
    fileName: input.file.name,
    agentMessage: parsedTurn.nextTopic === interviewTopics.find((topic) => !input.coveredTopics.includes(topic)) ? parsedTurn.assistantMessage : undefined,
  })
  return {
    ...turn,
    attachment: attachmentMetadata(input.file, sha256, analysis.source),
    model,
    source: 'live',
  }
}

async function executeTemplateTool(
  file: File,
  lguId: string,
  officerContext: string,
  draft: InterviewDraft,
  coveredTopics: string[],
) {
  const extraction = await extractDocument(file, file.name)
  const generation = await generateServiceFromExtraction(extraction.data, lguId, officerContext)
  const { flags } = await validateGeneratedService(generation.data)
  const merged: InterviewDraft = {
    ...draft,
    templateCode: generation.data.templateCode,
    confidence: Math.max(draft.confidence, generation.data.confidence),
  }
  if (!coveredTopics.includes('description') && !merged.name) merged.name = generation.data.name
  if (!coveredTopics.includes('fields')) merged.formFields = generation.data.formFields.map((field) => ({ ...field, options: field.options ?? [], source: field.source ?? null }))
  if (!coveredTopics.includes('documents')) merged.requiredDocs = generation.data.requiredDocs
  const source = extraction.source === 'mock' || generation.source === 'mock'
    ? 'mock'
    : extraction.source === 'fallback' || generation.source === 'fallback'
      ? 'fallback'
      : 'live'
  return {
    draft: merged,
    documentTitle: extraction.data.documentTitle,
    validationFlagCount: flags.length,
    source,
  } as const
}

function attachmentMetadata(file: File, sha256: string, source: TemplateAttachment['source']): TemplateAttachment {
  return { name: file.name, type: file.type, size: file.size, sha256, status: 'analyzed', source }
}
