"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "onb1-local-conversation";
const STEP_ORDER = [
  "WELCOME",
  "MODE_SELECT",
  "IDENTITY",
  "BUSINESS_CONTEXT",
  "ARCHETYPE",
  "PAIN_POINTS",
  "SCHEDULING",
  "SUMMARY",
  "SUBMIT",
] as const;

const ROLE_ADMIN = "Admin / Ops";
const ROLE_CEO = "Owner / CEO";
const ROLE_SALES = "Sales";
const ROLE_HR = "HR / People";
const ROLE_FINANCE = "Finance";
const ROLE_FOH = "Front of house";
const ROLE_BOH = "Back of house / Ops floor";
const ROLE_OTHER = "Other / several seats";
const ROLE_EVALUATING = "I’m evaluating";

const STAFF_ROLE_OPTIONS = [
  ROLE_CEO,
  ROLE_ADMIN,
  ROLE_SALES,
  ROLE_HR,
  ROLE_FINANCE,
  ROLE_FOH,
  ROLE_BOH,
  ROLE_OTHER,
];
const PROSPECT_ROLE_OPTIONS = [ROLE_CEO, ROLE_EVALUATING];

const COMPANY_SIZE_OPTIONS = ["Just me", "2–10", "11–50", "51–200", "200+"];
const CONTACT_OPTIONS = ["Email", "Phone", "Text"];
const TIMEZONE_OPTIONS = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
];
const STAFF_PAIN_OPTIONS = [
  "Missed calls or leads",
  "Slow follow-up",
  "Too much admin / paperwork",
  "Scheduling / booking friction",
  "Chasing cold or stale follow-ups",
  "Training gaps / tribal knowledge",
  "Support or inbox overload",
  "Handoffs break between people/tools",
];
const STAFF_RESULT_OPTIONS = [
  "Fewer dropped conversations",
  "Less admin",
  "Clearer customer experience",
  "Smoother day-to-day ops",
  "Same headcount, less scramble",
];
const PROSPECT_PAIN_OPTIONS = STAFF_PAIN_OPTIONS;
const PROSPECT_RESULT_OPTIONS = [
  "More booked jobs/revenue",
  "Less admin",
  "Better CX",
  "Smoother ops",
  "Grow without adding headcount",
];
const BUDGET_OPTIONS = ["Under $5k", "$5k–$15k", "$15k–$50k", "$50k+", "Not sure"];
const TIMELINE_OPTIONS = ["ASAP", "This month", "Next quarter", "Just exploring"];

const ARCHETYPES: { label: string; subtypes: string[] }[] = [
  {
    label: "Emergency Field Service",
    subtypes: [
      "Plumbing",
      "HVAC",
      "Electrical",
      "Locksmith",
      "Water / fire restoration",
      "Garage door",
      "Appliance repair",
      "Roofing emergency repair",
      "Drain / sewer specialists",
    ],
  },
  {
    label: "Project-Based Contractors",
    subtypes: [
      "General contractors",
      "Remodelers",
      "Kitchen / bath",
      "Roofing replacement",
      "Solar installers",
      "Flooring",
      "Painting contractors",
      "Masonry / concrete",
      "Windows / doors",
      "Fencing",
      "Home improvement specialists",
    ],
  },
  {
    label: "Recurring Route Service Businesses",
    subtypes: [
      "Pool service",
      "Landscaping",
      "Pest control",
      "Janitorial / cleaning",
      "Tree care",
      "Irrigation",
      "Pressure washing",
      "Lawn care",
      "Window washing",
    ],
  },
  {
    label: "Reservation / Order / Guest-Service Businesses",
    subtypes: [
      "Restaurants",
      "QSR / fast casual",
      "Pizza / delivery",
      "Cafes / bakeries",
      "Catering companies",
      "Bars / lounges",
      "Hospitality venues",
      "Boutique hotels",
      "Resorts",
      "Event venues",
    ],
  },
  {
    label: "Storefront Retail",
    subtypes: [
      "Apparel stores",
      "Specialty gift shops",
      "Jewelry",
      "Beauty / cosmetics",
      "Home decor",
      "Furniture showrooms",
      "Markets / specialty grocers",
      "Pet retail",
      "Hobby / specialty stores",
    ],
  },
  {
    label: "Ecommerce / Online Retail",
    subtypes: [
      "DTC brand",
      "Dropshipper",
      "Amazon / marketplace seller",
      "Distributor ecommerce portal",
      "Subscription ecommerce",
      "High-ticket online seller",
      "Catalog / multi-SKU seller",
      "Hybrid online + local retail",
    ],
  },
  {
    label: "RFQ / Quote / Spec-Driven B2B",
    subtypes: [
      "Custom fabrication shops",
      "OEM / private-label manufacturers",
      "Contract manufacturers",
      "Industrial parts suppliers",
      "Assemblers",
      "Packaging companies",
      "Wholesale distributors",
      "Job shops",
      "Small / medium manufacturers selling B2B",
    ],
  },
  {
    label: "Membership / Booking / Class-Based Facilities",
    subtypes: [
      "Golf clubs",
      "Country clubs",
      "Tennis / pickleball clubs",
      "Gyms",
      "Fitness studios",
      "Sports academies",
      "Lesson providers",
      "Camps",
      "Tutoring centers",
      "Private schools",
      "Class-based enrichment businesses",
    ],
  },
  {
    label: "High-Trust / Document-Heavy / Regulated Businesses",
    subtypes: [
      "Dental",
      "Medical practice",
      "Med spa / aesthetics",
      "Chiropractic",
      "Physical therapy",
      "Legal",
      "Accounting / bookkeeping",
      "Insurance agency",
      "Wealth / financial advisory",
      "Real estate brokerage",
      "Property management",
    ],
  },
];
const FEATURED_ARCHETYPES = ARCHETYPES.slice(0, 4).map((item) => item.label);

const PAIN_Q_BY_ROLE: Record<string, string> = {
  [ROLE_CEO]: "Where does the business feel the most drag — growth, follow-through, or ops overhead?",
  [ROLE_HR]: "Where do people workflows get stuck or eat the day?",
  [ROLE_SALES]: "Where do conversations stall or get dropped after first contact?",
  [ROLE_FINANCE]: "Where do money workflows create chase, errors, or delays?",
  [ROLE_ADMIN]: "Where does work bounce between people or tools?",
  [ROLE_FOH]: "Where do customer-facing moments go sideways?",
  [ROLE_BOH]: "Where does floor work stall or lose the handoff?",
};

const RESULT_Q_BY_ROLE: Record<string, string> = {
  [ROLE_CEO]: "What would make this ROIA most useful for decisions in the next quarter?",
  [ROLE_HR]: "What would help your people operation most as we map the ROIA?",
  [ROLE_SALES]: "What would help sales follow-through most in discovery?",
  [ROLE_FINANCE]: "What would clean up finance workflows most if we got it right?",
  [ROLE_ADMIN]: "What would make day-to-day ops calmer?",
  [ROLE_FOH]: "What would make the front-of-house day smoother?",
  [ROLE_BOH]: "What would make back-of-house execution cleaner?",
};

const COPY = {
  staff: {
    eyebrow: "Company ROIA · discovery",
    brand_kicker: "Save progress · finish on your phone",
    hero_title: "Your seat. Your workflow. Clear answers for the ROIA.",
    hero_copy:
      "Your company already engaged StorenTech for an Automation ROI Analysis. This is discovery — not a sales pitch. Answer from your seat so the analysis is accurate. Pause anytime.",
    cta_start: "Begin discovery",
    empty_title: "When you’re ready, start discovery. Pause and resume anytime.",
    submit_done: "Thank you. Your answers are with the ROIA team for discovery.",
    client_portal_note: "Filed to your company’s ROIA workspace. Portal comes later.",
    stat_followup_label: "Your answers help",
    stat_followup_value: "the ROIA team",
    contact_q: "How do customers or requests usually reach your area first?",
    workflow_q: "Describe a workflow in your seat that burns time or drops the ball.",
    scheduling_intro:
      "Prefer to finish later? Save and come back anytime. If your ROIA lead wants a live follow-up, Orange County in-person is usually Mon–Thu 9 AM–3 PM; phone/video Mon–Thu 8 AM–4 PM.",
    skip: "Skip for now — I’ll finish on my own.",
    summary_help: "Anything else that would help the ROIA team understand your seat.",
  },
  prospect: {
    eyebrow: "StorenTech AI · Automation ROI Analysis",
    brand_kicker: "~3–8 minutes · save and continue later",
    hero_title: "See where AI should earn its keep — before you hire it",
    hero_copy:
      "StorenTech AI is a full-service AI agency. Every engagement starts with a paid Automation ROI Analysis. Share how the business runs and where follow-through breaks — we’ll use that to scope a serious first conversation. No fake free audit.",
    cta_start: "Start",
    empty_title: "Ready when you are. You can pause and finish later.",
    submit_done: "You’re all set. We’ll review this and follow up on next steps for an Automation ROI Analysis.",
    client_portal_note: "Routed to the StorenTech team for follow-up.",
    stat_followup_label: "Next step",
    stat_followup_value: "a serious conversation",
    contact_q: "How do customers usually first contact you?",
    workflow_q: "Describe the workflow or problem you want clearer before an ROI analysis.",
    scheduling_intro:
      "In-person in Orange County Mon–Thu 9 AM–3 PM; phone/video Mon–Thu 8 AM–4 PM. Prefer a time to talk, or skip and we’ll email.",
    skip: "Skip and we’ll email",
    summary_help: "Anything else that would help us prepare a sharper first conversation.",
  },
} as const;

type AudienceMode = keyof typeof COPY;
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
  state: string;
  normalized_fields: Record<string, string>;
  messages: ConversationMessage[];
  intake_brief?: {
    summary: string;
    goals: string[];
    constraints: string[];
    recommended_next_steps?: string[];
  } | null;
};

function readModeFromSearch(): AudienceMode {
  if (typeof window === "undefined") {
    return "staff";
  }
  return new URLSearchParams(window.location.search).get("mode") === "prospect" ? "prospect" : "staff";
}

function writeModeToSearch(mode: AudienceMode) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function canonicalMode(value?: string | null): AudienceMode {
  return value === "prospect" ? "prospect" : "staff";
}

function normalizeState(state: string): ConversationState {
  if (state === "NEEDS") {
    return "PAIN_POINTS";
  }
  return (STEP_ORDER.includes(state as ConversationState) ? state : "WELCOME") as ConversationState;
}

function staffRoleKey(role?: string) {
  if (!role || role === ROLE_OTHER || role === ROLE_EVALUATING) {
    return ROLE_ADMIN;
  }
  return PAIN_Q_BY_ROLE[role] ? role : ROLE_ADMIN;
}

function buildSummary(fields: Record<string, string>) {
  const prospect = canonicalMode(fields.mode) === "prospect";
  const lines: string[] = [];
  if (fields.full_name) lines.push(`Name: ${fields.full_name}`);
  if (fields.email) lines.push(`Email: ${fields.email}`);
  if (fields.phone) lines.push(`Phone: ${fields.phone}`);
  if (fields.role) lines.push(`Seat: ${fields.role}`);
  if (fields.company_location) lines.push(`Company / location: ${fields.company_location}`);
  if (fields.business_name) lines.push(`Company: ${fields.business_name}`);
  if (fields.business_url) lines.push(`Website: ${fields.business_url}`);
  if (fields.archetype) lines.push(`Category: ${fields.archetype}`);
  if (fields.subtypes) lines.push(`Work types: ${fields.subtypes}`);
  if (fields.company_size) lines.push(`Team / area size: ${fields.company_size}`);
  if (fields.first_contact) lines.push(`How work arrives: ${fields.first_contact}`);
  if (fields.pain_points) lines.push(`Where work gets stuck: ${fields.pain_points}`);
  if (fields.result_priority) lines.push(`What would help most: ${fields.result_priority}`);
  if (fields.needs_summary) lines.push(`Workflow: ${fields.needs_summary}`);
  if (prospect && fields.timeline) lines.push(`Timing: ${fields.timeline}`);
  if (prospect && fields.budget_band) lines.push(`Budget: ${fields.budget_band}`);
  if (fields.preferred_times) {
    const timezone = fields.timezone ? ` (${fields.timezone})` : "";
    lines.push(`Availability: ${fields.preferred_times}${timezone}`);
  }
  if (fields.preferred_contact_channel) lines.push(`Best way to reach you: ${fields.preferred_contact_channel}`);
  if (fields.notes) lines.push(`Notes: ${fields.notes}`);
  return lines.join("\n");
}

function selectedStepIndex(state: ConversationState) {
  const index = STEP_ORDER.indexOf(state);
  return index === -1 ? 0 : index;
}

function getApiBase() {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
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
  multi = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  multi?: boolean;
}) {
  const selected = multi
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <div className="chip-row">
        {options.map((option) => {
          const active = multi ? selected.includes(option) : option === value;
          return (
            <button
              key={option}
              className={active ? "chip chip-active" : "chip"}
              onClick={() => {
                if (!multi) {
                  onChange(option);
                  return;
                }
                const next = selected.includes(option)
                  ? selected.filter((item) => item !== option)
                  : [...selected, option];
                onChange(next.join(", "));
              }}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function defaultFields(mode: AudienceMode): Record<string, string> {
  return {
    mode,
    timezone:
      typeof window === "undefined"
        ? "America/Los_Angeles"
        : Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
  };
}

export default function HomePage() {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("staff");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [fields, setFields] = useState<Record<string, string>>(defaultFields("staff"));
  const [summaryDraft, setSummaryDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const activeMode = canonicalMode(fields.mode || audienceMode);
  const copy = COPY[activeMode];
  const currentState = conversation ? normalizeState(conversation.state) : "WELCOME";
  const selectedArchetype = ARCHETYPES.find((item) => item.label === fields.archetype);
  const visibleCategories = showAllCategories
    ? ARCHETYPES.map((item) => item.label)
    : FEATURED_ARCHETYPES;

  const themes = useMemo(() => {
    return [fields.pain_points, fields.result_priority, fields.archetype].filter(Boolean);
  }, [fields.archetype, fields.pain_points, fields.result_priority]);

  useEffect(() => {
    const initialMode = readModeFromSearch();
    setAudienceMode(initialMode);
    setFields(defaultFields(initialMode));
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
    const nextMode = canonicalMode(conversation.normalized_fields.mode);
    setAudienceMode(nextMode);
    writeModeToSearch(nextMode);
  }, [conversation]);

  useEffect(() => {
    if (!conversation || normalizeState(conversation.state) !== "SUMMARY") {
      return;
    }
    const nextSummary = buildSummary({ ...fields, ...conversation.normalized_fields });
    if (nextSummary && nextSummary !== summaryDraft) {
      setSummaryDraft(nextSummary);
    }
  }, [conversation, fields, summaryDraft]);

  function chooseAudience(nextMode: AudienceMode) {
    setAudienceMode(nextMode);
    setFields((current) => {
      const nextRole = current.role || "";
      const allowed = nextMode === "prospect" ? PROSPECT_ROLE_OPTIONS : STAFF_ROLE_OPTIONS;
      return {
        ...current,
        mode: nextMode,
        role: allowed.includes(nextRole) ? nextRole : "",
      };
    });
    writeModeToSearch(nextMode);
  }

  async function resumeConversation(conversationId: string) {
    try {
      const response = await fetch(`${getApiBase()}/api/conversations/${conversationId}`);
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
      const response = await fetch(`${getApiBase()}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: activeMode }),
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
      const response = await fetch(`${getApiBase()}/api/conversations/${conversation.id}/message`, {
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

  async function submitAnswers() {
    if (!conversation) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${getApiBase()}/api/conversations/${conversation.id}/end-and-send`, {
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
    setFields(defaultFields(audienceMode));
    setSummaryDraft("");
    setError("");
  }

  function renderForm() {
    if (!conversation) {
      return null;
    }

    if (currentState === "WELCOME") {
      return (
        <div className="stack">
          <p className="muted-copy">
            {activeMode === "staff"
              ? "Answer from your seat. You can pause anytime and finish tomorrow or on your phone."
              : "Short path so we understand the business before an Automation ROI Analysis."}
          </p>
          <button
            className="primary-button"
            disabled={loading}
            onClick={() => advanceConversation({ mode: activeMode }, "Ready to start.")}
            type="button"
          >
            {loading ? "Starting…" : "Continue"}
          </button>
        </div>
      );
    }

    if (currentState === "MODE_SELECT") {
      const roleOptions = activeMode === "prospect" ? PROSPECT_ROLE_OPTIONS : STAFF_ROLE_OPTIONS;
      return (
        <div className="stack">
          <ChipGroup
            label="How are you joining today?"
            onChange={(nextValue) => chooseAudience(nextValue.includes("exploring") ? "prospect" : "staff")}
            options={[
              "I’m on a company ROIA (team member)",
              "I’m exploring StorenTech for my company",
            ]}
            value={
              activeMode === "prospect"
                ? "I’m exploring StorenTech for my company"
                : "I’m on a company ROIA (team member)"
            }
          />
          <p className="hint-copy">
            {activeMode === "staff"
              ? "You’ll answer from your seat to help discovery."
              : "Short path so we understand your business before an Automation ROI Analysis."}
          </p>
          <ChipGroup
            label={activeMode === "staff" ? "I work in…" : "I’m joining as…"}
            onChange={(nextValue) => updateField("role", nextValue)}
            options={roleOptions}
            value={fields.role || ""}
          />
          {activeMode === "staff" ? <p className="hint-copy">We’ll tune the questions to your seat.</p> : null}
          <button
            className="primary-button"
            disabled={loading || !fields.role}
            onClick={() =>
              advanceConversation(
                { mode: activeMode, role: fields.role || (activeMode === "prospect" ? ROLE_CEO : ROLE_ADMIN) },
                fields.role || (activeMode === "staff" ? ROLE_ADMIN : ROLE_CEO),
              )
            }
            type="button"
          >
            Continue
          </button>
        </div>
      );
    }

    if (currentState === "IDENTITY") {
      return (
        <div className="stack">
          <label className="field-group">
            <span className="field-label">{activeMode === "staff" ? "Your name" : "Your name"}</span>
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
          <label className="field-group">
            <span className="field-label">Company or location (if you have more than one) — optional</span>
            <input
              className="text-input"
              onChange={(event) => updateField("company_location", event.target.value)}
              value={fields.company_location || ""}
            />
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
                  company_location: fields.company_location || "",
                  mode: activeMode,
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

    if (currentState === "BUSINESS_CONTEXT") {
      return (
        <div className="stack">
          <p className="muted-copy">
            {activeMode === "staff"
              ? "Confirm a few basics so we file your answers with the right ROIA."
              : "Tell us about the business — name, scale, how work is organized."}
          </p>
          <label className="field-group">
            <span className="field-label">Company name</span>
            <input
              className="text-input"
              onChange={(event) => updateField("business_name", event.target.value)}
              value={fields.business_name || ""}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Company website (optional)</span>
            <input
              className="text-input"
              onChange={(event) => updateField("business_url", event.target.value)}
              value={fields.business_url || ""}
            />
          </label>
          <ChipGroup
            label="About how many people on your team or in your area?"
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
                  business_url: fields.business_url || "",
                  company_size: fields.company_size || "",
                },
                `${fields.business_name || ""} | ${fields.company_size || ""}`,
              )
            }
            type="button"
          >
            Continue
          </button>
        </div>
      );
    }

    if (currentState === "ARCHETYPE") {
      return (
        <div className="stack">
          <p className="hint-copy">If we guessed your company’s category, confirm or correct it. Closest fit is fine.</p>
          <ChipGroup
            label="Company category"
            onChange={(nextValue) => {
              updateField("archetype", nextValue);
              updateField("subtypes", "");
            }}
            options={visibleCategories}
            value={fields.archetype || ""}
          />
          <button className="secondary-button" onClick={() => setShowAllCategories((current) => !current)} type="button">
            {showAllCategories ? "Show fewer categories" : "Show all categories"}
          </button>
          {selectedArchetype ? (
            <ChipGroup
              label="What kind of work, specifically? Choose every type of work that applies to your seat."
              multi
              onChange={(nextValue) => updateField("subtypes", nextValue)}
              options={selectedArchetype.subtypes}
              value={fields.subtypes || ""}
            />
          ) : null}
          <button
            className="primary-button"
            disabled={loading || !fields.archetype}
            onClick={() =>
              advanceConversation(
                {
                  archetype: fields.archetype || "",
                  subtypes: fields.subtypes || "",
                },
                fields.archetype || "",
              )
            }
            type="button"
          >
            Continue
          </button>
        </div>
      );
    }

    if (currentState === "PAIN_POINTS") {
      const roleKey = staffRoleKey(fields.role);
      const painQuestion =
        activeMode === "prospect"
          ? "What’s the biggest operational drag right now?"
          : PAIN_Q_BY_ROLE[roleKey];
      const resultQuestion =
        activeMode === "prospect"
          ? "What result matters most in the next 90 days?"
          : RESULT_Q_BY_ROLE[roleKey];
      const painPayload = {
        first_contact: fields.first_contact || "",
        pain_points: fields.pain_points || "",
        result_priority: fields.result_priority || "",
        needs_summary: fields.needs_summary || "",
        notes: fields.notes || "",
        ...(activeMode === "prospect"
          ? { budget_band: fields.budget_band || "", timeline: fields.timeline || "" }
          : {}),
      };

      return (
        <div className="stack">
          <label className="field-group">
            <span className="field-label">{copy.contact_q}</span>
            <input className="text-input" onChange={(event) => updateField("first_contact", event.target.value)} value={fields.first_contact || ""} />
          </label>
          <ChipGroup
            label={painQuestion}
            multi
            onChange={(nextValue) => updateField("pain_points", nextValue)}
            options={activeMode === "prospect" ? PROSPECT_PAIN_OPTIONS : STAFF_PAIN_OPTIONS}
            value={fields.pain_points || ""}
          />
          <p className="hint-copy">Select all that apply.</p>
          <ChipGroup
            label={resultQuestion}
            onChange={(nextValue) => updateField("result_priority", nextValue)}
            options={activeMode === "prospect" ? PROSPECT_RESULT_OPTIONS : STAFF_RESULT_OPTIONS}
            value={fields.result_priority || ""}
          />
          {activeMode === "prospect" ? (
            <>
              <ChipGroup
                label="Approximate budget for a first engagement"
                onChange={(nextValue) => updateField("budget_band", nextValue)}
                options={BUDGET_OPTIONS}
                value={fields.budget_band || ""}
              />
              <ChipGroup
                label="Timing"
                onChange={(nextValue) => updateField("timeline", nextValue)}
                options={TIMELINE_OPTIONS}
                value={fields.timeline || ""}
              />
            </>
          ) : null}
          <label className="field-group">
            <span className="field-label">{copy.workflow_q}</span>
            <textarea
              className="text-area"
              onChange={(event) => updateField("needs_summary", event.target.value)}
              rows={5}
              value={fields.needs_summary || ""}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Anything else the ROIA team should know? (optional)</span>
            <textarea className="text-area" onChange={(event) => updateField("notes", event.target.value)} rows={3} value={fields.notes || ""} />
          </label>
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() =>
                advanceConversation(
                  { ...painPayload, skip_scheduling: "true" },
                  fields.needs_summary || copy.skip,
                )
              }
              type="button"
            >
              {copy.skip}
            </button>
            <button
              className="primary-button"
              disabled={loading}
              onClick={() =>
                advanceConversation({ ...painPayload, skip_scheduling: "false" }, fields.needs_summary || "")
              }
              type="button"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (currentState === "SCHEDULING") {
      return (
        <div className="stack">
          <p className="muted-copy">{copy.scheduling_intro}</p>
          <label className="field-group">
            <span className="field-label">
              {activeMode === "staff" ? "If a short follow-up helps, preferred times…" : "Preferred times…"}
            </span>
            <textarea
              className="text-area"
              onChange={(event) => updateField("preferred_times", event.target.value)}
              placeholder="Tue/Thu afternoons, Friday mornings, etc."
              rows={3}
              value={fields.preferred_times || ""}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Your timezone</span>
            <select className="text-input" onChange={(event) => updateField("timezone", event.target.value)} value={fields.timezone || "America/Los_Angeles"}>
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <ChipGroup
            label="Best way to reach you if we need a clarification (Email / Phone / Text)"
            onChange={(nextValue) => updateField("preferred_contact_channel", nextValue)}
            options={CONTACT_OPTIONS}
            value={fields.preferred_contact_channel || ""}
          />
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() =>
                advanceConversation({ scheduling_option: "skip", timezone: fields.timezone || "" }, copy.skip)
              }
              type="button"
            >
              {copy.skip}
            </button>
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
        </div>
      );
    }

    if (currentState === "SUMMARY") {
      return (
        <div className="stack">
          <p className="field-label">Your discovery summary</p>
          <label className="field-group">
            <span className="field-label">Anything else before you send?</span>
            <textarea className="text-area text-area-large" onChange={(event) => setSummaryDraft(event.target.value)} rows={10} value={summaryDraft} />
          </label>
          <label className="field-group">
            <span className="field-label">{copy.summary_help}</span>
            <textarea
              className="text-area"
              onChange={(event) => updateField("notes", event.target.value)}
              rows={3}
              value={fields.notes || ""}
            />
          </label>
          {themes.length ? (
            <div className="brief-card">
              <span className="field-label">Themes we heard (for the ROIA — not a final recommendation)</span>
              <p>{themes.join(" · ")}</p>
            </div>
          ) : null}
          <div className="action-row">
            <button className="secondary-button" disabled={loading} onClick={resetConversation} type="button">
              Start another response
            </button>
            <button className="primary-button" disabled={loading} onClick={submitAnswers} type="button">
              {loading ? "Sending…" : "Submit answers"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="stack">
        <p className="success-copy">{copy.submit_done}</p>
        <p className="muted-copy">{copy.client_portal_note}</p>
        <button className="primary-button" onClick={resetConversation} type="button">
          Start another response
        </button>
      </div>
    );
  }

  const progressValue = conversation ? Math.max(1, selectedStepIndex(currentState) + 1) : 1;
  const progressMax = STEP_ORDER.length;
  const flowLabel =
    currentState === "SUMMARY" ? "Your discovery summary" : conversation ? "This question" : "Your earlier answers";

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-mark">ONB1</div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <p className="hero-kicker">{copy.brand_kicker}</p>
        <h1 className="hero-title">{copy.hero_title}</h1>
        <p className="hero-copy">{copy.hero_copy}</p>
        <div className="hero-stats">
          <div className="stat-card">
            <span className="stat-label">Usually takes</span>
            <strong>3–8 minutes</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">{copy.stat_followup_label}</span>
            <strong>{copy.stat_followup_value}</strong>
          </div>
        </div>
        <p className="hint-copy">Already started? We’ll resume in this browser — finish tomorrow or on your phone.</p>
      </section>

      <section className="conversation-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{flowLabel}</p>
            <h2 className="panel-title">{conversation ? "This question" : "Ready when you are"}</h2>
          </div>
          {hydrated && !conversation ? (
            <button className="primary-button" disabled={loading} onClick={startConversation} type="button">
              {loading ? "Preparing…" : copy.cta_start}
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
            <p className="empty-title">{copy.empty_title}</p>
            <ChipGroup
              label="How are you joining today?"
              onChange={(nextValue) =>
                chooseAudience(nextValue.includes("exploring") ? "prospect" : "staff")
              }
              options={[
                "I’m on a company ROIA (team member)",
                "I’m exploring StorenTech for my company",
              ]}
              value={
                audienceMode === "prospect"
                  ? "I’m exploring StorenTech for my company"
                  : "I’m on a company ROIA (team member)"
              }
            />
            <p className="muted-copy">
              {audienceMode === "staff"
                ? "You’ll answer from your seat to help discovery."
                : "Short path so we understand your business before an Automation ROI Analysis."}
            </p>
          </div>
        ) : (
          <>
            {conversation.messages.length ? (
              <div className="message-stack">
                <p className="field-label">Your earlier answers</p>
                {conversation.messages.map((message) => (
                  <article key={message.id} className={message.role === "user" ? "message-bubble message-user" : "message-bubble"}>
                    <span className="message-role">{message.role === "user" ? "You" : "Guide"}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="composer-card">{renderForm()}</div>
            {conversation.intake_brief ? (
              <div className="brief-card">
                <span className="field-label">Themes we heard (for the ROIA — not a final recommendation)</span>
                <p>{conversation.intake_brief.summary}</p>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
