import assert from "node:assert/strict"
import { test } from "node:test"
import { allowRequest, resetRateLimit, verifyTurnstile } from "./guard"

test("rate limit blocks a burst and turnstile is off without a secret", async () => {
  resetRateLimit()
  for (let index = 0; index < 3; index += 1) assert.equal(allowRequest("session:test", 3, 60_000, 1_000), true)
  assert.equal(allowRequest("session:test", 3, 60_000, 1_000), false)
  const previous = process.env.TURNSTILE_SECRET_KEY
  delete process.env.TURNSTILE_SECRET_KEY
  assert.equal(await verifyTurnstile(undefined, "127.0.0.1"), true)
  process.env.TURNSTILE_SECRET_KEY = "secret"
  assert.equal(await verifyTurnstile(undefined, "127.0.0.1"), false)
  if (previous) process.env.TURNSTILE_SECRET_KEY = previous
  else delete process.env.TURNSTILE_SECRET_KEY
})
