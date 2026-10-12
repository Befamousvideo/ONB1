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

type ContactDraft = { first_name: string; email: string; phone: string; business_name: string }

const emptyContact = (): ContactDraft => ({ first_name: "", email: "", phone: "", business_name: "" })

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

  const draft = useMemo(() => currentDraft(question, { single, multi, text, number, contact }), [question, single, multi, text, number, contact])

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

  async function submit() {
    const active = question
    if (!active || !sessionId) return
    setBusy(true)
    setError("")
    const answer = draft
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
              contact={contact}
              comment={comment}
              onSingle={setSingle}
              onMulti={setMulti}
              onText={setText}
              onNumber={setNumber}
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
    else if (item.type === "number" && (typeof answer === "number" || typeof answer === "string")) setNumber(String(answer))
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
  draft: { single: number | null; multi: number[]; text: string; number: string; contact: ContactDraft },
): unknown {
  if (!question) return null
  if (question.type === "single_choice") return draft.single
  if (question.type === "multi_choice") return draft.multi
  if (question.type === "number") return draft.number === "" ? null : Number(draft.number)
  if (question.type === "contact_block") return draft.contact
  return draft.text
}

function QuestionFields(props: {
  question: PublicQuestion
  single: number | null
  multi: number[]
  text: string
  number: string
  contact: ContactDraft
  comment: string
  onSingle: (value: number) => void
  onMulti: (value: number[]) => void
  onText: (value: string) => void
  onNumber: (value: string) => void
  onContact: (value: ContactDraft) => void
  onComment: (value: string) => void
}) {
  const { question } = props
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
        {question.commentLabel ? <Comment value={props.comment} label={question.commentLabel} onChange={props.onComment} /> : null}
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
        {question.commentLabel ? <Comment value={props.comment} label={question.commentLabel} onChange={props.onComment} /> : null}
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
        <Field label="First name" value={props.contact.first_name} onChange={(value) => props.onContact({ ...props.contact, first_name: value })} />
        <Field label="Work email" value={props.contact.email} onChange={(value) => props.onContact({ ...props.contact, email: value })} />
        <Field label="Phone" value={props.contact.phone} onChange={(value) => props.onContact({ ...props.contact, phone: value })} />
        <Field label="Business name" value={props.contact.business_name} onChange={(value) => props.onContact({ ...props.contact, business_name: value })} />
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
