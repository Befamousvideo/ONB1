const hits = new Map<string, number[]>()

export function allowRequest(key: string, limit = 180, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

export function resetRateLimit(): void {
  hits.clear()
}

export async function verifyTurnstile(token: string | undefined, ip: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip })
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
    if (!response.ok) return false
    const payload = (await response.json()) as { success?: boolean }
    return payload.success === true
  } catch {
    return false
  }
}

export function clientIp(header: string | null): string {
  return header?.split(",")[0]?.trim() || "unknown"
}
