import { NextResponse } from "next/server"
import { rejectIfLimited, serviceDeps } from "../../../../lib/http"
import { submitAnswer } from "../../../../lib/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string
    questionId?: string
    answer?: unknown
    comment?: string
  }
  if (!body.sessionId || !body.questionId) {
    return NextResponse.json({ error: "sessionId and questionId are required." }, { status: 400 })
  }
  const blocked = await rejectIfLimited(request, body.sessionId)
  if (blocked) return blocked
  const view = await submitAnswer(await serviceDeps(), body.sessionId, body.questionId, body.answer, body.comment)
  const status = view.error === "Interview not found." ? 404 : 200
  return NextResponse.json(view, { status })
}
