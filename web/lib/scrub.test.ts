import assert from "node:assert/strict"
import { test } from "node:test"
import { hasDisallowedPrice, outgoingQuestion, scrubText } from "./scrub"
import { createInterview } from "./engine"
import { questionById } from "./qbank"

test("blocklist and prices are scrubbed to the fixed fallback", () => {
  const blocked = [
    "What is your password?",
    "Please share the card number on file",
    "What is the SSN for the owner?",
    "The audit is $500",
    "Packages start at $10,000",
  ]
  for (const text of blocked) {
    const result = scrubText(text)
    assert.equal(result.ok, false)
    assert.match(result.text, /one part of the workday/i)
  }
  assert.equal(scrubText("The AI Opportunity Map is $1,000.").ok, true)
  assert.equal(scrubText("The AI Opportunity Map is $1000.").ok, true)
  assert.equal(hasDisallowedPrice("no money here"), false)
})

test("a poisoned outgoing question is replaced before it is shown", () => {
  const question = questionById("GEN_GOALS_90D")
  assert.ok(question)
  const poisoned = { ...question, text: "What is your bank account password?" }
  const state = createInterview()
  const outgoing = outgoingQuestion(poisoned, state)
  assert.equal(outgoing.replaced, true)
  assert.equal(outgoing.question.goal, "G6")
  assert.equal(outgoing.question.id, "SAFE_TIME")
})
