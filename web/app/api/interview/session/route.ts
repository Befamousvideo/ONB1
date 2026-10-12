import { NextResponse } from "next/server"
import { rejectIfLimited, serviceDeps } from "../../../../lib/http"
import { getSession } from "../../../../lib/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 })
  const blocked = await rejectIfLimited(request, id)
  if (blocked) return blocked
  const view = await getSession(await serviceDeps(), id)
  if (!view) return NextResponse.json({ error: "Interview not found." }, { status: 404 })
  return NextResponse.json(view)
}
