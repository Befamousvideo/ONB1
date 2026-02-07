
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "";
const DEMO_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const MAX_UPLOAD_BYTES = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES || 10485760);
const ALLOWED_UPLOAD_TYPES = (process.env.NEXT_PUBLIC_ALLOWED_UPLOAD_TYPES || "image/png,image/jpeg,application/pdf")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const CAPTCHA_TOKEN = process.env.NEXT_PUBLIC_CAPTCHA_TOKEN || "";

const STATE_FLOW = [
  "WELCOME",
  "MODE_SELECT",
  "IDENTITY",
  "BUSINESS_CONTEXT",
  "NEEDS",
  "SCHEDULING",
  "SUMMARY",
  "SUBMIT",
] as const;

type StateType = (typeof STATE_FLOW)[number];

type ChatMessage = {
  role: "system" | "user";
  text: string;
};

type Attachment = {
  file_name: string;
  content_type: string;
  size: number;
  url: string;
  key: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
};

const PROMPTS: Record<StateType, string> = {
  WELCOME: "Welcome. Ready to start a prospect intake?",
  MODE_SELECT: "Choose a mode to continue.",
  IDENTITY: "What is your name and best email?",
  BUSINESS_CONTEXT: "What company are you with?",
  NEEDS: "Briefly describe what you need help with.",
  SCHEDULING: "Would you like to book a time or share preferred windows?",
  SUMMARY: "Review and confirm the summary.",
  SUBMIT: "Thanks. Your intake has been submitted.",
};

const URGENCY_OPTIONS = ["ASAP", "This week", "Flexible"];
const BUDGET_OPTIONS = ["Under $5k", "$5k-$15k", "$15k-$50k", "$50k+"];
const CHANNEL_OPTIONS = ["Email", "Phone", "Text"];
const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
];
const REQUEST_TYPES = ["bug", "change", "new"];
const REQUEST_IMPACT = ["Low", "Medium", "High", "Critical"];
const REQUEST_URGENCY = ["Normal", "Soon", "Urgent"];

function validateEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits;
}

function buildSummary(fields: Record<string, string>) {
  const parts = [] as string[];
  if (fields.full_name) parts.push(`Name: ${fields.full_name}`);
  if (fields.email) parts.push(`Email: ${fields.email}`);
  if (fields.phone) parts.push(`Phone: ${fields.phone}`);
  if (fields.business_name) parts.push(`Company: ${fields.business_name}`);
  if (fields.needs_summary) parts.push(`Needs: ${fields.needs_summary}`);
  if (fields.urgency) parts.push(`Urgency: ${fields.urgency}`);
  if (fields.budget_band) parts.push(`Budget: ${fields.budget_band}`);
  if (fields.preferred_contact_channel) parts.push(`Preferred Channel: ${fields.preferred_contact_channel}`);
  if (fields.preferred_times) {
    const tz = fields.timezone ? ` (${fields.timezone})` : "";
    parts.push(`Preferred Times: ${fields.preferred_times}${tz}`);
  }
  if (fields.booking_url) parts.push(`Booking Link: ${fields.booking_url}`);
  return parts.join("\n");
}

export default function Home() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [state, setState] = useState<StateType>("WELCOME");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [needsSummary, setNeedsSummary] = useState("");
  const [urgency, setUrgency] = useState("");
  const [budgetBand, setBudgetBand] = useState("");
  const [skipScheduling, setSkipScheduling] = useState(false);
  const [preferredTimes, setPreferredTimes] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [summary, setSummary] = useState("");

  const [clientEmail, setClientEmail] = useState("");
  const [clientOtp, setClientOtp] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [requestStep, setRequestStep] = useState(0);
  const [requestProjectId, setRequestProjectId] = useState("");
  const [requestType, setRequestType] = useState(REQUEST_TYPES[0]);
  const [requestDescription, setRequestDescription] = useState("");
  const [requestImpact, setRequestImpact] = useState(REQUEST_IMPACT[1]);
  const [requestUrgency, setRequestUrgency] = useState(REQUEST_URGENCY[0]);
  const [requestAttachments, setRequestAttachments] = useState<Attachment[]>([]);
  const [requestResult, setRequestResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestFileRef = useRef<HTMLInputElement | null>(null);
  const lastPrompt = useRef<StateType | null>(null);

  const stepIndex = STATE_FLOW.indexOf(state) + 1;
  const stepsTotal = STATE_FLOW.length;
  const remaining = Math.max(0, stepsTotal - stepIndex);
  const approxMinutes = Math.max(1, Math.ceil(remaining * 0.5));

  const summaryPreview = useMemo(() => {
    const computed = buildSummary({
      full_name: fullName || fields.full_name,
      email: email || fields.email,
      phone: phone || fields.phone,
      business_name: businessName || fields.business_name,
      needs_summary: needsSummary || fields.needs_summary,
      urgency: urgency || fields.urgency,
      budget_band: budgetBand || fields.budget_band,
      preferred_contact_channel: preferredChannel || fields.preferred_contact_channel,
      preferred_times: preferredTimes || fields.preferred_times,
      timezone: timezone || fields.timezone,
      booking_url: fields.booking_url,
    });
    return computed || "(No details captured yet)";
  }, [
    fullName,
    email,
    phone,
    businessName,
    needsSummary,
    urgency,
    budgetBand,
    preferredChannel,
    preferredTimes,
    timezone,
    fields,
  ]);

  useEffect(() => {
    if (lastPrompt.current !== state) {
      setMessages((prev) => [...prev, { role: "system", text: PROMPTS[state] }]);
      lastPrompt.current = state;
    }
    if (state === "SUMMARY" && !summary) {
      setSummary(summaryPreview);
    }
  }, [state, summaryPreview, summary]);

  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => {
      refreshConversation();
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  async function refreshConversation() {
    if (!conversationId) return;
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversationId}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data?.state) {
        setState(data.state);
      }
      if (data?.normalized_fields) {
        setFields(data.normalized_fields);
      }
    } catch {
      // ignore polling errors
    }
  }

  async function startConversation() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(CAPTCHA_TOKEN ? { "X-Captcha-Token": CAPTCHA_TOKEN } : {}),
        },
        body: JSON.stringify({
          account_id: DEMO_ACCOUNT_ID,
          channel: "web",
          subject: "Prospect Intake",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }
      const data = await response.json();
      setConversationId(data.id);
      setState(data.state);
      setFields(data.normalized_fields || {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp() {
    if (!validateEmail(clientEmail)) {
      setError("Enter a valid email");
      return;
    }
    setLoading(true);
    setError(null);
    setAuthNotice(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(CAPTCHA_TOKEN ? { "X-Captcha-Token": CAPTCHA_TOKEN } : {}),
        },
        body: JSON.stringify({ email: clientEmail }),
      });
      if (!response.ok) {
        throw new Error("Unable to request code");
      }
      const data = await response.json();
      setChallengeId(data.challenge_id);
      setAuthNotice(data.dev_code ? `Dev code: ${data.dev_code}` : "Check your email for the code.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!challengeId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code: clientOtp }),
      });
      if (!response.ok) {
        throw new Error("Invalid code");
      }
      const data = await response.json();
      setClientToken(data.token);
      await loadProjects(data.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects(token: string) {
    const response = await fetch(`${API_BASE}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error("Unable to load projects");
    }
    const data = await response.json();
    setClientProjects(data);
    if (!requestProjectId && data.length > 0) {
      setRequestProjectId(data[0].id);
    }
  }

  async function sendMessage(body: string, payloadFields: Record<string, any> = {}) {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_type: "contact",
          body,
          fields: payloadFields,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        const msg = detail?.detail?.error === "missing_fields"
          ? `Missing fields for ${detail.detail.state}: ${detail.detail.fields.join(", ")}`
          : "Failed to send message";
        throw new Error(msg);
      }
      setMessages((prev) => [...prev, { role: "user", text: body }]);
      setFields((prev) => ({ ...prev, ...payloadFields }));
      await refreshConversation();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendSystemUpdate(payloadFields: Record<string, any>, note: string) {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_type: "system",
          body: note,
          fields: payloadFields,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to update conversation");
      }
      setMessages((prev) => [...prev, { role: "system", text: note }]);
      setFields((prev) => ({ ...prev, ...payloadFields }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function endAndSendNow() {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/end-and-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: summary || summaryPreview }),
      });
      if (!response.ok) {
        throw new Error("Failed to end conversation");
      }
      const data = await response.json();
      setState(data.state);
      setFields(data.normalized_fields || {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    if (!conversationId) return;
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setError("Unsupported file type");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File is too large");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const presignRes = await fetch(`${API_BASE}/api/uploads/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type,
          content_length: file.size,
          conversation_id: conversationId,
        }),
      });
      if (!presignRes.ok) {
        throw new Error("Failed to presign upload");
      }
      const presignData = await presignRes.json();
      const uploadRes = await fetch(presignData.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }
      const attachment: Attachment = {
        file_name: file.name,
        content_type: file.type,
        size: file.size,
        url: presignData.file_url,
        key: presignData.key,
      };
      setAttachments((prev) => [...prev, attachment]);
      await sendSystemUpdate({ attachments: [attachment] }, `Attachment added: ${file.name}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRequestUpload(file: File) {
    if (!clientToken) return;
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setError("Unsupported file type");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File is too large");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const presignRes = await fetch(`${API_BASE}/api/uploads/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type,
          content_length: file.size,
        }),
      });
      if (!presignRes.ok) {
        throw new Error("Failed to presign upload");
      }
      const presignData = await presignRes.json();
      const uploadRes = await fetch(presignData.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }
      const attachment: Attachment = {
        file_name: file.name,
        content_type: file.type,
        size: file.size,
        url: presignData.file_url,
        key: presignData.key,
      };
      setRequestAttachments((prev) => [...prev, attachment]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      if (requestFileRef.current) {
        requestFileRef.current.value = "";
      }
    }
  }

  async function submitClientRequest() {
    if (!clientToken) return;
    if (!requestProjectId) {
      setError("Select a project");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clientToken}`,
        },
        body: JSON.stringify({
          project_id: requestProjectId,
          request_type: requestType,
          description: requestDescription,
          impact: requestImpact,
          urgency: requestUrgency,
          attachments: requestAttachments,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to submit request");
      }
      const data = await response.json();
      setRequestResult(`Request submitted. ID: ${data.id}`);
      setRequestStep(0);
      setRequestDescription("");
      setRequestAttachments([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function renderClientRequestForm() {
    if (!clientToken) return null;
    return (
      <div className="request-flow">
        <div className="request-steps">Step {requestStep + 1} of 5</div>
        {requestStep === 0 && (
          <div className="form">
            <label>
              Project
              <select value={requestProjectId} onChange={(e) => setRequestProjectId(e.target.value)}>
                {clientProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" onClick={() => setRequestStep(1)} disabled={!requestProjectId}>
              Continue
            </button>
          </div>
        )}
        {requestStep === 1 && (
          <div className="form">
            <div className="chip-row">
              {REQUEST_TYPES.map((type) => (
                <button
                  key={type}
                  className={type === requestType ? "chip active" : "chip"}
                  onClick={() => setRequestType(type)}
                  type="button"
                >
                  {type}
                </button>
              ))}
            </div>
            <button className="primary" onClick={() => setRequestStep(2)}>
              Continue
            </button>
          </div>
        )}
        {requestStep === 2 && (
          <div className="form">
            <textarea
              placeholder="Describe the request"
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              rows={3}
            />
            <button className="primary" onClick={() => setRequestStep(3)} disabled={!requestDescription.trim()}>
              Continue
            </button>
          </div>
        )}
        {requestStep === 3 && (
          <div className="form">
            <div className="chip-row">
              {REQUEST_IMPACT.map((option) => (
                <button
                  key={option}
                  className={option === requestImpact ? "chip active" : "chip"}
                  onClick={() => setRequestImpact(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="chip-row">
              {REQUEST_URGENCY.map((option) => (
                <button
                  key={option}
                  className={option === requestUrgency ? "chip active" : "chip"}
                  onClick={() => setRequestUrgency(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <button className="primary" onClick={() => setRequestStep(4)}>
              Continue
            </button>
          </div>
        )}
        {requestStep === 4 && (
          <div className="form">
            <div className="attachment-block">
              <div className="attachment-header">
                <strong>Attachments</strong>
                <span>
                  Max {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB. Types: {ALLOWED_UPLOAD_TYPES.join(", ")}
                </span>
              </div>
              <input
                ref={requestFileRef}
                type="file"
                accept={ALLOWED_UPLOAD_TYPES.join(",")}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleRequestUpload(file);
                  }
                }}
                disabled={loading}
              />
              {requestAttachments.length > 0 && (
                <ul className="attachment-list">
                  {requestAttachments.map((file) => (
                    <li key={file.key}>
                      <a href={file.url} target="_blank" rel="noreferrer">
                        {file.file_name}
                      </a>
                      <span>{Math.round(file.size / 1024)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="primary" onClick={submitClientRequest} disabled={loading}>
              Submit Request
            </button>
          </div>
        )}
        {requestResult && <div className="note">{requestResult}</div>}
      </div>
    );
  }

  function renderInput() {
    if (!conversationId) {
      return (
        <div className="start-grid">
          <div className="card">
            <h2>Prospect Intake</h2>
            <p>Start a new intake with a quick, guided chat.</p>
            <button className="primary" onClick={startConversation} disabled={loading}>
              Start Prospect Intake
            </button>
          </div>
          <div className="card">
            <h2>Existing Client</h2>
            <p>Log in to view your projects and submit requests.</p>
            <div className="form">
              <input
                placeholder="Work email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              {!challengeId && (
                <button className="secondary" onClick={requestOtp} disabled={loading}>
                  Send one-time code
                </button>
              )}
              {challengeId && !clientToken && (
                <>
                  <input
                    placeholder="Enter code"
                    value={clientOtp}
                    onChange={(e) => setClientOtp(e.target.value)}
                  />
                  <button className="secondary" onClick={verifyOtp} disabled={loading}>
                    Verify & view projects
                  </button>
                </>
              )}
              {authNotice && <div className="note">{authNotice}</div>}
            </div>
            {clientToken && (
              <div className="projects">
                <h3>Your Projects</h3>
                {clientProjects.length === 0 && <p>No projects found.</p>}
                {clientProjects.length > 0 && (
                  <ul>
                    {clientProjects.map((project) => (
                      <li key={project.id}>
                        <strong>{project.name}</strong>
                        <span>{project.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {renderClientRequestForm()}
              </div>
            )}
          </div>
        </div>
      );
    }

    switch (state) {
      case "WELCOME":
        return (
          <button
            className="primary"
            onClick={() => sendMessage("Start", {})}
            disabled={loading}
          >
            Start
          </button>
        );
      case "MODE_SELECT":
        return (
          <div className="chips">
            <button
              className="chip"
              onClick={() => sendMessage("Prospect", { mode: "prospect" })}
              disabled={loading}
            >
              Prospect
            </button>
            <button
              className="chip"
              onClick={() => sendMessage("Existing Client", { mode: "client" })}
              disabled={loading}
            >
              Existing Client
            </button>
          </div>
        );
      case "IDENTITY":
        return (
          <div className="form">
            <input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              className="primary"
              onClick={() => {
                if (!fullName.trim()) {
                  setError("Full name is required");
                  return;
                }
                if (!validateEmail(email)) {
                  setError("Enter a valid email");
                  return;
                }
                const normalizedPhone = phone ? normalizePhone(phone) : "";
                if (phone && normalizedPhone.length < 10) {
                  setError("Enter a valid phone or leave it blank");
                  return;
                }
                sendMessage(fullName, {
                  full_name: fullName,
                  email,
                  phone: normalizedPhone,
                });
              }}
              disabled={loading}
            >
              Continue
            </button>
          </div>
        );
      case "BUSINESS_CONTEXT":
        return (
          <div className="form">
            <input
              placeholder="Company name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <button
              className="primary"
              onClick={() => sendMessage(businessName, { business_name: businessName })}
              disabled={loading || !businessName.trim()}
            >
              Continue
            </button>
          </div>
        );
      case "NEEDS":
        return (
          <div className="form">
            <textarea
              placeholder="What are you looking to do?"
              value={needsSummary}
              onChange={(e) => setNeedsSummary(e.target.value)}
              rows={3}
            />
            <div className="chip-row">
              {URGENCY_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={option === urgency ? "chip active" : "chip"}
                  onClick={() => setUrgency(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="chip-row">
              {BUDGET_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={option === budgetBand ? "chip active" : "chip"}
                  onClick={() => setBudgetBand(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={skipScheduling}
                onChange={(e) => setSkipScheduling(e.target.checked)}
              />
              Skip scheduling step
            </label>
            <button
              className="primary"
              onClick={() =>
                sendMessage(needsSummary, {
                  needs_summary: needsSummary,
                  urgency,
                  budget_band: budgetBand,
                  skip_scheduling: skipScheduling ? "true" : "false",
                })
              }
              disabled={loading || !needsSummary.trim()}
            >
              Continue
            </button>
          </div>
        );
      case "SCHEDULING":
        return (
          <div className="form">
            {BOOKING_URL && (
              <div className="booking">
                <div className="booking-text">
                  <strong>Book instantly</strong>
                  <p>Use our booking link to grab a time now.</p>
                </div>
                <div className="booking-actions">
                  <a className="secondary" href={BOOKING_URL} target="_blank" rel="noreferrer">
                    Open booking link
                  </a>
                  <button
                    className="primary"
                    type="button"
                    onClick={() =>
                      sendMessage("Booked via link", {
                        scheduling_option: "link",
                        booking_url: BOOKING_URL,
                      })
                    }
                    disabled={loading}
                  >
                    I booked a time
                  </button>
                </div>
              </div>
            )}

            <div className="divider">Or share preferred times</div>

            <textarea
              placeholder="Preferred times (e.g., Tue 2-4pm, Thu morning)"
              value={preferredTimes}
              onChange={(e) => setPreferredTimes(e.target.value)}
              rows={2}
            />
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <div className="chip-row">
              {CHANNEL_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={option === preferredChannel ? "chip active" : "chip"}
                  onClick={() => setPreferredChannel(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              className="primary"
              onClick={() =>
                sendMessage(preferredTimes || "Scheduling", {
                  scheduling_option: "times",
                  preferred_times: preferredTimes,
                  timezone,
                  preferred_contact_channel: preferredChannel,
                })
              }
              disabled={loading || !preferredTimes.trim()}
            >
              Continue
            </button>
          </div>
        );
      case "SUMMARY":
        return (
          <div className="form">
            <div className="summary-box">
              <pre>{summaryPreview}</pre>
            </div>
            <textarea
              placeholder="Edit summary if needed"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
            />

            <div className="attachment-block">
              <div className="attachment-header">
                <strong>Attachments</strong>
                <span>
                  Max {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB. Types: {ALLOWED_UPLOAD_TYPES.join(", ")}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_UPLOAD_TYPES.join(",")}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
                disabled={loading}
              />
              {attachments.length > 0 && (
                <ul className="attachment-list">
                  {attachments.map((file) => (
                    <li key={file.key}>
                      <a href={file.url} target="_blank" rel="noreferrer">
                        {file.file_name}
                      </a>
                      <span>{Math.round(file.size / 1024)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              className="primary"
              onClick={() => sendMessage("Summary confirmed", { summary })}
              disabled={loading || !summary.trim()}
            >
              Submit
            </button>
          </div>
        );
      case "SUBMIT":
        return <div className="done">We will follow up shortly.</div>;
      default:
        return null;
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Prospect Intake</h1>
          <p>One question at a time. Takes about {approxMinutes} min.</p>
        </div>
        <div className="progress">
          Step {stepIndex} of {stepsTotal}
        </div>
      </header>

      <section className="chat">
        {messages.map((msg, idx) => (
          <div key={idx} className={`bubble ${msg.role}`}>
            {msg.text}
          </div>
        ))}
      </section>

      {error && <div className="error">{error}</div>}

      <section className="input-area">{renderInput()}</section>

      {conversationId && state !== "SUBMIT" && (
        <div className="sticky">
          <button className="secondary" onClick={endAndSendNow} disabled={loading}>
            End & Send Now
          </button>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          background: radial-gradient(circle at top, #f2f5ff, #ffffff 60%);
          color: #111827;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
        }
        h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.02em;
        }
        h2 {
          margin: 0 0 8px 0;
          font-size: 20px;
        }
        h3 {
          margin: 12px 0 6px 0;
          font-size: 16px;
        }
        p {
          margin: 4px 0 0 0;
          color: #4b5563;
        }
        .progress {
          background: #111827;
          color: #fff;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
        }
        .chat {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05);
          overflow: auto;
        }
        .bubble {
          padding: 12px 14px;
          border-radius: 12px;
          max-width: 80%;
          font-size: 15px;
          line-height: 1.4;
        }
        .bubble.system {
          background: #f3f4f6;
          align-self: flex-start;
        }
        .bubble.user {
          background: #111827;
          color: #fff;
          align-self: flex-end;
        }
        .input-area {
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          border: 1px solid #e5e7eb;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .start-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }
        .card {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 16px;
          background: #f9fafb;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .projects ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .projects li {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
        }
        .request-flow {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .request-steps {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .note {
          font-size: 12px;
          color: #2563eb;
          background: #eff6ff;
          padding: 6px 10px;
          border-radius: 10px;
        }
        input,
        textarea,
        select {
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          width: 100%;
        }
        textarea {
          resize: vertical;
        }
        .chips,
        .chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid #d1d5db;
          background: #fff;
          cursor: pointer;
          font-size: 13px;
        }
        .chip.active {
          background: #111827;
          color: #fff;
          border-color: #111827;
        }
        .primary {
          background: #111827;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          cursor: pointer;
        }
        .secondary {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          background: #ffffff;
          border: 1px solid #111827;
          color: #111827;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 14px;
          cursor: pointer;
          text-decoration: none;
        }
        .error {
          color: #b91c1c;
          background: #fee2e2;
          padding: 8px 12px;
          border-radius: 10px;
        }
        .summary-box {
          background: #f9fafb;
          border: 1px dashed #d1d5db;
          border-radius: 12px;
          padding: 12px;
        }
        .summary-box pre {
          margin: 0;
          white-space: pre-wrap;
          font-size: 13px;
        }
        .done {
          font-size: 15px;
          color: #16a34a;
        }
        .sticky {
          position: sticky;
          bottom: 12px;
          padding-bottom: 8px;
        }
        .checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #4b5563;
        }
        .booking {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #f8fafc;
        }
        .booking-text p {
          margin: 4px 0 0 0;
          color: #6b7280;
          font-size: 13px;
        }
        .booking-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .divider {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
          margin-top: 6px;
        }
        .attachment-block {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px;
          background: #f9fafb;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .attachment-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: #6b7280;
        }
        .attachment-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
        }
        .attachment-list li {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        .attachment-list a {
          color: #111827;
        }
        @media (max-width: 600px) {
          .header {
            flex-direction: column;
            align-items: flex-start;
          }
          .bubble {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
