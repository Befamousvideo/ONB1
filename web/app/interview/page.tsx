import type { Metadata } from "next"
import InterviewApp from "./ui"

export const metadata: Metadata = {
  title: "Start your Map",
  description: "A short StorenTech AI interview. Ten questions max, then book a call.",
}

export default function InterviewPage() {
  return (
    <InterviewApp
      privacyUrl={process.env.PRIVACY_POLICY_URL || "https://storentechai.com/privacy"}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
    />
  )
}
