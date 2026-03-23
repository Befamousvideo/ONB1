"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const STORAGE_KEY = "onb1-local-conversation";
const STEP_ORDER = [
  "WELCOME",
  "MODE_SELECT",
  "IDENTITY",
  "BUSINESS_CONTEXT",
  "NEEDS",
  "SCHEDULING",
  "SUMMARY",
  "SUBMIT",
] as const;
const INDUSTRY_OPTIONS = ["E-commerce", "Healthcare", "Finance", "Real Estate", "Marketing", "SaaS", "Other"];
const COMPANY_SIZE_OPTIONS = ["Just me", "2-10", "11-50", "51-200", "200+"];
const SOLUTION_OPTIONS = [
  "AI Chatbot",
  "Workflow Automation",
  "Data Analysis",
  "Custom AI App",
  "AI Strategy",
  "Content Production",
];
const TIMELINE_OPTIONS = ["ASAP", "This Month", "Next Quarter", "Just Exploring"];
const BUDGET_OPTIONS = ["Under $5k", "$5k-$15k", "$15k-$50k", "$50k+", "Not Sure"];
const CONTACT_OPTIONS = ["Email", "Phone", "Text"];
const TIMEZONE_OPTIONS = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
];

type ConversationState = (typeof STEP_ORDER)[number];

type ConversationMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  created_at: string;
};

type Conversation = {
  id: string;
  status: string;
  state: ConversationState;
  normalized_fields: Record<string, string>;
  messages: ConversationMessage[];
  intake_brief?: {
    summary: string;
    goals: string[];
    constraints: string[];
    recommended_next_steps?: string[];
  } | null;
};

function buildSummary(fields: Record<string, string>) {
  const lines: string[] = [];
  if (fields.full_name) lines.push(`Name: ${fields.full_name}`);
  if (fields.email) lines.push(`Email: ${fields.email}`);
  if (fields.phone) lines.push(`Phone: ${fields.phone}`);
  if (fields.business_name) lines.push(`Business: ${fields.business_name}`);
  if (fields.industry) lines.push(`Industry: ${fields.industry}`);
  if (fields.company_size) lines.push(`Company Size: ${fields.company_size}`);
  if (fields.needs_summary) lines.push(`Need: ${fields.needs_summary}`);
  if (fields.solution_interest) lines.push(`Solution: ${fields.solution_interest}`);
  if (fields.timeline) lines.push(`Timeline: ${fields.timeline}`);
  if (fields.budget_band) lines.push(`Budget: ${fields.budget_band}`);
  if (fields.preferred_times) {
    const timezone = fields.timezone ? ` (${fields.timezone})` : "";
    lines.push(`Availability: ${fields.preferred_times}${timezone}`);
  }
  if (fields.preferred_contact_channel) lines.push(`Preferred Contact: ${fields.preferred_contact_channel}`);
  if (fields.notes) lines.push(`Notes: ${fields.notes}`);
  return lines.join("\n");
}

function selectedStepIndex(state: ConversationState) {
  const index = STEP_ORDER.indexOf(state);
  return index === -1 ? 0 : index;
}

async function parseJson(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    if (detail?.error === "missing_fields" && Array.isArray(detail.fields)) {
      throw new Error(`Missing fields: ${detail.fields.join(", ")}`);
    }
    throw new Error(payload?.detail || payload?.error || "Request failed");
  }
  return payload;
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <div className="chip-row">
        {options.map((option) => (
          <button
            key={option}
            className={option === value ? "chip chip-active" : "chip"}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({
    mode: "prospect",
    timezone:
      typeof window === "undefined"
        ? "America/Los_Angeles"
        : Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
  });
  const [summaryDraft, setSummaryDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const storedConversationId = window.localStorage.getItem(STORAGE_KEY);
    if (storedConversationId) {
      void resumeConversation(storedConversationId);
    }
  }, []);

  useEffect(() => {
    if (!conversation) {
      return;
    }
    setFields((current) => ({ ...current, ...conversation.normalized_fields }));
  }, [conversation]);

  useEffect(() => {
    if (!conversation || conversation.state !== "SUMMARY") {
      return;
    }
    const nextSummary = buildSummary({ ...fields, ...conversation.normalized_fields });
    if (nextSummary && nextSummary !== summaryDraft) {
      setSummaryDraft(nextSummary);
    }
  }, [conversation, fields, summaryDraft]);

  async function resumeConversation(conversationId: string) {
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversationId}`);
      const payload = (await parseJson(response)) as Conversation;
      setConversation(payload);
      setError("");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setConversation(null);
    }
  }

  async function startConversation() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "prospect" }),
      });
      const payload = (await parseJson(response)) as Conversation;
      setConversation(payload);
      window.localStorage.setItem(STORAGE_KEY, payload.id);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function advanceConversation(stepFields: Record<string, string>, content: string) {
    if (!conversation) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversation.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          fields: stepFields,
        }),
      });
      const payload = (await parseJson(response)) as Conversation;
      setConversation(payload);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitIntake() {
    if (!conversation) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversation.id}/end-and-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summaryDraft || buildSummary(fields),
          notes: fields.notes || "",
        }),
      });
      const payload = (await parseJson(response)) as { conversation: Conversation };
      setConversation(payload.conversation);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function resetConversation() {
    window.localStorage.removeItem(STORAGE_KEY);
    setConversation(null);
    setFields({
      mode: "prospect",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
    });
    setSummaryDraft("");
    setError("");
  }

  function renderForm() {
    if (!conversation) {
      return null;
    }

    if (conversation.state === "WELCOME") {
      return (
        <div className="stack">
          <p className="muted-copy">
            Friendly, fast, and local-first. We will capture the essentials first and leave deeper integrations for
            the next pass.
          </p>
          <button className="primary-button" disabled={loading} onClick={() => advanceConversation({}, "Ready to start.")} type="button">
            {loading ? "Starting..." : "Get Started"}
          </button>
        </div>
      );
    }

    if (conversation.state === "MODE_SELECT") {
      return (
        <div className="stack">
          <ChipGroup
            label="Choose a path"
            onChange={(nextValue) => updateField("mode", nextValue === "Existing client" ? "client" : "prospect")}
            options={["New prospect", "Existing client"]}
            value={fields.mode === "client" ? "Existing client" : "New prospect"}
          />
          <button
            className="primary-button"
            disabled={loading}
            onClick={() =>
              advanceConversation(
                { mode: fields.mode === "client" ? "client" : "prospect" },
                fields.mode === "client" ? "Existing client" : "New prospect",
              )
            }
            type="button"
          >
            Continue
          </button>
          {fields.mode === "client" ? (
            <p className="inline-note">Existing-client auth/OAuth is deferred for this MVP. We will route it to manual follow-up.</p>
          ) : null}
        </div>
      );
    }

    if (conversation.state === "IDENTITY") {
      return (
        <div className="stack">
          <label className="field-group">
            <span className="field-label">Full name</span>
            <input className="text-input" onChange={(event) => updateField("full_name", event.target.value)} value={fields.full_name || ""} />
          </label>
          <label className="field-group">
            <span className="field-label">Work email</span>
            <input className="text-input" onChange={(event) => updateField("email", event.target.value)} type="email" value={fields.email || ""} />
          </label>
          <label className="field-group">
            <span className="field-label">Phone (optional)</span>
            <input className="text-input" onChange={(event) => updateField("phone", event.target.value)} value={fields.phone || ""} />
          </label>
          <button
            className="primary-button"
            disabled={loading}
            onClick={() =>
              advanceConversation(
                {
                  full_name: fields.full_name || "",
                  email: fields.email || "",
                  phone: fields.phone || "",
                },
                `${fields.full_name || ""} | ${fields.email || ""}`,
              )
            }
            type="button"
          >
            Continue
          </button>
        </div>
      );
    }

    if (conversation.state === "BUSINESS_CONTEXT") {
      return (
        <div className="stack">
          <label className="field-group">
            <span className="field-label">Business name</span>
            <input
              className="text-input"
              onChange={(event) => updateField("business_name", event.target.value)}
              value={fields.business_name || ""}
            />
          </label>
          <ChipGroup label="Industry" onChange={(nextValue) => updateField("industry", nextValue)} options={INDUSTRY_OPTIONS} value={fields.industry || ""} />
          <ChipGroup
            label="Company size"
            onChange={(nextValue) => updateField("company_size", nextValue)}
            options={COMPANY_SIZE_OPTIONS}
            value={fields.company_size || ""}
          />
          <button
            className="primary-button"
            disabled={loading}
            onClick={() =>
              advanceConversation(
                {
                  business_name: fields.business_name || "",
                  industry: fields.industry || "",
                  company_size: fields.company_size || "",
                },
                `${fields.business_name || ""} | ${fields.industry || ""}`,
              )
            }
            type="button"
          >
            Continue
          </button>
        </div>
      );
    }

    if (conversation.state === "NEEDS") {
      return (
        <div className="stack">
          <label className="field-group">
            <span className="field-label">What do you need help with?</span>
            <textarea
              className="text-area"
              onChange={(event) => updateField("needs_summary", event.target.value)}
              placeholder="Describe the workflow, content, onboarding, or automation result you want."
              rows={5}
              value={fields.needs_summary || ""}
            />
          </label>
          <ChipGroup
            label="Solution interest"
            onChange={(nextValue) => updateField("solution_interest", nextValue)}
            options={SOLUTION_OPTIONS}
            value={fields.solution_interest || ""}
          />
          <ChipGroup label="Timeline" onChange={(nextValue) => updateField("timeline", nextValue)} options={TIMELINE_OPTIONS} value={fields.timeline || ""} />
          <ChipGroup label="Budget" onChange={(nextValue) => updateField("budget_band", nextValue)} options={BUDGET_OPTIONS} value={fields.budget_band || ""} />
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() =>
                advanceConversation(
                  {
                    needs_summary: fields.needs_summary || "",
                    solution_interest: fields.solution_interest || "",
                    timeline: fields.timeline || "",
                    budget_band: fields.budget_band || "",
                    skip_scheduling: "true",
                  },
                  fields.needs_summary || "Skipping scheduling for now.",
                )
              }
              type="button"
            >
              Skip Scheduling
            </button>
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                advanceConversation(
                  {
                    needs_summary: fields.needs_summary || "",
                    solution_interest: fields.solution_interest || "",
                    timeline: fields.timeline || "",
                    budget_band: fields.budget_band || "",
                    skip_scheduling: "false",
                  },
                  fields.needs_summary || "",
                )
              }
              type="button"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (conversation.state === "SCHEDULING") {
      return (
        <div className="stack">
          <label className="field-group">
            <span className="field-label">Preferred times</span>
            <textarea
              className="text-area"
              onChange={(event) => updateField("preferred_times", event.target.value)}
              placeholder="Tue/Thu afternoons, Friday mornings, etc."
              rows={3}
              value={fields.preferred_times || ""}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Timezone</span>
            <select className="text-input" onChange={(event) => updateField("timezone", event.target.value)} value={fields.timezone || "America/Los_Angeles"}>
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <ChipGroup
            label="Preferred contact method"
            onChange={(nextValue) => updateField("preferred_contact_channel", nextValue)}
            options={CONTACT_OPTIONS}
            value={fields.preferred_contact_channel || ""}
          />
          <button
            className="primary-button"
            disabled={loading}
            onClick={() =>
              advanceConversation(
                {
                  preferred_times: fields.preferred_times || "",
                  timezone: fields.timezone || "",
                  preferred_contact_channel: fields.preferred_contact_channel || "",
                },
                fields.preferred_times || "Shared availability",
              )
            }
            type="button"
          >
            Continue
          </button>
        </div>
      );
    }

    if (conversation.state === "SUMMARY") {
      return (
        <div className="stack">
          <label className="field-group">
            <span className="field-label">Draft summary</span>
            <textarea className="text-area text-area-large" onChange={(event) => setSummaryDraft(event.target.value)} rows={10} value={summaryDraft} />
          </label>
          <label className="field-group">
            <span className="field-label">Operator notes (optional)</span>
            <textarea
              className="text-area"
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Anything we should know before follow-up?"
              rows={3}
              value={fields.notes || ""}
            />
          </label>
          <div className="action-row">
            <button className="secondary-button" disabled={loading} onClick={resetConversation} type="button">
              Start Fresh
            </button>
            <button className="primary-button" disabled={loading} onClick={submitIntake} type="button">
              {loading ? "Sending..." : "End & Send Now"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="stack">
        <p className="success-copy">
          Intake captured locally. Slack/OAuth/payment can layer on top after the core flow is stable.
        </p>
        <button className="primary-button" onClick={resetConversation} type="button">
          Start Another Intake
        </button>
      </div>
    );
  }

  const progressValue = conversation ? Math.max(1, selectedStepIndex(conversation.state) + 1) : 1;
  const progressMax = STEP_ORDER.length;

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-mark">ONB1</div>
        <p className="eyebrow">StorenTech AI local-first MVP</p>
        <h1 className="hero-title">Prospect intake that feels personal, fast, and operationally usable.</h1>
        <p className="hero-copy">
          This pass focuses on the core discovery flow: capture who the prospect is, what they need, and how to follow up,
          then keep the handoff ready for operations.
        </p>
        <div className="hero-stats">
          <div className="stat-card">
            <span className="stat-label">Status</span>
            <strong>{conversation ? "In progress" : "Ready"}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Mode</span>
            <strong>{fields.mode === "client" ? "Client placeholder" : "Prospect"}</strong>
          </div>
        </div>
      </section>

      <section className="conversation-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Interview flow</p>
            <h2 className="panel-title">One question at a time</h2>
          </div>
          {hydrated && !conversation ? (
            <button className="primary-button" disabled={loading} onClick={startConversation} type="button">
              {loading ? "Preparing..." : "Launch Intake"}
            </button>
          ) : null}
        </div>

        <div className="progress-strip">
          <div className="progress-bar">
            <span style={{ width: `${(progressValue / progressMax) * 100}%` }} />
          </div>
          <span className="progress-copy">
            Step {progressValue} of {progressMax}
          </span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {!conversation ? (
          <div className="empty-card">
            <p className="empty-title">No active intake yet.</p>
            <p className="muted-copy">Start a fresh conversation or resume one automatically from this browser if it exists.</p>
          </div>
        ) : (
          <>
            <div className="message-stack">
              {conversation.messages.map((message) => (
                <article key={message.id} className={message.role === "user" ? "message-bubble message-user" : "message-bubble"}>
                  <span className="message-role">{message.role === "user" ? "You" : "Guide"}</span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
            <div className="composer-card">{renderForm()}</div>
            {conversation.intake_brief ? (
              <div className="brief-card">
                <span className="field-label">Latest brief summary</span>
                <p>{conversation.intake_brief.summary}</p>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
