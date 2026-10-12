import { FALLBACK_ID, questionById } from "./qbank"
import type { InterviewState, Question } from "./types"

const BLOCKLIST = [
  /password/i,
  /passcode/i,
  /\bpwd\b/i,
  /social security/i,
  /\bssn\b/i,
  /credit card/i,
  /card number/i,
  /\bcvv\b/i,
  /bank account/i,
  /routing number/i,
  /api key/i,
  /secret key/i,
  /date of birth/i,
  /\bdiagnosis\b/i,
  /patient name/i,
  /insurance member/i,
  /member id/i,
]

const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?/g
const ALLOWED_MONEY = /^\$\s?1,?000$/

export function hasDisallowedPrice(text: string): boolean {
  const matches = text.match(MONEY)
  if (!matches) return false
  return matches.some((match) => !ALLOWED_MONEY.test(match.replace(/\s+/g, "")))
}

export function scrubText(text: string): { ok: boolean; text: string } {
  const blocked = BLOCKLIST.some((pattern) => pattern.test(text)) || hasDisallowedPrice(text)
  if (!blocked) return { ok: true, text }
  const fallback = questionById(FALLBACK_ID)
  return { ok: false, text: fallback?.text ?? "What is the one part of the workday you would most like to take less time?" }
}

export function personalize(text: string, state: InterviewState): string {
  const contact = state.answers.GEN_CONTACT
  let name = ""
  if (contact && typeof contact === "object") {
    const record = contact as { full_name?: unknown; first_name?: unknown }
    const full = typeof record.full_name === "string" ? record.full_name.trim() : ""
    const first = typeof record.first_name === "string" ? record.first_name.trim() : ""
    name = (full || first).split(/\s+/)[0] ?? ""
  }
  return text.replaceAll("{first_name}", name || "there")
}

export function outgoingQuestion(question: Question, state: InterviewState): {
  question: Question
  text: string
  replaced: boolean
} {
  const text = personalize(question.text, state)
  const scrubbed = scrubText(text)
  if (scrubbed.ok) return { question, text: scrubbed.text, replaced: false }
  const fallback = questionById(FALLBACK_ID) ?? question
  return { question: fallback, text: personalize(fallback.text, state), replaced: true }
}
