import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { allRules, bank, conventions, questionById, referencedQuestions } from "./qbank"
import { answerQuestion, canIssue, createInterview, outputRecord, planFor } from "./engine"
import type { InterviewState } from "./types"

const contact = {
  full_name: "Ada Lovelace",
  business_name: "Harbor Cafe",
  email: "ada@example.com",
  phone: "9495550100",
  best_time: 1,
  timezone: "America/Los_Angeles",
}

const goals = "We stop answering the same questions twice."

function answerValue(questionId: string): unknown {
  const question = questionById(questionId)
  assert.ok(question)
  if (question.number_fields?.length) return Object.fromEntries(question.number_fields.map((field) => [field.key, 1]))
  if (question.type === "contact_block") return contact
  if (question.type === "multi_choice") return [1]
  if (question.type === "long_text" || question.type === "short_text") return goals
  return 1
}

function answer(state: InterviewState, value: unknown, comment?: string): InterviewState {
  const id = state.currentQuestionId
  assert.ok(id)
  const result = answerQuestion(state, id, value, { now: state.startedAt + 1000, comment })
  assert.equal(result.error, undefined)
  return result.state
}

test("restaurant worked example stays at 10 and logs the skipped child", () => {
  let state = createInterview(1_000)
  assert.equal(state.currentQuestionId, "GEN_BUSINESS_TYPE")
  state = answer(state, 1)
  assert.equal(state.industry, "restaurant")
  assert.equal(state.currentQuestionId, "RST_PAIN")
  state = answer(state, [1, 2])
  assert.equal(state.currentQuestionId, "RST_FU_CALLS")
  state = answer(state, 1)
  assert.equal(state.currentQuestionId, "RST_FU_MISSED")
  state = answer(state, 1)
  assert.equal(state.currentQuestionId, "RST_FU_EVENTS")
  state = answer(state, 15)
  assert.equal(state.currentQuestionId, "GEN_LOCATIONS")
  assert.deepEqual(state.followupsSkipped, ["RST-R3a"])
  state = answer(state, 3)
  assert.equal(state.currentQuestionId, "RST_TEAM")
  state = answer(state, 2)
  assert.equal(state.currentQuestionId, "RST_TOOLS")
  state = answer(state, [1])
  assert.equal(state.currentQuestionId, "GEN_GOALS_90D")
  state = answer(state, goals)
  assert.equal(state.currentQuestionId, "GEN_CONTACT")
  state = answer(state, contact)
  assert.equal(state.completed, true)
  assert.equal(state.askedOrder.length, 10)
  assert.deepEqual(state.askedOrder, [
    "GEN_BUSINESS_TYPE",
    "RST_PAIN",
    "RST_FU_CALLS",
    "RST_FU_MISSED",
    "RST_FU_EVENTS",
    "GEN_LOCATIONS",
    "RST_TEAM",
    "RST_TOOLS",
    "GEN_GOALS_90D",
    "GEN_CONTACT",
  ])
  assert.deepEqual(state.droppedSlots, [9, 8, 7])
  assert.deepEqual(state.followupsAsked, ["RST-R2", "RST-R2a", "RST-R3"])
  assert.equal(state.followupsAsked.length, bank.limits.max_followups)
  assert.ok(state.followupsAsked.length <= bank.limits.max_followups)
  const record = outputRecord(state)
  assert.equal(record.industry_tag, "restaurant")
  assert.equal(record.goal_status.G5, "deferred")
  assert.equal(record.goal_status.G2, "partial")
  assert.equal(record.goal_status.G3, "partial")
  assert.equal(record.goal_status.G6, "answered")
  assert.equal(record.goal_status.G8, "answered")
  assert.equal(state.trace.filter((item) => item.source === "ai").length, 0)
})

test("the hard cap never issues an 11th question", () => {
  let state = createInterview(1_000)
  const script = [8, [2], 1, 4, [1], goals, 1, 1, [1], contact]
  for (const value of script) state = answer(state, value)
  assert.equal(state.askedOrder.length, 10)
  assert.equal(state.completed, true)
  const extra = answerQuestion(state, "GEN_CONTACT", contact, { now: state.startedAt + 1000 })
  assert.equal(extra.state.askedOrder.length, 10)
  const locations = questionById("GEN_LOCATIONS")
  assert.ok(locations)
  assert.equal(canIssue(state, locations), false)
})

test("non-ordinal Not sure does not satisfy option_gte, and locations never fire a rule", () => {
  let state = createInterview(1_000)
  state = answer(state, 8)
  state = answer(state, [2])
  state = answer(state, 2)
  state = answer(state, 3)
  state = answer(state, [1])
  state = answer(state, goals)
  assert.equal(state.currentQuestionId, "GEN_EMAIL_LOAD")
  state = answer(state, 6)
  assert.equal(state.followupsAsked.includes("GEN-R2"), false)
  assert.equal(state.currentQuestionId, "GEN_REVENUE_BAND")
  assert.equal(allRules().some((rule) => referencedQuestions(rule.condition).includes("GEN_LOCATIONS")), false)
  for (const industry of ["generic", "restaurant", "professional_services", "home_services", "medical_dental"]) {
    assert.equal(planFor(industry).some((question) => question.id === "GEN_LOCATIONS"), true)
    assert.equal(planFor(industry).filter((question) => question.slot_class === "core").length, 7)
    assert.equal(planFor(industry).filter((question) => question.slot_class === "flex").length, 3)
  }
})

test("pain option 1 fires the email follow-up immediately and still caps at 10", () => {
  let state = createInterview(1_000)
  state = answer(state, 8)
  state = answer(state, [1])
  assert.equal(state.currentQuestionId, "GEN_FU_EMAIL_TYPES")
  assert.deepEqual(state.droppedSlots, [9])
  assert.equal(state.trace.at(-1)?.source, "rules")
  state = answer(state, [1])
  let guard = 0
  while (!state.completed && guard < 12) {
    const current = state.currentQuestionId
    assert.ok(current)
    const question = questionById(current)
    assert.ok(question)
    const value = answerValue(current)
    state = answer(state, value)
    guard += 1
  }
  assert.equal(state.askedOrder.length, 10)
  assert.ok(state.askedOrder.length <= bank.limits.max_questions)
})

test("a sensitive free-text answer is refused and not stored", () => {
  let state = createInterview(1_000)
  state = answer(state, 8)
  const result = answerQuestion(state, "GEN_PAIN", [9], {
    now: state.startedAt + 1000,
    comment: "password: hunter2",
  })
  assert.equal(result.redacted, true)
  assert.equal(result.state.answers.GEN_PAIN, undefined)
  assert.equal(result.state.comments.GEN_PAIN, undefined)
})

test("a depth-2 child is asked within the follow-up budget", () => {
  let state = createInterview(1_000)
  state = answer(state, 1)
  state = answer(state, [2])
  assert.equal(state.currentQuestionId, "RST_FU_EVENTS")
  state = answer(state, 15)
  assert.equal(state.currentQuestionId, "RST_FU_EVENT_FLOW")
  assert.deepEqual(state.followupsAsked, ["RST-R3", "RST-R3a"])
  const child = allRules().find((rule) => rule.rule_id === "RST-R3a")
  assert.equal(child?.depth, bank.limits.max_chain_depth)
  assert.ok((child?.depth ?? 0) <= 2)
})

test("home services reads the field count on a two-number question", () => {
  let state = createInterview(1_000)
  state = answer(state, 5)
  state = answer(state, [2])
  assert.equal(state.currentQuestionId, "GEN_LOCATIONS")
  state = answer(state, 1)
  assert.equal(state.currentQuestionId, "HOME_TECHS")
  state = answer(state, { field: 5, office: 1 })
  assert.equal(state.currentQuestionId, "HOME_FU_JOBS")
  assert.deepEqual(state.followupsAsked, ["HOME-R6"])
})

test("Diggler's bank is the only question copy", () => {
  const docs = readFileSync(new URL("../../docs/onb1-qbank.v1.1.json", import.meta.url), "utf8")
  const bundled = readFileSync(new URL("../data/onb1-qbank.v1.1.json", import.meta.url), "utf8")
  assert.equal(docs, bundled)
  assert.equal(docs.includes("reconstructed"), false)
  assert.equal(docs.includes("spec-partial"), false)
  const source = JSON.parse(docs) as {
    questions: { id: string; slot?: number | null }[]
    rules_index: { rule_id: string; depth: number; parent_rule?: string }[]
    budget: { max_followups: number; max_chain_depth: number; never_trigger_from_slots: number[] }
    conventions: Record<string, string>
  }
  assert.equal(source.questions.length, 58)
  assert.equal(source.rules_index.length, 30)
  assert.equal(source.budget.max_followups, 3)
  assert.equal(source.budget.max_chain_depth, 2)
  assert.deepEqual(Object.keys(conventions), ["option_ids", "followup_goal_and_required", "child_rule_ids", "swap_ins"])
  assert.equal(allRules().length, 30)
  assert.equal(bank.questions.filter((question) => !question.fallback).length, 58)
  assert.ok(allRules().every((rule) => rule.depth <= 2))
  for (const rule of source.rules_index.filter((item) => item.depth === 2)) {
    assert.equal(rule.rule_id, `${rule.parent_rule}a`)
  }
  for (const rule of allRules()) {
    for (const id of referencedQuestions(rule.condition)) {
      const slot = questionById(id)?.slot
      assert.equal(source.budget.never_trigger_from_slots.includes(slot ?? -1), false)
    }
  }
})

test("time cap ends the interview", () => {
  const state = createInterview(0)
  const result = answerQuestion(state, "GEN_BUSINESS_TYPE", 8, { now: bank.limits.time_cap_ms + 1 })
  assert.equal(result.state.completed, true)
  assert.equal(result.state.endReason, "time_cap")
  assert.equal(result.state.askedOrder.length, 1)
})
