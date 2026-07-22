import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAttachmentTurn, continueServiceInterview } from './interview'
import { emptyInterviewDraft, interviewTopics, type InterviewMessage } from './interview-schema'

process.env.OPENAI_STUDIO_MODE = 'mock'

test('visible interview topics do not include DICT template selection', () => {
  assert.equal(interviewTopics.length, 8)
  assert.equal((interviewTopics as readonly string[]).includes('template'), false)
})

test('mock interview starts with a Tagalog service question and never asks for a similar template', async () => {
  const turn = await continueServiceInterview({ messages: [], draft: emptyInterviewDraft, coveredTopics: [], templateReady: false })
  assert.equal(turn.nextTopic, 'description')
  assert.match(turn.assistantMessage, /Anong serbisyo/i)
  assert.doesNotMatch(turn.assistantMessage, /pinakamalapit|closest|template.*gamitin/i)
})

test('official upload is required before final review can be confirmed', async () => {
  const coveredTopics = interviewTopics.filter((topic) => topic !== 'review')
  const messages: InterviewMessage[] = [{ role: 'user', content: 'Oo, tama na.' }]
  const turn = await continueServiceInterview({ messages, draft: emptyInterviewDraft, coveredTopics, templateReady: false })
  assert.equal(turn.complete, false)
  assert.equal(turn.nextTopic, 'review')
  assert.equal(turn.requiredAction, 'upload_template')
})

test('attachment message does not consume the current policy topic', () => {
  const messages: InterviewMessage[] = [{ role: 'user', content: 'Attached official template: permit.pdf', attachment: { name: 'permit.pdf', type: 'application/pdf', size: 1200 } }]
  const turn = buildAttachmentTurn({ messages, draft: { ...emptyInterviewDraft, templateCode: 'TEST' }, coveredTopics: [], fileName: 'permit.pdf' })
  assert.equal(turn.nextTopic, 'description')
  assert.deepEqual(turn.coveredTopics, [])
  assert.match(turn.assistantMessage, /Nabasa at nasuri/i)
})
