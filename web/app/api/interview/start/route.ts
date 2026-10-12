import { NextResponse } from "next/server"
import { rejectIfLimited, serviceDeps } from "../../../../lib/http"
import { startSession } from "../../../../lib/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { turnstileToken?: string }
  const blocked = await rejectIfLimited(request, undefined, body.turnstileToken, true)
  if (blocked) return blocked
  const view = await startSession(await serviceDeps())
  return NextResponse.json(view)
}
