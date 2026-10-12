import { eligiblePrompt, mapSuggestion, suggestNext, type AiSuggestion, type SuggestInput } from "./ai"
import { confirmationCopy, DEFAULT_BOOKING_URL, questionById } from "./qbank"
import { answerQuestion, createInterview, eligibleFlex, freeTextNotice, outputRecord, partialKey, predictNext } from "./engine"
import { outgoingQuestion } from "./scrub"
import { SENSITIVE_MESSAGE } from "./sensitive"
import type { InterviewStore, StoredSession } from "./store"
import type { InterviewState, Question, Source } from "./types"

export interface PublicQuestion {
  id: string
  text: string
  type: string
  goal: string
  options: { id: number; label: string }[]
  maxSelections?: number
  commentLabel?: string
  notice?: string
  contactFields?: string[]
  number?: { min?: number; max?: number; integer?: boolean }
  index: number
  cap: number
  source: Source
}

export interface SummaryItem {
  id: string
  prompt: string
  answer: string
}

export interface PublicView {
  sessionId: string
  phase: "question" | "done"
  question?: PublicQuestion
  summary?: {
    confirmation: string
    bookingUrl: string
    interviewPath: "/interview"
    industry: string
    goalStatus: InterviewState["goalStatus"]
    items: SummaryItem[]
    mailStatus: "not_sent"
    record: ReturnType<typeof outputRecord>
  }
  error?: string
  bookingUrl: string
}

export interface ServiceDeps {
  store: InterviewStore
  suggest?: (input: SuggestInput) => Promise<AiSuggestion | null>
  now?: () => number
  bookingUrl?: string
}

function booking(deps: ServiceDeps): string {
  return deps.bookingUrl || process.env.BOOKING_URL || DEFAULT_BOOKING_URL
}

function labelAnswer(question: Question, answer: unknown): string {
  if (question.type === "single_choice" && typeof answer === "number") {
    return question.options.find((option) => option.id === answer)?.label ?? String(answer)
  }
  if (question.type === "multi_choice" && Array.isArray(answer)) {
    return answer
      .map((id) => question.options.find((option) => option.id === id)?.label ?? String(id))
      .join(", ")
  }
  if (question.type === "contact_block" && answer && typeof answer === "object") {
    const contact = answer as { first_name?: string; email?: string; phone?: string; business_name?: string }
    return [contact.first_name, contact.business_name, contact.email, contact.phone].filter(Boolean).join(" · ")
  }
  return String(answer ?? "")
}

function viewQuestion(state: InterviewState, question: Question): PublicQuestion {
  const outgoing = outgoingQuestion(question, state)
  const shown = outgoing.question
  const source = state.trace.find((item) => item.id === question.id)?.source ?? "starter"
  return {
    id: shown.id,
    text: outgoing.text,
    type: shown.type,
    goal: shown.goal,
    options: shown.options.map((option) => ({ id: option.id, label: option.label })),
    maxSelections: shown.max_selections,
    commentLabel: shown.comment_field?.label,
    notice: freeTextNotice(shown, state.industry),
    contactFields: shown.contact_fields,
    number: shown.validation,
    index: Math.max(1, state.askedOrder.indexOf(question.id) + 1),
    cap: 10,
    source,
  }
}

export function toPublic(row: StoredSession, deps: ServiceDeps): PublicView {
  const state = row.state
  if (state.completed || !state.currentQuestionId) {
    const contact = state.answers.GEN_CONTACT as { first_name?: string } | undefined
    const items = state.askedOrder.flatMap((id) => {
      const question = questionById(id)
      if (!question || state.answers[id] === undefined) return []
      return [{ id, prompt: question.text, answer: labelAnswer(question, state.answers[id]) }]
    })
    return {
      sessionId: row.id,
      phase: "done",
      bookingUrl: booking(deps),
      summary: {
        confirmation: confirmationCopy(contact?.first_name ?? ""),
        bookingUrl: booking(deps),
        interviewPath: "/interview",
        industry: state.industry,
        goalStatus: state.goalStatus,
        items,
        mailStatus: "not_sent",
        record: outputRecord(state),
      },
    }
  }
  const question = questionById(state.currentQuestionId)
  if (!question) {
    return { sessionId: row.id, phase: "done", bookingUrl: booking(deps), error: "This interview is missing its current question." }
  }
  return {
    sessionId: row.id,
    phase: "question",
    bookingUrl: booking(deps),
    question: viewQuestion(state, question),
  }
}

async function persist(deps: ServiceDeps, row: StoredSession): Promise<void> {
  if (row.state.completed) {
    const contact = row.state.answers.GEN_CONTACT as { email?: string } | undefined
    if (contact?.email) row.mailStatus = "not_sent"
  }
  row.updatedAt = new Date().toISOString()
  await deps.store.save(row)
}

export async function startSession(deps: ServiceDeps): Promise<PublicView> {
  const id = crypto.randomUUID()
  const row: StoredSession = {
    id,
    state: createInterview(deps.now?.() ?? Date.now()),
    updatedAt: new Date().toISOString(),
  }
  await persist(deps, row)
  return toPublic(row, deps)
}

export async function getSession(deps: ServiceDeps, id: string): Promise<PublicView | null> {
  const row = await deps.store.get(id)
  if (!row) return null
  return toPublic(row, deps)
}

export async function submitAnswer(
  deps: ServiceDeps,
  id: string,
  questionId: string,
  answer: unknown,
  comment?: string,
): Promise<PublicView> {
  const row = await deps.store.get(id)
  if (!row) return { sessionId: id, phase: "done", bookingUrl: booking(deps), error: "Interview not found." }
  const hint = row.state.prefetch
  const key = partialKey(answer)
  const useAi = hint && hint.partialKey === key && hint.source === "ai"
  const result = answerQuestion(row.state, questionId, answer, {
    now: deps.now?.() ?? Date.now(),
    comment,
    aiQuestionId: useAi ? hint?.questionId : null,
    aiDone: useAi ? hint?.done : false,
  })
  row.state = result.state
  await persist(deps, row)
  const view = toPublic(row, deps)
  if (result.redacted) view.error = SENSITIVE_MESSAGE
  else if (result.error) view.error = result.error
  return view
}

export async function prefetchNext(
  deps: ServiceDeps,
  id: string,
  partial: unknown,
): Promise<{ ready: boolean; source?: string; questionId?: string }> {
  const row = await deps.store.get(id)
  if (!row || row.state.completed || !row.state.currentQuestionId) return { ready: false }
  const prediction = predictNext(row.state, partial, deps.now?.() ?? Date.now())
  if (!prediction.questionId || prediction.source === "done") return { ready: false }
  if (prediction.source === "rules" || prediction.source === "starter") {
    row.state.prefetch = {
      partialKey: partialKey(partial),
      questionId: prediction.questionId,
      done: false,
      source: prediction.source,
    }
    await persist(deps, row)
    return { ready: true, source: prediction.source, questionId: prediction.questionId }
  }
  const flex = eligibleFlex(row.state)
  const suggest = deps.suggest ?? suggestNext
  const suggestion = await suggest({
    industry: row.state.industry,
    answers: row.state.answers,
    partial,
    eligible: eligiblePrompt(flex),
  })
  const mapped = mapSuggestion(suggestion, flex)
  row.state.prefetch = {
    partialKey: partialKey(partial),
    questionId: mapped?.id ?? prediction.questionId,
    done: Boolean(suggestion?.done && mapped),
    source: mapped ? "ai" : "pool",
  }
  await persist(deps, row)
  return { ready: true, source: row.state.prefetch.source, questionId: row.state.prefetch.questionId }
}
