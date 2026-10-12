import assert from "node:assert/strict"
import { test } from "node:test"
import { suggestNext, type SuggestInput } from "./ai"
import { createDebounced } from "./debounce"
import { answerQuestion, createInterview, predictNext } from "./engine"
import { memoryStore } from "./store"
import { prefetchNext, startSession, submitAnswer } from "./service"
import type { InterviewState } from "./types"

const contact = {
  first_name: "Ada",
  email: "ada@example.com",
  phone: "9495550100",
  business_name: "Harbor Cafe",
}

function answer(state: InterviewState, value: unknown): InterviewState {
  const id = state.currentQuestionId
  assert.ok(id)
  const result = answerQuestion(state, id, value, { now: state.startedAt + 1000 })
  assert.equal(result.error, undefined)
  return result.state
}

function walkToGoals(): InterviewState {
  let state = createInterview(5_000)
  state = answer(state, 8)
  state = answer(state, [2])
  state = answer(state, 1)
  state = answer(state, 4)
  state = answer(state, [1])
  assert.equal(state.currentQuestionId, "GEN_GOALS_90D")
  return state
}

test("debounce keeps only the latest partial", async () => {
  const calls: string[] = []
  const pending: Array<() => void> = []
  const schedule = (callback: () => void) => {
    pending.push(callback)
    return pending.length
  }
  const cancel = (handle: unknown) => {
    pending[Number(handle) - 1] = () => undefined
  }
  const send = createDebounced((value: string) => calls.push(value), 400, schedule, cancel)
  send("a")
  send("ab")
  send("inbox")
  pending.forEach((callback) => callback())
  assert.deepEqual(calls, ["inbox"])
})

test("prefetch uses a ready AI choice and the answer path does not call the model", async () => {
  const store = memoryStore()
  let calls = 0
  const suggest = async (_input: SuggestInput) => {
    calls += 1
    return { next_question: "Which description is closest to yearly revenue?", goal_id: "G2" as const, done: false }
  }
  const deps = { store, suggest, now: () => 5_000 }
  const started = await startSession(deps)
  let view = started
  const steps: unknown[] = [8, [2], 1, 4, [1]]
  for (const step of steps) {
    assert.ok(view.question)
    view = await submitAnswer(deps, view.sessionId, view.question.id, step)
  }
  assert.equal(view.question?.id, "GEN_GOALS_90D")
  assert.equal(calls, 0)
  const warmed = await prefetchNext(deps, view.sessionId, 1)
  assert.equal(calls, 1)
  assert.equal(warmed.source, "ai")
  assert.equal(warmed.questionId, "GEN_REVENUE")
  view = await submitAnswer(deps, view.sessionId, "GEN_GOALS_90D", 1)
  assert.equal(calls, 1)
  assert.equal(view.question?.id, "GEN_REVENUE")
  assert.equal(view.question?.source, "ai")
})

test("without a key the interview finishes on rules and the pool", async () => {
  const previous = process.env.XAI_API_KEY
  delete process.env.XAI_API_KEY
  let fetches = 0
  const suggestion = await suggestNext(
    { industry: "generic", answers: {}, partial: "inbox", eligible: [] },
    (async () => {
      fetches += 1
      throw new Error("network")
    }) as typeof fetch,
  )
  assert.equal(suggestion, null)
  assert.equal(fetches, 0)

  const store = memoryStore()
  let calls = 0
  const deps = {
    store,
    now: () => 5_000,
    suggest: async () => {
      calls += 1
      return null
    },
  }
  let view = await startSession(deps)
  const script: unknown[] = [8, [2], 1, 4, [1], 1, 2, 1, 1, contact]
  const sources: string[] = []
  for (const step of script) {
    assert.ok(view.question)
    sources.push(view.question.source)
    view = await submitAnswer(deps, view.sessionId, view.question.id, step)
    assert.equal(view.error, undefined)
  }
  assert.equal(view.phase, "done")
  assert.equal(calls, 0)
  assert.equal(sources.includes("ai"), false)
  assert.ok(sources.includes("pool"))
  assert.ok(sources.includes("starter"))
  if (previous) process.env.XAI_API_KEY = previous
})

test("an AI miss falls back to the pool question without waiting", () => {
  const state = walkToGoals()
  const prediction = predictNext(state, 1, state.startedAt + 1000)
  assert.equal(prediction.source, "pool")
  assert.equal(prediction.questionId, "GEN_EMAIL_LOAD")
  const issued = answerQuestion(state, "GEN_GOALS_90D", 1, { now: state.startedAt + 1000, aiQuestionId: null })
  assert.equal(issued.state.currentQuestionId, "GEN_EMAIL_LOAD")
  assert.equal(issued.state.trace.at(-1)?.source, "pool")
})
