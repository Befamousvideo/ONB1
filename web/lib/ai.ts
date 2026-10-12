import { bank, questionById } from "./qbank"
import { scrubText } from "./scrub"
import type { GoalId, Question } from "./types"

export interface AiSuggestion {
  next_question: string
  goal_id: GoalId
  done: boolean
}

export interface SuggestInput {
  industry: string
  answers: Record<string, unknown>
  partial: unknown
  eligible: { id: string; goal: string; text: string }[]
}

const DEFAULT_MODEL = "grok-4-fast-non-reasoning"
const DEFAULT_BASE = "https://api.x.ai/v1"

export function aiConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY)
}

function parseSuggestion(content: string): AiSuggestion | null {
  const trimmed = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const record = parsed as Record<string, unknown>
  const goal = record.goal_id
  if (typeof record.next_question !== "string" || typeof goal !== "string" || !(goal in bank.goals)) return null
  if (typeof record.done !== "boolean") return null
  return { next_question: record.next_question, goal_id: goal as GoalId, done: record.done }
}

export async function suggestNext(input: SuggestInput, fetchImpl: typeof fetch = fetch): Promise<AiSuggestion | null> {
  const key = process.env.XAI_API_KEY
  if (!key) return null
  const model = process.env.XAI_MODEL || DEFAULT_MODEL
  const base = (process.env.XAI_API_BASE || DEFAULT_BASE).replace(/\/$/, "")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You choose the next ONB1 discovery question. Reply with JSON only: {\"next_question\": string, \"goal_id\": \"G1\"|\"G2\"|\"G3\"|\"G4\"|\"G5\"|\"G6\"|\"G7\"|\"G8\", \"done\": boolean}. Pick from the eligible list. You may lightly personalize wording. Do not add questions, change options, or change the meaning. Never ask for passwords, card numbers, Social Security numbers, patient details, or prices other than the published $1,000 Map. done may be true only when the eligible list has no core questions left.",
          },
          {
            role: "user",
            content: JSON.stringify({
              industry: input.industry,
              answers: input.answers,
              partial_answer: input.partial,
              eligible: input.eligible,
            }),
          },
        ],
      }),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = body.choices?.[0]?.message?.content
    if (typeof content !== "string") return null
    return parseSuggestion(content)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function mapSuggestion(suggestion: AiSuggestion | null, eligible: Question[]): Question | null {
  if (!suggestion) return null
  if (!scrubText(suggestion.next_question).ok) return null
  const matches = eligible.filter((question) => question.goal === suggestion.goal_id)
  if (matches.length === 1) return matches[0]
  const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const wanted = norm(suggestion.next_question)
  return (
    matches.find((question) => {
      const bankText = norm(question.text)
      return bankText === wanted || wanted.includes(bankText.slice(0, 40))
    }) ?? null
  )
}

export function eligiblePrompt(questions: Question[]): { id: string; goal: string; text: string }[] {
  return questions.map((question) => ({
    id: question.id,
    goal: question.goal,
    text: questionById(question.id)?.text ?? question.text,
  }))
}
