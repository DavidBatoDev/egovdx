'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, ButtonLink, SourceBadge, inputClass } from '@/components/ui'
import {
  emptyInterviewDraft,
  interviewTopics,
  type InterviewDraft,
  type InterviewMessage,
  type InterviewTopic,
  type InterviewTurn,
} from '@/lib/studio/interview-schema'

type Saved = { status: 'published' | 'flagged'; serviceId: string }
type Stored = { messages: InterviewMessage[]; draft: InterviewDraft; coveredTopics: string[]; turn: InterviewTurn | null }

const topicLabels: Record<InterviewTopic, string> = {
  description: 'Service overview',
  template: 'DICT template',
  eligibility: 'Eligibility',
  fields: 'Citizen fields',
  documents: 'Documents',
  fee: 'Service fee',
  waivers: 'Fee waivers',
  office: 'Approving office',
  review: 'Final review',
}

export function AiInterviewClient({ baseHref, lguId }: { baseHref: string; lguId: string }) {
  const storageKey = `egovdx:studio:ai:v2:${lguId}`
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [draft, setDraft] = useState<InterviewDraft>(emptyInterviewDraft)
  const [coveredTopics, setCoveredTopics] = useState<string[]>([])
  const [turn, setTurn] = useState<(InterviewTurn & { source?: 'live' | 'mock'; model?: string }) | null>(null)
  const [answer, setAnswer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Saved | null>(null)
  const [extractionSource, setExtractionSource] = useState<'live' | 'mock' | 'fallback' | null>(null)
  const conversationEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (raw) try { const value = JSON.parse(raw) as Stored; setMessages(value.messages); setDraft(value.draft); setCoveredTopics(value.coveredTopics); setTurn(value.turn) } catch { localStorage.removeItem(storageKey) }
  }, [storageKey])
  useEffect(() => {
    if (messages.length || turn) localStorage.setItem(storageKey, JSON.stringify({ messages, draft, coveredTopics, turn }))
  }, [storageKey, messages, draft, coveredTopics, turn])
  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, busy])

  async function advance(initial = false) {
    const nextMessages = initial ? messages : [...messages, { role: 'user' as const, content: answer.trim() }]
    if (!initial && !answer.trim()) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/studio/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: nextMessages, draft, coveredTopics }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'The interview could not continue')
      const next = json as InterviewTurn & { source?: 'live' | 'mock'; model?: string }
      setMessages([...nextMessages, { role: 'assistant', content: next.assistantMessage }])
      setDraft(next.draft); setCoveredTopics(next.coveredTopics); setTurn(next); setAnswer('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }

  async function submit() {
    if (!turn?.complete || !file || !draft.templateCode || !draft.name || draft.feeAmount == null) return
    setBusy(true); setError('')
    try {
      const prompt = messages.filter((item) => item.role === 'user').map((item) => item.content).join('\n')
      const extractionData = new FormData(); extractionData.append('prompt', prompt); extractionData.append('file', file)
      const extractionResponse = await fetch('/api/studio/extract', { method: 'POST', body: extractionData })
      const extractionJson = await extractionResponse.json()
      if (!extractionResponse.ok) throw new Error(extractionJson.error || 'The official template could not be read')
      setExtractionSource(extractionJson.extraction?.source ?? null)
      const extracted = extractionJson.generation?.data
      const service = { templateCode: draft.templateCode, name: draft.name, formFields: extracted?.formFields ?? draft.formFields, feeAmount: draft.feeAmount, waivers: draft.waivers, requiredDocs: draft.requiredDocs.length ? draft.requiredDocs : extracted?.requiredDocs ?? [], eligibility: Object.fromEntries(Object.entries(draft.eligibility).filter(([, value]) => value != null)), approvalOffice: draft.approvalOffice, confidence: Math.min(draft.confidence, Number(extracted?.confidence ?? draft.confidence)) }
      const data = new FormData(); data.append('service', JSON.stringify(service)); data.append('file', file); data.append('engine', 'openai'); data.append('model', turn.model ?? 'configured'); data.append('generatedBy', 'ai'); data.append('sourcePrompt', prompt)
      const response = await fetch('/api/studio/confirm', { method: 'POST', body: data })
      const json = await response.json(); if (!response.ok) throw new Error(json.error || 'Service could not be saved')
      setSaved(json); localStorage.removeItem(storageKey)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }

  const citizenFields = useMemo(() => draft.formFields.filter((field) => field.source !== 'everify'), [draft.formFields])
  const answered = (topic: InterviewTopic) => coveredTopics.includes(topic)
  const progress = Math.round((coveredTopics.length / interviewTopics.length) * 100)
  const currentTopic = turn?.nextTopic ? topicLabels[turn.nextTopic] : 'Ready to begin'
  const eligibility = [
    draft.eligibility.min_age == null ? null : `Age ${draft.eligibility.min_age}+`,
    draft.eligibility.min_residency_years == null ? null : `${draft.eligibility.min_residency_years} year residency`,
    draft.eligibility.max_monthly_income == null ? null : `Income up to ₱${draft.eligibility.max_monthly_income.toLocaleString('en-PH')}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface lg:grid lg:h-[calc(100vh-11rem)] lg:min-h-[640px] lg:max-h-[820px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-[640px] min-w-0 flex-col lg:min-h-0" aria-label="AI service interview">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <AssistantAvatar />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold text-foreground">eGovDX Service Assistant</h2>
                <span className="h-2 w-2 rounded-full bg-brand" aria-label="Assistant online" />
              </div>
              <p className="truncate text-xs text-muted">Tagalog-first · One policy question at a time</p>
            </div>
          </div>
          {turn?.source ? <SourceBadge source={turn.source} /> : <Badge tone="brand">OpenAI assisted</Badge>}
        </header>

        <div className="border-b border-border bg-brand-soft/35 px-4 py-2.5 sm:px-5">
          <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
            <span className="font-bold text-brand">{currentTopic}</span>
            <span className="text-muted">{coveredTopics.length} of {interviewTopics.length} topics</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Interview progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(212,237,252,0.22),rgba(255,255,255,0)_36%)] px-4 py-6 sm:px-6" aria-live="polite">
          {!messages.length ? <WelcomeState onStart={() => advance(true)} busy={busy} /> : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message, index) => <ChatMessage key={index} message={message} />)}
              {busy ? <TypingIndicator /> : null}
              <div ref={conversationEnd} />
            </div>
          )}
        </div>

        {messages.length ? (
          <footer className="border-t border-border bg-surface px-4 py-3 sm:px-5">
            {!turn?.complete ? (
              <div className="mx-auto max-w-3xl">
                <label htmlFor="studio-answer" className="sr-only">Your answer</label>
                <div className="flex items-end gap-2 rounded-xl border border-border-input bg-surface p-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft">
                  <textarea
                    id="studio-answer"
                    className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted/70"
                    placeholder="Type your answer…"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void advance() } }}
                  />
                  <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand-soft disabled:text-border-strong" disabled={busy || !answer.trim()} onClick={() => advance()} aria-label="Send answer">
                    <SendIcon />
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[11px] text-muted">Press Enter to send · Shift + Enter for a new line</p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-3">
                <label className="block rounded-lg border border-dashed border-brand bg-brand-soft/35 px-4 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-brand"><UploadIcon /></span>
                    <span className="min-w-0 flex-1"><strong className="block">Attach the official PDF or DOCX template</strong><span className="block truncate text-xs text-muted">{file?.name ?? 'Required before validation and submission'}</span></span>
                    <span className="rounded-sm border border-brand bg-surface px-3 py-1.5 text-xs font-bold text-brand">Browse</span>
                  </span>
                  <input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
                <Button className="w-full" disabled={busy || !file || Boolean(saved)} onClick={submit}>{busy ? 'Validating…' : saved ? 'Submitted' : 'Validate and submit service'}</Button>
              </div>
            )}
            {error ? <p role="alert" className="mx-auto mt-2 max-w-3xl rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
            {saved ? <div className="mx-auto mt-3 max-w-3xl rounded-sm bg-success-soft p-3 text-sm"><strong>{saved.status === 'published' ? 'Published for citizens.' : 'Sent to DICT review.'}</strong><div className="mt-3"><ButtonLink href={baseHref} variant="secondary">Back to dashboard</ButtonLink></div></div> : null}
          </footer>
        ) : null}
      </section>

      <aside className="flex min-h-0 flex-col border-t border-border bg-brand-soft/20 lg:border-l lg:border-t-0" aria-label="Live service summary">
        <div className="border-b border-border bg-surface px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">Live configuration</p>
              <h2 className="mt-1 font-display text-xl text-foreground">Service summary</h2>
            </div>
            <ProgressRing value={progress} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">Updates only when an answer is confirmed. AI suggestions remain subject to DICT validation.</p>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
          <SummaryItem label="Service" value={answered('description') && draft.name ? draft.name : 'Not answered yet'} confirmed={answered('description')} />
          <SummaryItem label="DICT template" value={answered('template') && draft.templateCode ? draft.templateCode : 'Not confirmed'} confirmed={answered('template')} mono />
          <SummaryItem label="Eligibility" value={!answered('eligibility') ? 'Not answered yet' : eligibility || 'No restrictions specified'} confirmed={answered('eligibility')} />
          <SummaryItem label="Citizen-provided fields" value={!answered('fields') ? 'Not answered yet' : citizenFields.length ? citizenFields.map((field) => field.label).join(' · ') : 'No additional fields'} confirmed={answered('fields')} />
          <SummaryItem label="Documents" value={!answered('documents') ? 'Not answered yet' : draft.requiredDocs.length ? draft.requiredDocs.join(' · ') : 'None'} confirmed={answered('documents')} />
          <SummaryItem label="Fee" value={!answered('fee') ? 'Not answered yet' : draft.feeAmount == null ? 'Needs clarification' : draft.feeAmount === 0 ? 'Free' : `₱${draft.feeAmount.toLocaleString('en-PH')}`} confirmed={answered('fee') && draft.feeAmount != null} emphasize />
          <SummaryItem label="Fee waivers" value={!answered('waivers') ? 'Not answered yet' : draft.waivers.length ? draft.waivers.map((waiver) => waiver.label).join(' · ') : 'None'} confirmed={answered('waivers')} />
          <SummaryItem label="Approving office" value={answered('office') && draft.approvalOffice ? draft.approvalOffice : 'Not answered yet'} confirmed={answered('office')} />
          {extractionSource ? <div className="px-2 pt-2"><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Document extraction</p><SourceBadge source={extractionSource} /></div> : null}
        </div>

        <div className="border-t border-border bg-surface px-5 py-3">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground"><LockIcon /><span>DICT-bounded workflow</span></div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">Request → Verification → Approval → Fee assessment → Issuance</p>
        </div>
      </aside>
    </div>
  )
}

function WelcomeState({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-8 text-center">
    <div className="relative"><div className="absolute inset-0 scale-150 rounded-full bg-brand-soft/60 blur-xl" /><AssistantAvatar large /></div>
    <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-brand">AI-assisted policy interview</p>
    <h3 className="mt-2 font-display text-3xl leading-tight text-foreground">Let’s configure your eService</h3>
    <p className="mt-3 max-w-md text-sm leading-6 text-muted">Sasagutin mo ang siyam na maiikling tanong tungkol sa serbisyo, requirements, bayad, at approving office. Makikita agad sa kanan ang nakumpirmang detalye.</p>
    <Button className="mt-6 h-11 rounded-lg px-6" disabled={busy} onClick={onStart}>{busy ? 'Starting…' : 'Start interview'} <ArrowIcon /></Button>
    <div className="mt-8 grid w-full grid-cols-3 gap-2 text-left text-[11px] text-muted">
      <WelcomeFeature number="01" text="Answer one question" />
      <WelcomeFeature number="02" text="Review live summary" />
      <WelcomeFeature number="03" text="Validate with DICT rules" />
    </div>
  </div>
}

function WelcomeFeature({ number, text }: { number: string; text: string }) {
  return <div className="rounded-lg border border-border bg-surface px-3 py-2.5"><span className="block font-mono text-[10px] font-bold text-brand">{number}</span><span className="mt-1 block leading-snug">{text}</span></div>
}

function ChatMessage({ message }: { message: InterviewMessage }) {
  const assistant = message.role === 'assistant'
  return <div className={`flex items-start gap-3 ${assistant ? '' : 'flex-row-reverse'}`}>
    {assistant ? <AssistantAvatar /> : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-white">You</div>}
    <div className={`max-w-[82%] ${assistant ? '' : 'text-right'}`}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">{assistant ? 'eGovDX Assistant' : 'You'}</p>
      <div className={`inline-block rounded-2xl px-4 py-3 text-left text-sm leading-6 ${assistant ? 'rounded-tl-sm border border-border bg-surface text-foreground' : 'rounded-tr-sm bg-brand text-white'}`}>{message.content}</div>
    </div>
  </div>
}

function TypingIndicator() {
  return <div className="flex items-start gap-3"><AssistantAvatar /><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">eGovDX Assistant</p><div className="flex h-11 items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-surface px-4" aria-label="Assistant is thinking"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:300ms]" /></div></div></div>
}

function SummaryItem({ label, value, confirmed, mono = false, emphasize = false }: { label: string; value: string; confirmed: boolean; mono?: boolean; emphasize?: boolean }) {
  return <div className={`rounded-lg border px-3 py-2 ${confirmed ? 'border-border bg-surface' : 'border-transparent bg-surface/55'}`}>
    <div className="flex items-center gap-2"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${confirmed ? 'border-brand bg-brand text-white' : 'border-border-strong text-transparent'}`} aria-hidden>{confirmed ? '✓' : '·'}</span><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p></div>
    <p className={`ml-6 mt-1 break-words text-sm ${confirmed ? 'text-foreground' : 'text-muted'} ${mono ? 'font-mono text-xs' : ''} ${emphasize && confirmed ? 'text-base font-bold text-brand' : ''}`}>{value}</p>
  </div>
}

function ProgressRing({ value }: { value: number }) {
  return <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--brand) ${value * 3.6}deg, var(--border) 0deg)` }}><div className="grid h-9 w-9 place-items-center rounded-full bg-surface text-[10px] font-bold text-brand">{value}%</div></div>
}

function AssistantAvatar({ large = false }: { large?: boolean }) {
  return <div className={`relative grid shrink-0 place-items-center rounded-xl bg-brand text-white ${large ? 'h-16 w-16' : 'h-9 w-9'}`} aria-hidden><SparkIcon large={large} /></div>
}

function SparkIcon({ large = false }: { large?: boolean }) { return <svg width={large ? 30 : 18} height={large ? 30 : 18} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 2.75c.55 4.9 3.15 7.5 8.05 8.05-4.9.55-7.5 3.15-8.05 8.05-.55-4.9-3.15-7.5-8.05-8.05C8.85 10.25 11.45 7.65 12 2.75Z" fill="currentColor"/><path d="M19.25 2.5c.17 1.5.97 2.3 2.47 2.47-1.5.17-2.3.97-2.47 2.47-.17-1.5-.97-2.3-2.47-2.47 1.5-.17 2.3-.97 2.47-2.47Z" fill="#FDDA25"/></svg> }
function SendIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12 14-8-4 16-3.2-6.2L5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="m11.8 13.8 3.8-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> }
function UploadIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function LockIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8"/></svg> }
function ArrowIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> }
