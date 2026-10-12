import raw from "../data/onb1-qbank.v1.1.json"
import type { GoalId, QBank, Question, Rule } from "./types"

interface RawRule {
  rule_id: string
  priority: number
  condition: Rule["condition"]
  then: string
  depth?: number
}

interface RawQuestion extends Omit<Question, "followups" | "options" | "comment_field"> {
  options?: Question["options"]
  followups?: RawRule[]
  detail_field?: Question["comment_field"]
  comment_field?: Question["comment_field"]
}

interface RawBank {
  spec_version: string
  conventions: Record<string, string>
  budget: {
    max_questions: number
    max_followups: number
    max_chain_depth: number
    core_slots: number[]
    flex_slots_drop_order: number[]
    on_no_budget: string
  }
  goals: { id: GoalId; goal: string }[]
  industry_map: Record<string, string>
  industries: { tag: string; free_text_notice?: string }[]
  questions: RawQuestion[]
  rules_index: { rule_id: string; depth: number }[]
}

const source = raw as unknown as RawBank

const ruleMeta = new Map(source.rules_index.map((rule, index) => [rule.rule_id, { depth: rule.depth, doc_order: index }]))

function withRuleMeta(rule: RawRule): Rule {
  const meta = ruleMeta.get(rule.rule_id)
  return {
    rule_id: rule.rule_id,
    priority: rule.priority,
    condition: rule.condition,
    then: rule.then,
    depth: meta?.depth ?? (/a$/.test(rule.rule_id) ? 2 : 1),
    doc_order: meta?.doc_order ?? source.rules_index.length,
  }
}

const SAFE_TIME: Question = {
  id: "SAFE_TIME",
  text: "What is the one part of the workday you would most like to take less time?",
  type: "long_text",
  options: [],
  goal: "G6",
  required: true,
  industry_tags: ["generic"],
  slot: null,
  slot_class: "followup",
  followups: [],
  fallback: true,
}

const questions: Question[] = [
  ...source.questions.map((question) => ({
    ...question,
    options: question.options ?? [],
    comment_field: question.comment_field ?? question.detail_field,
    followups: (question.followups ?? []).map(withRuleMeta),
  })),
  SAFE_TIME,
]

export const conventions = source.conventions

export const bank: QBank = {
  spec_version: source.spec_version,
  limits: {
    max_questions: source.budget.max_questions,
    max_followups: source.budget.max_followups,
    max_chain_depth: source.budget.max_chain_depth,
    time_cap_ms: 600_000,
  },
  core_slots: source.budget.core_slots,
  flex_slots_drop_order: source.budget.flex_slots_drop_order,
  on_no_budget: source.budget.on_no_budget,
  industry_map: source.industry_map,
  goals: Object.fromEntries(source.goals.map((goal) => [goal.id, goal.goal])) as QBank["goals"],
  medical_free_text_notice:
    source.industries.find((industry) => industry.tag === "medical_dental")?.free_text_notice ??
    "Please describe how things work. No patient names or health details.",
  questions,
}

const byId = new Map<string, Question>(bank.questions.map((question) => [question.id, question]))

export function questionById(id: string | null | undefined): Question | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function allRules(): Rule[] {
  return bank.questions.flatMap((question) => question.followups ?? [])
}

export function referencedQuestions(condition: Rule["condition"]): string[] {
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

export function confirmationCopy(fullName: string): string {
  const name = fullName.trim().split(/\s+/)[0] || "there"
  return `Thanks, ${name}, you're all set! Here's what happens next: pick a time for a quick call on the calendar below. Someone at StorenTech will personally review your answers before the call. After the call, we'll prepare your AI Opportunity Map.`
}
