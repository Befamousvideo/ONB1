import { allRules, bank, questionById } from "./qbank"
import { valueHasSensitive } from "./sensitive"
import type {
  Condition,
  ContactAnswer,
  GoalStatus,
  InterviewState,
  OutputRecord,
  Question,
  Rule,
  Source,
} from "./types"

export interface IssueOptions {
  now?: number
  aiQuestionId?: string | null
  aiDone?: boolean
}

export interface AnswerResult {
  state: InterviewState
  error?: string
  redacted?: boolean
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function planFor(industry: string): Question[] {
  const slotted = bank.questions.filter((question) => typeof question.slot === "number" && !question.fallback)
  const bySlot = new Map<number, Question>()
  for (const question of slotted) {
    if (question.industry_tags.includes("generic") && !question.replaces && question.slot != null) {
      bySlot.set(question.slot, question)
    }
  }
  if (industry !== "generic") {
    for (const question of slotted) {
      if (question.replaces && question.industry_tags.includes(industry) && question.slot != null) {
        bySlot.set(question.slot, question)
      }
    }
  }
  return [...bySlot.entries()].sort((left, right) => left[0] - right[0]).map(([, question]) => question)
}

function readValue(answer: unknown, field?: string): unknown {
  if (answer == null) return undefined
  if (!field) return answer
  if (typeof answer === "number") return answer
  if (typeof answer === "object" && field in answer) return (answer as Record<string, unknown>)[field]
  return undefined
}

export function evalCondition(condition: Condition, answers: Record<string, unknown>): boolean {
  if ("not" in condition) return !evalCondition(condition.not, answers)
  if ("any" in condition) return condition.any.some((part) => evalCondition(part, answers))
  if ("all" in condition) return condition.all.every((part) => evalCondition(part, answers))
  if (!("q" in condition)) return false
  if (answers[condition.q] === undefined) return false
  const question = questionById(condition.q)
  const value = readValue(answers[condition.q], condition.field)
  if (value === undefined) return false
  switch (condition.op) {
    case "eq":
      return value === condition.value
    case "gte":
      return typeof value === "number" && value >= Number(condition.value)
    case "lte":
      return typeof value === "number" && value <= Number(condition.value)
    case "in":
      return typeof value === "number" && Array.isArray(condition.value) && condition.value.includes(value)
    case "option_gte":
    case "option_lte": {
      if (typeof value !== "number" || !question) return false
      const option = question.options.find((item) => item.id === value)
      if (!option || option.ordinal === false) return false
      return condition.op === "option_gte" ? value >= Number(condition.value) : value <= Number(condition.value)
    }
    case "includes_any": {
      if (!Array.isArray(value) || !Array.isArray(condition.value)) return false
      return condition.value.some((id) => value.includes(id))
    }
    case "includes_all": {
      if (!Array.isArray(value) || !Array.isArray(condition.value)) return false
      return condition.value.every((id) => value.includes(id))
    }
    default:
      return false
  }
}

export function createInterview(now = Date.now()): InterviewState {
  const state: InterviewState = {
    industry: "generic",
    answers: {},
    comments: {},
    askedOrder: [],
    droppedSlots: [],
    followupsAsked: [],
    followupsSkipped: [],
    startedAt: now,
    currentQuestionId: null,
    completed: false,
    endReason: null,
    trace: [],
    redacted: false,
    goalStatus: {},
    prefetch: null,
  }
  const first = questionById("GEN_BUSINESS_TYPE")
  if (!first) throw new Error("GEN_BUSINESS_TYPE missing from the question bank")
  state.askedOrder.push(first.id)
  state.currentQuestionId = first.id
  state.trace.push({ id: first.id, source: "starter" })
  state.goalStatus = computeGoalStatus(state)
  return state
}

function coreStillRequired(state: InterviewState, candidateId: string): Question[] {
  return planFor(state.industry).filter(
    (question) => question.slot_class === "core" && !state.askedOrder.includes(question.id) && question.id !== candidateId,
  )
}

export function canIssue(state: InterviewState, candidate: Question): boolean {
  if (state.askedOrder.includes(candidate.id)) return false
  if (state.askedOrder.length >= bank.limits.max_questions) return false
  // The candidate is the +1. Core questions other than the candidate still have to fit.
  // A core candidate is removed from the remaining-core count so the worked example can
  // still ask locations, team, tools, goals, and contact after three follow-ups.
  const remainingCore = coreStillRequired(state, candidate.id).length
  return state.askedOrder.length + remainingCore + 1 <= bank.limits.max_questions
}

function nextDropSlot(state: InterviewState): number | null {
  const plan = planFor(state.industry)
  for (const slot of bank.flex_slots_drop_order) {
    if (state.droppedSlots.includes(slot)) continue
    const question = plan.find((item) => item.slot === slot)
    if (question && state.askedOrder.includes(question.id)) continue
    return slot
  }
  return null
}

function pendingRules(state: InterviewState): Rule[] {
  const active = allRules().filter((rule) => {
    if (rule.depth > bank.limits.max_chain_depth) return false
    if (state.followupsAsked.includes(rule.rule_id)) return false
    if (state.followupsSkipped.includes(rule.rule_id)) return false
    const follow = questionById(rule.then)
    if (!follow || state.askedOrder.includes(follow.id)) return false
    return evalCondition(rule.condition, state.answers)
  })
  active.sort((left, right) => left.priority - right.priority || left.doc_order - right.doc_order)
  return active
}

function finish(state: InterviewState, reason: InterviewState["endReason"]): void {
  state.completed = true
  state.currentQuestionId = null
  state.endReason = reason
  state.goalStatus = computeGoalStatus(state)
}

function issue(state: InterviewState, question: Question, source: Source, ruleId?: string): void {
  state.askedOrder.push(question.id)
  state.currentQuestionId = question.id
  state.trace.push({ id: question.id, source, ruleId })
}

export function eligibleFlex(state: InterviewState): Question[] {
  if (state.industry !== "generic") return []
  return planFor(state.industry).filter(
    (question) =>
      question.slot_class === "flex" &&
      !state.askedOrder.includes(question.id) &&
      !(question.slot && state.droppedSlots.includes(question.slot)) &&
      canIssue(state, question),
  )
}

function issueNext(state: InterviewState, options: IssueOptions): void {
  const now = options.now ?? Date.now()
  if (now - state.startedAt >= bank.limits.time_cap_ms) {
    finish(state, "time_cap")
    return
  }
  if (state.askedOrder.length >= bank.limits.max_questions) {
    finish(state, "cap")
    return
  }

  for (const rule of pendingRules(state)) {
    const follow = questionById(rule.then)
    if (!follow) continue
    const drop = nextDropSlot(state)
    const budget = state.followupsAsked.length < bank.limits.max_followups && drop !== null
    if (!budget || !canIssue(state, follow)) {
      if (!state.followupsSkipped.includes(rule.rule_id)) state.followupsSkipped.push(rule.rule_id)
      continue
    }
    state.droppedSlots.push(drop as number)
    state.followupsAsked.push(rule.rule_id)
    issue(state, follow, "rules", rule.rule_id)
    return
  }

  for (const candidate of planFor(state.industry)) {
    if (state.askedOrder.includes(candidate.id)) continue
    if (candidate.slot && state.droppedSlots.includes(candidate.slot)) continue
    if (!canIssue(state, candidate)) {
      if (candidate.slot_class !== "core" && candidate.slot && !state.droppedSlots.includes(candidate.slot)) {
        state.droppedSlots.push(candidate.slot)
        continue
      }
      finish(state, "cap")
      return
    }
    const genericFlex = state.industry === "generic" && candidate.slot_class === "flex"
    if (genericFlex && options.aiDone) {
      if (candidate.slot && !state.droppedSlots.includes(candidate.slot)) state.droppedSlots.push(candidate.slot)
      continue
    }
    if (genericFlex && options.aiQuestionId) {
      const chosen = questionById(options.aiQuestionId)
      if (chosen && eligibleFlex(state).some((item) => item.id === chosen.id) && canIssue(state, chosen)) {
        issue(state, chosen, "ai")
        return
      }
    }
    issue(state, candidate, genericFlex ? "pool" : "starter")
    return
  }

  finish(state, "complete")
}

function asNumber(answer: unknown): number | null {
  if (typeof answer === "number" && Number.isFinite(answer)) return answer
  if (typeof answer === "string" && answer.trim() !== "" && Number.isFinite(Number(answer))) return Number(answer)
  return null
}

export function isSkipped(answer: unknown): boolean {
  return answer == null || (typeof answer === "object" && !Array.isArray(answer) && (answer as { skipped?: unknown }).skipped === true)
}

function checkNumber(value: number | null, rules: { integer?: boolean; min?: number; max?: number }): string | null {
  if (value == null) return "Enter a number."
  if (rules.integer && !Number.isInteger(value)) return "Enter a whole number."
  if (rules.min != null && value < rules.min) return `Enter at least ${rules.min}.`
  if (rules.max != null && value > rules.max) return `Enter at most ${rules.max}.`
  return null
}

function selectedIds(question: Question, answer: unknown): number[] {
  if (question.type === "single_choice") {
    const id = asNumber(answer)
    return id == null ? [] : [id]
  }
  if (question.type === "multi_choice" && Array.isArray(answer)) {
    return answer.map(asNumber).filter((id): id is number => id != null)
  }
  return []
}

export function validateAnswer(question: Question, answer: unknown, comment?: string): string | null {
  if (question.required === false && isSkipped(answer)) return null
  if (question.type === "single_choice") {
    const id = asNumber(answer)
    if (id == null || !question.options.some((option) => option.id === id)) return "Pick one of the options."
  } else if (question.type === "multi_choice") {
    if (!Array.isArray(answer) || answer.length === 0) return "Pick at least one."
    const ids = answer.map(asNumber)
    if (ids.some((id) => id == null)) return "Pick from the options."
    const max = question.max_selections ?? question.options.length
    if (ids.length > max) return `Pick up to ${max}.`
    if (ids.some((id) => !question.options.some((option) => option.id === id))) return "Pick from the options."
  } else if (question.type === "number" && question.number_fields?.length) {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return "Enter a number for each field."
    const record = answer as Record<string, unknown>
    for (const field of question.number_fields) {
      const error = checkNumber(asNumber(record[field.key]), field)
      if (error) return error
    }
  } else if (question.type === "number") {
    const error = checkNumber(asNumber(answer), question.validation ?? {})
    if (error) return error
  } else if (question.type === "short_text" || question.type === "long_text") {
    if (typeof answer !== "string") return "Add a short answer."
    const text = answer.trim()
    const min = question.validation?.min_chars ?? 1
    const max = question.validation?.max_chars
    if (text.length < min) return `Add at least ${min} characters.`
    if (max != null && text.length > max) return `Keep it under ${max} characters.`
  } else if (question.type === "contact_block") {
    if (!answer || typeof answer !== "object") return "Add your contact details."
    const contact = answer as Partial<ContactAnswer>
    if (!String(contact.full_name ?? "").trim()) return "Add your name."
    if (!String(contact.business_name ?? "").trim()) return "Add the business name."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email ?? "").trim())) return "Enter a work email like name@company.com."
    const phone = String(contact.phone ?? "").trim()
    if (phone) {
      const digits = phone.replace(/\D/g, "")
      if (digits.length < 7 || digits.length > 15) return "Enter a phone number, or leave it blank."
    }
    const best = asNumber(contact.best_time)
    if (best == null || !question.options.some((option) => option.id === best)) return "Pick the best time to reach you."
  } else {
    return "Unsupported question."
  }
  const picked = selectedIds(question, answer)
  const needsDetail = question.options.some((option) => option.free_text && picked.includes(option.id))
  if (needsDetail && !comment?.trim()) return "Add a few words for the option you described."
  return null
}

function normalizeAnswer(question: Question, answer: unknown): unknown {
  if (question.required === false && isSkipped(answer)) return { skipped: true }
  if (question.type === "number" && question.number_fields?.length && answer && typeof answer === "object") {
    const record = answer as Record<string, unknown>
    return Object.fromEntries(question.number_fields.map((field) => [field.key, asNumber(record[field.key])]))
  }
  if (question.type === "single_choice" || question.type === "number") return asNumber(answer)
  if (question.type === "multi_choice" && Array.isArray(answer)) return answer.map((item) => asNumber(item))
  if (question.type === "short_text" || question.type === "long_text") return String(answer).trim()
  if (question.type === "contact_block" && answer && typeof answer === "object") {
    const contact = answer as ContactAnswer
    return {
      full_name: String(contact.full_name).trim(),
      business_name: String(contact.business_name).trim(),
      role: String(contact.role ?? "").trim(),
      email: String(contact.email).trim(),
      phone: String(contact.phone ?? "").trim(),
      website: String(contact.website ?? "").trim(),
      best_time: asNumber(contact.best_time),
      timezone: String(contact.timezone ?? "").trim(),
    }
  }
  return answer
}

export function partialKey(answer: unknown): string {
  return JSON.stringify(answer)
}

export function answerQuestion(
  state: InterviewState,
  questionId: string,
  answer: unknown,
  options: IssueOptions & { comment?: string } = {},
): AnswerResult {
  const question = questionById(questionId)
  if (!question) return { state, error: "Unknown question." }
  if (!state.askedOrder.includes(questionId)) return { state, error: "That question is not part of this interview." }
  const error = validateAnswer(question, answer, options.comment)
  if (error) return { state, error }
  const next = clone(state)
  if (valueHasSensitive(answer) || (options.comment && valueHasSensitive(options.comment))) {
    next.redacted = true
    return { state: next, error: "SENSITIVE", redacted: true }
  }
  next.answers[questionId] = normalizeAnswer(question, answer)
  if (options.comment && options.comment.trim()) next.comments[questionId] = options.comment.trim()
  if (questionId === "GEN_BUSINESS_TYPE") {
    next.industry = bank.industry_map[String(next.answers[questionId])] ?? "generic"
  }
  if (questionId !== next.currentQuestionId) {
    next.goalStatus = computeGoalStatus(next)
    return { state: next }
  }
  next.prefetch = null
  issueNext(next, options)
  next.goalStatus = computeGoalStatus(next)
  return { state: next }
}

export function predictNext(state: InterviewState, partial: unknown, now = Date.now()): {
  source: Source | "done"
  questionId: string | null
} {
  const current = state.currentQuestionId ? questionById(state.currentQuestionId) : undefined
  if (!current || state.completed) return { source: "done", questionId: null }
  if (validateAnswer(current, partial)) return { source: "pool", questionId: null }
  const look = clone(state)
  look.answers[current.id] = normalizeAnswer(current, partial)
  if (current.id === "GEN_BUSINESS_TYPE") {
    look.industry = bank.industry_map[String(look.answers[current.id])] ?? "generic"
  }
  issueNext(look, { now })
  const added = look.askedOrder[state.askedOrder.length]
  if (!added) return { source: "done", questionId: null }
  return { source: look.trace.at(-1)?.source ?? "pool", questionId: added }
}

function substantive(answer: unknown): boolean {
  return answer !== undefined && !isSkipped(answer)
}

export function computeGoalStatus(state: InterviewState): Record<string, GoalStatus> {
  const plan = planFor(state.industry)
  const followups = bank.questions.filter(
    (question) => question.slot_class === "followup" && !question.fallback && substantive(state.answers[question.id]),
  )
  const status: Record<string, GoalStatus> = {}
  for (const goal of Object.keys(bank.goals)) {
    const planned = plan.filter((question) => question.goal === goal)
    const missing = planned.filter((question) => {
      if (substantive(state.answers[question.id])) return false
      const dropped = question.slot != null && state.droppedSlots.includes(question.slot)
      return dropped || isSkipped(state.answers[question.id])
    })
    const answered = planned.filter((question) => substantive(state.answers[question.id])).length
    const followAnswered = followups.filter((question) => question.goal === goal).length
    if (answered + followAnswered > 0 && missing.length > 0) status[goal] = "partial"
    else if (answered + followAnswered > 0) status[goal] = "answered"
    else status[goal] = "deferred"
  }
  return status
}

export function outputRecord(state: InterviewState): OutputRecord {
  return {
    answers: state.answers,
    comments: state.comments,
    industry_tag: state.industry,
    asked_order: state.askedOrder,
    dropped_slots: state.droppedSlots,
    followups_asked: state.followupsAsked,
    followups_skipped: state.followupsSkipped,
    goal_status: computeGoalStatus(state),
  }
}

export function freeTextNotice(question: Question, industry: string): string | undefined {
  const free = question.type === "short_text" || question.type === "long_text" || question.comment_field
  if (industry === "medical_dental" && free) return question.free_text_notice ?? bank.medical_free_text_notice
  return question.free_text_notice
}
