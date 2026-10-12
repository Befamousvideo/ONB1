"use client"

import { useEffect, useMemo, useState } from "react"
import { createDebounced } from "../../lib/debounce"
import type { PublicQuestion, PublicView } from "../../lib/service"

const INTRO =
  "Hi! This takes about 5 minutes: 10 quick questions, max. Your answers help StorenTech AI prepare your AI Opportunity Map, a short list of the places AI can save your business time. A real person at StorenTech reviews everything before we reach out. We only ask about your business, never passwords, card numbers, Social Security numbers, or customer or patient personal details. We use your answers to prepare your Map and to contact you, and we don't sell them."

interface Props {
  privacyUrl: string
  turnstileSiteKey: string
}

type ContactDraft = {
  full_name: string
  business_name: string
  role: string
  email: string
  phone: string
  website: string
  best_time: number | null
  timezone: string
}

const NUMBER_LABELS: Record<string, string> = {
  field: "Techs or crew in the field",
  office: "People in the office",
  total: "Total people",
  billable: "Billable professionals",
  providers: "Providers",
  support: "Support staff",
}

function detectedZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  } catch {
    return ""
  }
}

const emptyContact = (): ContactDraft => ({
  full_name: "",
  business_name: "",
  role: "",
  email: "",
  phone: "",
  website: "",
  best_time: null,
  timezone: detectedZone(),
})

export default function InterviewApp({ privacyUrl, turnstileSiteKey }: Props) {
  const [phase, setPhase] = useState<"intro" | "question" | "done">("intro")
  const [sessionId, setSessionId] = useState("")
  const [question, setQuestion] = useState<PublicQuestion | null>(null)
  const [summary, setSummary] = useState<PublicView["summary"]>()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [single, setSingle] = useState<number | null>(null)
  const [multi, setMulti] = useState<number[]>([])
  const [text, setText] = useState("")
  const [number, setNumber] = useState("")
  const [numbers, setNumbers] = useState<Record<string, string>>({})
  const [contact, setContact] = useState<ContactDraft>(emptyContact())
  const [comment, setComment] = useState("")
  const [seen, setSeen] = useState<PublicQuestion[]>([])
  const [saved, setSaved] = useState<Record<string, { answer: unknown; comment: string }>>({})

  useEffect(() => {
    if (!turnstileSiteKey) return
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
    script.async = true
    script.defer = true
    document.body.appendChild(script)
    return () => {
      script.remove()
    }
  }, [turnstileSiteKey])

  const draft = useMemo(
    () => currentDraft(question, { single, multi, text, number, numbers, contact }),
    [question, single, multi, text, number, numbers, contact],
  )

  const prefetch = useMemo(
    () =>
      createDebounced((id: string, partial: unknown) => {
        void fetch("/api/interview/prefetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id, partial }),
        })
      }, 400),
    [],
  )

  useEffect(() => {
    if (!sessionId || !question || phase !== "question") return
    prefetch(sessionId, draft)
  }, [draft, phase, prefetch, question, sessionId])

  function applyView(view: PublicView) {
    setSessionId(view.sessionId)
    setError(view.error ?? "")
    if (view.phase === "done" && view.summary) {
      setSummary(view.summary)
      setPhase("done")
      setQuestion(null)
      return
    }
    if (view.question) {
      setQuestion(view.question)
      setSeen((current) => (current.some((item) => item.id === view.question?.id) ? current : [...current, view.question as PublicQuestion]))
      setPhase("question")
      if (view.error && view.question.id === question?.id) return
      const prior = saved[view.question.id]
      if (prior && view.question.id !== question?.id) hydrate(view.question, prior.answer, prior.comment)
      else if (view.question.id !== question?.id) resetDraft()
    }
  }

  function resetDraft() {
    setSingle(null)
    setMulti([])
    setText("")
    setNumber("")
    setNumbers({})
    setContact(emptyContact())
    setComment("")
  }

  async function start() {
    setBusy(true)
    setError("")
    const turnstileToken = readTurnstile()
    try {
      const response = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken }),
      })
      const view = (await response.json()) as PublicView
      if (!response.ok && view.error) {
        setError(view.error)
        return
      }
      applyView(view)
    } catch {
      setError("The interview didn't start. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function submit(skip = false) {
    const active = question
    if (!active || !sessionId) return
    setBusy(true)
    setError("")
    const answer = skip ? null : draft
    setSaved((current) => ({ ...current, [active.id]: { answer, comment } }))
    try {
      const response = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: active.id,
          answer,
          comment: comment.trim() || undefined,
        }),
      })
      const view = (await response.json()) as PublicView
      applyView(view)
    } catch {
      setError("We couldn't save that answer. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const previous = seen.filter((item) => item.id !== question?.id).at(-1)

  return (
    <main className="page-shell interview-shell">
      <section className="conversation-panel interview-card">
        <p className="eyebrow">StorenTech AI</p>
        {phase === "intro" ? (
          <>
            <h1 className="panel-title">Before the call</h1>
            <p>{INTRO}</p>
            <p>
              <a href={privacyUrl}>Privacy policy</a>
            </p>
            {turnstileSiteKey ? <div className="cf-turnstile" data-sitekey={turnstileSiteKey} /> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" type="button" onClick={start} disabled={busy}>
              Continue
            </button>
          </>
        ) : null}

        {phase === "question" && question ? (
          <>
            <div className="progress-strip">
              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${(question.index / question.cap) * 100}%` }} />
              </div>
              <span>
                {question.index} of {question.cap}
              </span>
            </div>
            <h1 className="panel-title">{question.text}</h1>
            {question.notice ? <p className="muted-copy">{question.notice}</p> : null}
            <QuestionFields
              question={question}
              single={single}
              multi={multi}
              text={text}
              number={number}
              numbers={numbers}
              contact={contact}
              comment={comment}
              onSingle={setSingle}
              onMulti={setMulti}
              onText={setText}
              onNumber={setNumber}
              onNumbers={(patch) => setNumbers((current) => ({ ...current, ...patch }))}
              onContact={setContact}
              onComment={setComment}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <div className="choice-row">
              {previous ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    const prior = saved[previous.id]
                    setQuestion(previous)
                    if (prior) hydrate(previous, prior.answer, prior.comment)
                  }}
                  disabled={busy}
                >
                  Back
                </button>
              ) : null}
              {question.required ? null : (
                <button className="secondary-button" type="button" onClick={() => submit(true)} disabled={busy}>
                  Skip this one
                </button>
              )}
              <button className="primary-button" type="button" onClick={() => submit()} disabled={busy}>
                Next
              </button>
            </div>
          </>
        ) : null}

        {phase === "done" && summary ? (
          <>
            <h1 className="panel-title">{summary.confirmation}</h1>
            <p>The AI Opportunity Map is $1,000. Nothing else is priced here, and nothing is sent until a person at StorenTech reviews it.</p>
            <ul className="summary-list">
              {summary.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.prompt}</strong>
                  <span>{item.answer}</span>
                </li>
              ))}
            </ul>
            <a className="primary-button" href={summary.bookingUrl}>
              Pick a time
            </a>
          </>
        ) : null}
      </section>
    </main>
  )

  function hydrate(item: PublicQuestion, answer: unknown, note: string) {
    resetDraft()
    setComment(note)
    if (item.type === "single_choice" && typeof answer === "number") setSingle(answer)
    else if (item.type === "multi_choice" && Array.isArray(answer)) setMulti(answer.filter((id): id is number => typeof id === "number"))
    else if (item.type === "number" && answer && typeof answer === "object" && !Array.isArray(answer)) {
      setNumbers(Object.fromEntries(Object.entries(answer as Record<string, unknown>).map(([key, value]) => [key, String(value)])))
    } else if (item.type === "number" && (typeof answer === "number" || typeof answer === "string")) setNumber(String(answer))
    else if (item.type === "contact_block" && answer && typeof answer === "object") setContact({ ...emptyContact(), ...(answer as ContactDraft) })
    else if (typeof answer === "string") setText(answer)
  }
}

function readTurnstile(): string | undefined {
  const turnstile = (window as Window & { turnstile?: { getResponse: () => string } }).turnstile
  const token = turnstile?.getResponse?.()
  return token || undefined
}

function currentDraft(
  question: PublicQuestion | null,
  draft: {
    single: number | null
    multi: number[]
    text: string
    number: string
    numbers: Record<string, string>
    contact: ContactDraft
  },
): unknown {
  if (!question) return null
  if (question.type === "single_choice") return draft.single
  if (question.type === "multi_choice") return draft.multi
  if (question.type === "number" && question.numberFields?.length) {
    return Object.fromEntries(
      question.numberFields.map((field) => [field.key, draft.numbers[field.key] === undefined || draft.numbers[field.key] === "" ? null : Number(draft.numbers[field.key])]),
    )
  }
  if (question.type === "number") return draft.number === "" ? null : Number(draft.number)
  if (question.type === "contact_block") return draft.contact
  return draft.text
}

function needsDetail(question: PublicQuestion, single: number | null, multi: number[]): boolean {
  return question.options.some((option) => option.freeText && (option.id === single || multi.includes(option.id)))
}

function QuestionFields(props: {
  question: PublicQuestion
  single: number | null
  multi: number[]
  text: string
  number: string
  numbers: Record<string, string>
  contact: ContactDraft
  comment: string
  onSingle: (value: number) => void
  onMulti: (value: number[]) => void
  onText: (value: string) => void
  onNumber: (value: string) => void
  onNumbers: (patch: Record<string, string>) => void
  onContact: (value: ContactDraft) => void
  onComment: (value: string) => void
}) {
  const { question } = props
  const detail = needsDetail(question, props.single, props.multi)
  const commentLabel = detail ? "Add a few words" : question.commentLabel
  if (question.type === "single_choice") {
    return (
      <div className="option-grid">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={props.single === option.id ? "chip chip-selected" : "chip"}
            onClick={() => props.onSingle(option.id)}
          >
            {option.label}
          </button>
        ))}
        {commentLabel ? <Comment value={props.comment} label={commentLabel} onChange={props.onComment} /> : null}
      </div>
    )
  }
  if (question.type === "multi_choice") {
    return (
      <div className="option-grid">
        {question.options.map((option) => {
          const selected = props.multi.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              className={selected ? "chip chip-selected" : "chip"}
              onClick={() => {
                const next = selected ? props.multi.filter((id) => id !== option.id) : [...props.multi, option.id]
                const max = question.maxSelections ?? next.length
                props.onMulti(next.slice(0, max))
              }}
            >
              {option.label}
            </button>
          )
        })}
        {commentLabel ? <Comment value={props.comment} label={commentLabel} onChange={props.onComment} /> : null}
      </div>
    )
  }
  if (question.type === "number" && question.numberFields?.length) {
    return (
      <div className="field-grid">
        {question.numberFields.map((field) => (
          <Field
            key={field.key}
            label={NUMBER_LABELS[field.key] ?? field.key}
            value={props.numbers[field.key] ?? ""}
            onChange={(value) => props.onNumbers({ [field.key]: value })}
          />
        ))}
      </div>
    )
  }
  if (question.type === "number") {
    return (
      <label className="field">
        <span>Your answer</span>
        <input
          inputMode="numeric"
          value={props.number}
          min={question.number?.min}
          max={question.number?.max}
          onChange={(event) => props.onNumber(event.target.value)}
        />
      </label>
    )
  }
  if (question.type === "contact_block") {
    return (
      <div className="field-grid">
        <Field label="Full name" value={props.contact.full_name} onChange={(value) => props.onContact({ ...props.contact, full_name: value })} />
        <Field label="Business name" value={props.contact.business_name} onChange={(value) => props.onContact({ ...props.contact, business_name: value })} />
        <Field label="Role / title (optional)" value={props.contact.role} onChange={(value) => props.onContact({ ...props.contact, role: value })} />
        <Field label="Work email" value={props.contact.email} onChange={(value) => props.onContact({ ...props.contact, email: value })} />
        <Field label="Phone (optional)" value={props.contact.phone} onChange={(value) => props.onContact({ ...props.contact, phone: value })} />
        <Field label="Website (optional)" value={props.contact.website} onChange={(value) => props.onContact({ ...props.contact, website: value })} />
        <p className="muted-copy">Best time to reach you</p>
        <div className="option-grid">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={props.contact.best_time === option.id ? "chip chip-selected" : "chip"}
              onClick={() => props.onContact({ ...props.contact, best_time: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Field label="Time zone" value={props.contact.timezone} onChange={(value) => props.onContact({ ...props.contact, timezone: value })} />
      </div>
    )
  }
  return (
    <label className="field">
      <span>Your answer</span>
      <textarea rows={question.type === "long_text" ? 5 : 3} value={props.text} onChange={(event) => props.onText(event.target.value)} />
    </label>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Comment({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
