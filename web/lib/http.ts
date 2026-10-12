import { NextResponse } from "next/server"
import { allowRequest, clientIp, verifyTurnstile } from "./guard"
import { getStore } from "./store"
import type { ServiceDeps } from "./service"

export async function serviceDeps(): Promise<ServiceDeps> {
  return { store: await getStore() }
}

export async function rejectIfLimited(request: Request, sessionId?: string, turnstileToken?: string, checkTurnstile = false): Promise<NextResponse | null> {
  const ip = clientIp(request.headers.get("x-forwarded-for"))
  if (!allowRequest(`ip:${ip}`) || (sessionId && !allowRequest(`session:${sessionId}`))) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 })
  }
  if (checkTurnstile && !(await verifyTurnstile(turnstileToken, ip))) {
    return NextResponse.json({ error: "Please confirm you are a person and try again." }, { status: 403 })
  }
  return null
}
