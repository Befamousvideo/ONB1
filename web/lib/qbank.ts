import raw from "../data/onb1-qbank.v1.1.json"
import type { Condition, QBank, Question, Rule } from "./types"

export const bank = raw as unknown as QBank

const byId = new Map<string, Question>(bank.questions.map((question) => [question.id, question]))

export function questionById(id: string | null | undefined): Question | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function allRules(): Rule[] {
  return bank.questions.flatMap((question) => question.followups ?? [])
}

export function referencedQuestions(condition: Condition): string[] {
  if ("q" in condition && typeof condition.q === "string") return [condition.q]
  if ("any" in condition) return condition.any.flatMap(referencedQuestions)
  if ("all" in condition) return condition.all.flatMap(referencedQuestions)
  if ("not" in condition) return referencedQuestions(condition.not)
  return []
}

export const GOALS = Object.keys(bank.goals)

export const FALLBACK_ID = "SAFE_TIME"

export const DEFAULT_BOOKING_URL = "https://calendar.app.google/7KkoctujrZtnzhjU7"

export const INTRO_COPY =
  "Hi! This takes about 5 minutes: 10 quick questions, max. Your answers help StorenTech AI prepare your AI Opportunity Map, a short list of the places AI can save your business time. A real person at StorenTech reviews everything before we reach out. We only ask about your business, never passwords, card numbers, Social Security numbers, or customer or patient personal details. We use your answers to prepare your Map and to contact you, and we don't sell them."

export function confirmationCopy(firstName: string): string {
  const name = firstName.trim() || "there"
  return `Thanks, ${name}, you're all set! Here's what happens next: pick a time for a quick call on the calendar below. Someone at StorenTech will personally review your answers before the call. After the call, we'll prepare your AI Opportunity Map.`
}
