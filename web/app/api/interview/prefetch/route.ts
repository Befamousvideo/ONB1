import { NextResponse } from "next/server"
import { rejectIfLimited, serviceDeps } from "../../../../lib/http"
import { prefetchNext } from "../../../../lib/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; partial?: unknown }
  if (!body.sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 })
  const blocked = await rejectIfLimited(request, body.sessionId)
  if (blocked) return blocked
  const result = await prefetchNext(await serviceDeps(), body.sessionId, body.partial)
  return NextResponse.json(result)
}
