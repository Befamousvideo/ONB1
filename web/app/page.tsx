import Link from "next/link"
import { DEFAULT_BOOKING_URL } from "../lib/qbank"

export default function StartYourMapPage() {
  const bookingUrl = process.env.BOOKING_URL || DEFAULT_BOOKING_URL
  return (
    <main className="page-shell interview-shell">
      <section className="hero-panel">
        <p className="eyebrow">StorenTech AI</p>
        <h1 className="panel-title">Start your Map</h1>
        <p className="lede">
          Tell us a little about the business, or go straight to the calendar. Either way, a person at StorenTech reviews
          the next step before anyone reaches out.
        </p>
        <div className="choice-row">
          <Link className="primary-button" href="/interview">
            Answer a few quick questions first
          </Link>
          <a className="secondary-button" href={bookingUrl}>
            Skip the questions and schedule a call
          </a>
        </div>
        <p className="muted-copy">Up to 10 questions, about 5 minutes. The booking page collects name, email, phone, and business name.</p>
      </section>
    </main>
  )
}
