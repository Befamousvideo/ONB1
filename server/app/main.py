from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

UTC = timezone.utc
EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")
LOCAL_CORS_ORIGIN_REGEX = (
    r"^https?://("
    r"localhost|"
    r"127\.0\.0\.1|"
    r"10(?:\.\d{1,3}){3}|"
    r"172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|"
    r"192\.168(?:\.\d{1,3}){2}"
    r")(?::\d+)?$"
)

STATE_PROMPTS = {
    "WELCOME": (
        "Welcome — this is discovery for your company’s ROIA with StorenTech AI. "
        "About 3–8 minutes. Pause anytime and finish tomorrow or on your phone."
    ),
    "MODE_SELECT": (
        "Which seat are you answering from? Owner/CEO, Admin, Sales, HR, Finance, "
        "front of house, or back of house."
    ),
    "IDENTITY": "Thanks. Your name and work email so we file this with the right ROIA.",
    "BUSINESS_CONTEXT": "Quick company check — name and roughly how big your team or area is.",
    "ARCHETYPE": "Confirm the company category so we route your answers correctly.",
    "PAIN_POINTS": "Where do coordination, tools, or handoffs create extra work in ops?",
    "NEEDS": "Where do coordination, tools, or handoffs create extra work in ops?",
    "SCHEDULING": (
        "Want a live clarification later, or skip and finish on your own? "
        "You can always resume in this browser."
    ),
    "SUMMARY": "Ops discovery summary.",
    "SUBMIT": "Received. Your ops answers are in for the ROIA.",
}

ROLE_ADMIN = "Admin / Ops"
ROLE_CEO = "Owner / CEO"
ROLE_SALES = "Sales"
ROLE_HR = "HR / People"
ROLE_FINANCE = "Finance"
ROLE_FOH = "Front of house"
ROLE_BOH = "Back of house / Ops floor"
ROLE_OTHER = "Other / several seats"

ROLE_ALIASES = {
    "owner / ceo": ROLE_CEO,
    "owner/ceo": ROLE_CEO,
    "ceo": ROLE_CEO,
    "admin / ops": ROLE_ADMIN,
    "admin/ops": ROLE_ADMIN,
    "admin": ROLE_ADMIN,
    "ops": ROLE_ADMIN,
    "sales": ROLE_SALES,
    "hr / people": ROLE_HR,
    "hr/people": ROLE_HR,
    "hr": ROLE_HR,
    "people": ROLE_HR,
    "finance": ROLE_FINANCE,
    "front of house": ROLE_FOH,
    "foh": ROLE_FOH,
    "back of house / ops floor": ROLE_BOH,
    "back of house": ROLE_BOH,
    "boh": ROLE_BOH,
    "other / several seats": ROLE_OTHER,
    "other": ROLE_OTHER,
}

# Role → STATE_PROMPTS overlays. Missing keys fall back to Admin/Ops (STATE_PROMPTS).
ROLE_PROMPT_OVERLAYS: dict[str, dict[str, str]] = {
    ROLE_CEO: {
        "MODE_SELECT": (
            "Which seat are you answering from? Owner/CEO sees company-wide stakes; "
            "other seats go deep on their lane."
        ),
        "IDENTITY": "Your name and work email — so we attach this to the right ROIA.",
        "BUSINESS_CONTEXT": "Company snapshot from your view: name, scale, and how work is organized.",
        "ARCHETYPE": "Confirm the business category so we frame the analysis correctly.",
        "PAIN_POINTS": "Where does the company lose time, money, or follow-through — from your vantage point?",
        "NEEDS": "Where does the company lose time, money, or follow-through — from your vantage point?",
        "SCHEDULING": (
            "Prefer to finish later, or leave a window if the ROIA lead needs a short clarification with you."
        ),
        "SUMMARY": "Company-level discovery summary. Edit freely, then send.",
        "SUBMIT": "Received. Your executive view is in for the ROIA.",
    },
    ROLE_HR: {
        "MODE_SELECT": "Which seat? HR/People — hiring, onboarding, coverage, and handoffs.",
        "IDENTITY": "Name and work email for the ROIA file.",
        "BUSINESS_CONTEXT": "Quick company check, then we’ll focus on people workflows.",
        "ARCHETYPE": "Confirm company category (helps us understand staffing patterns).",
        "PAIN_POINTS": (
            "Where do people processes leak time — hiring, scheduling coverage, training, or internal requests?"
        ),
        "NEEDS": (
            "Where do people processes leak time — hiring, scheduling coverage, training, or internal requests?"
        ),
        "SCHEDULING": "Pause anytime. Optional: when you’re free if we need one clarification.",
        "SUMMARY": "People-seat discovery summary. Adjust anything, then send.",
        "SUBMIT": "Received. Your HR/People answers are in for the ROIA.",
    },
    ROLE_SALES: {
        "PAIN_POINTS": "Where do leads, follow-ups, or handoffs break in sales?",
        "NEEDS": "Where do leads, follow-ups, or handoffs break in sales?",
        "SUMMARY": "Sales-seat discovery summary.",
        "SUBMIT": "Received. Your sales answers are in for the ROIA.",
    },
    ROLE_FINANCE: {
        "PAIN_POINTS": "Where do billing, collections, approvals, or reporting create rework?",
        "NEEDS": "Where do billing, collections, approvals, or reporting create rework?",
        "SUMMARY": "Finance-seat discovery summary.",
        "SUBMIT": "Received. Your finance answers are in for the ROIA.",
    },
    ROLE_ADMIN: {
        "PAIN_POINTS": "Where do coordination, tools, or handoffs create extra work in ops?",
        "NEEDS": "Where do coordination, tools, or handoffs create extra work in ops?",
        "SUMMARY": "Ops discovery summary.",
        "SUBMIT": "Received. Your ops answers are in for the ROIA.",
    },
    ROLE_FOH: {
        "PAIN_POINTS": (
            "Where do guest/customer-facing moments break — phones, booking, walk-ins, handoffs to the back?"
        ),
        "NEEDS": (
            "Where do guest/customer-facing moments break — phones, booking, walk-ins, handoffs to the back?"
        ),
        "SUMMARY": "Front-of-house discovery summary.",
        "SUBMIT": "Received. Your front-of-house answers are in for the ROIA.",
    },
    ROLE_BOH: {
        "PAIN_POINTS": (
            "Where does floor/back-of-house work jam — tickets, prep, inventory handoffs, or updates to the front?"
        ),
        "NEEDS": (
            "Where does floor/back-of-house work jam — tickets, prep, inventory handoffs, or updates to the front?"
        ),
        "SUMMARY": "Back-of-house discovery summary.",
        "SUBMIT": "Received. Your back-of-house answers are in for the ROIA.",
    },
}

# Prospect / exploring path — separate pack. Staff Owner/CEO overlays must never be used here.
PROSPECT_STATE_PROMPTS = {
    "WELCOME": (
        "Welcome to StorenTech AI. In a few minutes we’ll map how the business runs "
        "so an Automation ROI Analysis would be useful — if it’s a fit."
    ),
    "MODE_SELECT": (
        "Are you exploring StorenTech for your company, or joining a ROIA your company already started?"
    ),
    "IDENTITY": "Your name and best email.",
    "BUSINESS_CONTEXT": "Tell us about the business — name, scale, how work is organized.",
    "ARCHETYPE": "What best describes the business? Closest fit is fine.",
    "PAIN_POINTS": "Where does time, follow-up, or ops break down today?",
    "NEEDS": "Where does time, follow-up, or ops break down today?",
    "SCHEDULING": "Prefer a time to connect, or skip and we’ll follow up by email.",
    "SUMMARY": "Here’s your summary. Edit anything, then send.",
    "SUBMIT": "Received. We’ll review and follow up about an Automation ROI Analysis.",
}

STATE_FIELDS = {
    "MODE_SELECT": ["role"],
    "IDENTITY": ["full_name", "email"],
    "BUSINESS_CONTEXT": ["business_name"],
    "ARCHETYPE": ["archetype"],
    "PAIN_POINTS": ["needs_summary"],
    "NEEDS": ["needs_summary"],
    "SUMMARY": ["summary"],
}

app = FastAPI(
    title="ONB1 API",
    version="0.1.0",
    description="Local-first ROIA discovery API for ONB1.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=LOCAL_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STORE_LOCK = Lock()
_CONVERSATIONS: dict[UUID, dict[str, Any]] = {}


class Attachment(BaseModel):
    file_url: str
    file_name: str | None = None
    content_type: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)


class CreateConversationRequest(BaseModel):
    participant_name: str | None = None
    participant_email: str | None = None
    mode: str = "staff"
    role: str | None = None


class CreateMessageRequest(BaseModel):
    content: str = ""
    fields: dict[str, Any] = Field(default_factory=dict)
    attachments: list[Attachment] = Field(default_factory=list)
    advance: bool = True


class EndAndSendRequest(BaseModel):
    summary: str | None = None
    notes: str | None = None
    attachments: list[Attachment] = Field(default_factory=list)


class ApproveEstimateResponse(BaseModel):
    estimate_id: UUID
    invoice_id: UUID
    provider: str = "stripe"
    provider_invoice_id: str | None = None
    provider_invoice_url: str | None = None
    status: str = "draft"


class SendInvoiceResponse(BaseModel):
    invoice_id: UUID
    provider_invoice_id: str
    provider_invoice_url: str | None = None
    status: Literal["already_sent", "sent"]


class UploadPresignRequest(BaseModel):
    file_name: str
    content_type: str
    content_length: int | None = None


class SlackHandoffRequest(BaseModel):
    conversation_id: UUID
    brief: dict[str, Any]
    destination_channel: str | None = None


class LocalCursor:
    rowcount = 0

    def __enter__(self) -> LocalCursor:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def execute(self, *_args, **_kwargs) -> None:
        self.rowcount = 1

    def fetchone(self) -> None:
        return None


class LocalConnection:
    def __enter__(self) -> LocalConnection:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def cursor(self) -> LocalCursor:
        return LocalCursor()


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip()


def as_bool(value: Any) -> bool:
    return clean_text(value).lower() in {"1", "true", "yes", "y", "on"}


def normalize_fields(fields: dict[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, list):
            text = ", ".join(clean_text(item) for item in value if clean_text(item))
        else:
            text = clean_text(value)
        if text:
            normalized[key] = text
    return normalized


def parse_normalized_fields(payload: Any) -> dict[str, str]:
    if isinstance(payload, dict):
        return {str(key): clean_text(value) for key, value in payload.items() if clean_text(value)}
    if isinstance(payload, str) and payload.strip():
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return {}
        return parse_normalized_fields(data)
    return {}


def canonical_mode(fields: dict[str, str] | str | None) -> str:
    if isinstance(fields, dict):
        raw = clean_text(fields.get("mode"))
    else:
        raw = clean_text(fields)
    if raw.lower() == "prospect":
        return "prospect"
    return "staff"


def canonical_role(fields: dict[str, str]) -> str:
    raw = clean_text(fields.get("role"))
    if not raw:
        return ROLE_ADMIN
    mapped = ROLE_ALIASES.get(raw.lower())
    if mapped == ROLE_OTHER:
        return ROLE_ADMIN
    if mapped:
        return mapped
    if raw in ROLE_PROMPT_OVERLAYS:
        return raw
    return ROLE_ADMIN


def build_summary(fields: dict[str, str]) -> str:
    lines: list[str] = []
    if fields.get("full_name"):
        lines.append(f"Name: {fields['full_name']}")
    if fields.get("email"):
        lines.append(f"Email: {fields['email']}")
    if fields.get("phone"):
        lines.append(f"Phone: {fields['phone']}")
    if fields.get("role"):
        lines.append(f"Seat: {fields['role']}")
    if fields.get("company_location"):
        lines.append(f"Company / location: {fields['company_location']}")
    if fields.get("business_name"):
        lines.append(f"Company: {fields['business_name']}")
    if fields.get("business_url"):
        lines.append(f"Website: {fields['business_url']}")
    if fields.get("archetype"):
        lines.append(f"Category: {fields['archetype']}")
    if fields.get("subtypes"):
        lines.append(f"Work types: {fields['subtypes']}")
    if fields.get("industry") and not fields.get("archetype"):
        lines.append(f"Category: {fields['industry']}")
    if fields.get("company_size"):
        lines.append(f"Team / area size: {fields['company_size']}")
    if fields.get("first_contact"):
        lines.append(f"How work arrives: {fields['first_contact']}")
    if fields.get("pain_points"):
        lines.append(f"Where work gets stuck: {fields['pain_points']}")
    if fields.get("result_priority"):
        lines.append(f"What would help most: {fields['result_priority']}")
    if fields.get("needs_summary"):
        lines.append(f"Workflow: {fields['needs_summary']}")
    if fields.get("solution_interest"):
        lines.append(f"Theme: {fields['solution_interest']}")
    if canonical_mode(fields) == "prospect":
        if fields.get("timeline"):
            lines.append(f"Timing: {fields['timeline']}")
        if fields.get("budget_band"):
            lines.append(f"Budget: {fields['budget_band']}")
    if fields.get("preferred_times"):
        timezone_value = fields.get("timezone")
        suffix = f" ({timezone_value})" if timezone_value else ""
        lines.append(f"Availability: {fields['preferred_times']}{suffix}")
    if fields.get("preferred_contact_channel"):
        lines.append(f"Best way to reach you: {fields['preferred_contact_channel']}")
    if fields.get("notes"):
        lines.append(f"Notes: {fields['notes']}")
    return "\n".join(lines)


def build_intake_brief(fields: dict[str, str], notes: str | None = None) -> dict[str, Any]:
    prospect = canonical_mode(fields) == "prospect"
    summary = (
        clean_text(fields.get("summary"))
        or build_summary(fields)
        or (
            "Exploring StorenTech — notes for an Automation ROI Analysis."
            if prospect
            else "Staff discovery notes for the company ROIA."
        )
    )
    goals = (
        [clean_text(fields.get("needs_summary"))]
        if fields.get("needs_summary")
        else (
            ["Clarify fit for an Automation ROI Analysis."]
            if prospect
            else ["Capture how work runs in this seat for ROIA discovery."]
        )
    )
    constraints: list[str] = []
    if fields.get("role"):
        constraints.append(f"Seat: {fields['role']}")
    if prospect and fields.get("timeline"):
        constraints.append(f"Timing: {fields['timeline']}")
    if prospect and fields.get("budget_band"):
        constraints.append(f"Budget: {fields['budget_band']}")
    if fields.get("preferred_contact_channel"):
        constraints.append(f"Contact via {fields['preferred_contact_channel']}")
    if fields.get("preferred_times"):
        timezone_value = fields.get("timezone")
        suffix = f" ({timezone_value})" if timezone_value else ""
        constraints.append(f"Availability: {fields['preferred_times']}{suffix}")
    if notes:
        constraints.append(f"Operator note: {notes}")
    if prospect:
        next_steps = [
            "Review the summary.",
            "Follow up about an Automation ROI Analysis.",
        ]
        if fields.get("preferred_times"):
            next_steps.append("Offer a time during the preferred windows.")
        else:
            next_steps.append("Follow up by email.")
    else:
        next_steps = [
            "Review the discovery summary.",
            "Use these notes in ROIA discovery — not a final recommendation.",
        ]
        if fields.get("preferred_times"):
            next_steps.append("Optional clarification during the preferred windows.")
        else:
            next_steps.append("No live follow-up requested; finish from the written answers.")
    return {
        "summary": summary,
        "goals": goals,
        "constraints": constraints or ["No additional constraints captured yet."],
        "recommended_next_steps": next_steps,
    }


def prompt_for_state(state: str, fields: dict[str, str]) -> str:
    if canonical_mode(fields) == "prospect":
        text = PROSPECT_STATE_PROMPTS.get(state) or STATE_PROMPTS.get(state, "")
    else:
        role = canonical_role(fields)
        overlays = ROLE_PROMPT_OVERLAYS.get(role, {})
        text = overlays.get(state) or STATE_PROMPTS.get(state, "")
    if state == "SUMMARY":
        summary = build_summary(fields)
        if summary:
            return f"{text}\n\n{summary}"
    return text


def summarize_step_response(state: str, fields: dict[str, str]) -> str:
    if state == "WELCOME":
        return "Ready to start."
    if state == "MODE_SELECT":
        if clean_text(fields.get("role")):
            return fields["role"]
        if canonical_mode(fields) == "prospect":
            return "I’m exploring StorenTech for my company"
        return "I’m on a company ROIA (team member)"
    if state == "IDENTITY":
        pieces = [fields.get("full_name", "")]
        if fields.get("email"):
            pieces.append(fields["email"])
        return " | ".join(piece for piece in pieces if piece)
    if state == "BUSINESS_CONTEXT":
        pieces = [fields.get("business_name", "")]
        if fields.get("archetype"):
            pieces.append(fields["archetype"])
        elif fields.get("industry"):
            pieces.append(fields["industry"])
        return " | ".join(piece for piece in pieces if piece)
    if state == "ARCHETYPE":
        pieces = [fields.get("archetype", "")]
        if fields.get("subtypes"):
            pieces.append(fields["subtypes"])
        return " | ".join(piece for piece in pieces if piece)
    if state in {"NEEDS", "PAIN_POINTS"}:
        return fields.get("needs_summary", "")
    if state == "SCHEDULING":
        if fields.get("preferred_times"):
            return fields["preferred_times"]
        return fields.get("scheduling_option", "Skip for now — I’ll finish on my own.")
    if state == "SUMMARY":
        return fields.get("summary", build_summary(fields))
    return ""


def next_state(current_state: str, fields: dict[str, str]) -> str:
    if current_state == "WELCOME":
        return "MODE_SELECT"
    if current_state == "MODE_SELECT":
        return "IDENTITY"
    if current_state == "IDENTITY":
        return "BUSINESS_CONTEXT"
    if current_state == "BUSINESS_CONTEXT":
        return "ARCHETYPE"
    if current_state == "ARCHETYPE":
        return "PAIN_POINTS"
    if current_state in {"NEEDS", "PAIN_POINTS"}:
        return "SUMMARY" if as_bool(fields.get("skip_scheduling")) else "SCHEDULING"
    if current_state == "SCHEDULING":
        return "SUMMARY"
    if current_state == "SUMMARY":
        return "SUBMIT"
    return "SUBMIT"


def validate_required_fields(state: str, fields: dict[str, str]) -> None:
    if state == "SCHEDULING":
        if clean_text(fields.get("scheduling_option")).lower() in {"link", "skip"}:
            return
        required = [field for field in ["preferred_times", "timezone"] if not clean_text(fields.get(field))]
        if required:
            raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": required})
        return

    if state == "MODE_SELECT":
        if clean_text(fields.get("role")) or clean_text(fields.get("mode")):
            return
        raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": ["role"]})

    required_fields = STATE_FIELDS.get(state, [])
    missing = [field for field in required_fields if not clean_text(fields.get(field))]
    if missing:
        raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": missing})

    if state == "IDENTITY" and not EMAIL_RE.match(clean_text(fields.get("email"))):
        raise HTTPException(status_code=400, detail={"error": "invalid_email"})


def new_message(conversation_id: UUID, role: str, content: str, attachments: list[Attachment] | None = None) -> dict[str, Any]:
    return {
        "id": uuid4(),
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "attachments": [attachment.model_dump() for attachment in attachments or []],
        "created_at": utc_now(),
    }


def get_conn() -> LocalConnection:
    return LocalConnection()


def fetch_conversation(conn: Any, conversation_id: UUID) -> dict[str, Any] | None:
    if isinstance(conn, LocalConnection):
        with _STORE_LOCK:
            conversation = _CONVERSATIONS.get(conversation_id)
            if not conversation:
                return None
            row = dict(conversation)
            row["normalized_fields"] = json.dumps(conversation["normalized_fields"])
            row["messages"] = list(conversation["messages"])
            return row

    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM conversations WHERE id = %s", (conversation_id,))
        return cursor.fetchone()


def persist_intake_brief(conn: Any, conversation_id: UUID, brief: dict[str, Any]) -> UUID:
    if isinstance(conn, LocalConnection):
        with _STORE_LOCK:
            conversation = _CONVERSATIONS[conversation_id]
            conversation["intake_brief"] = brief
            conversation["updated_at"] = utc_now()
        return uuid4()

    with conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO intake_briefs (conversation_id, payload) VALUES (%s, %s) RETURNING id",
            (conversation_id, json.dumps(brief)),
        )
        row = cursor.fetchone()
    return row["id"] if row else uuid4()


def persist_attachments(conn: Any, conversation_id: UUID, attachments: list[Attachment]) -> None:
    if isinstance(conn, LocalConnection):
        with _STORE_LOCK:
            conversation = _CONVERSATIONS[conversation_id]
            conversation["attachments"] = [attachment.model_dump() for attachment in attachments]
            conversation["updated_at"] = utc_now()
        return

    with conn.cursor() as cursor:
        for attachment in attachments:
            cursor.execute(
                "INSERT INTO attachments (conversation_id, payload) VALUES (%s, %s)",
                (conversation_id, json.dumps(attachment.model_dump())),
            )


def log_audit(conn: Any, conversation_id: UUID, event_type: str, payload: dict[str, Any] | None = None) -> None:
    if isinstance(conn, LocalConnection):
        with _STORE_LOCK:
            conversation = _CONVERSATIONS[conversation_id]
            conversation.setdefault("audit_log", []).append(
                {
                    "id": str(uuid4()),
                    "event_type": event_type,
                    "payload": payload or {},
                    "created_at": utc_now().isoformat(),
                }
            )
        return

    with conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO audit_logs (conversation_id, event_type, payload) VALUES (%s, %s, %s)",
            (conversation_id, event_type, json.dumps(payload or {})),
        )


def send_slack_webhook(payload: dict[str, Any]) -> str | None:
    if not SLACK_WEBHOOK_URL:
        return f"local-{uuid4()}"

    request = urllib.request.Request(
        SLACK_WEBHOOK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            if 200 <= response.status < 300:
                return f"sent-{uuid4()}"
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"slack_webhook_failed: {exc.reason}") from exc
    return None


def maybe_post_slack(conn: Any, conversation_id: UUID, brief: dict[str, Any]) -> str | None:
    payload = {"conversation_id": str(conversation_id), "brief": brief}

    if isinstance(conn, LocalConnection):
        with _STORE_LOCK:
            conversation = _CONVERSATIONS[conversation_id]
            if conversation.get("slack_post_id"):
                return conversation["slack_post_id"]
        slack_post_id = send_slack_webhook(payload)
        with _STORE_LOCK:
            _CONVERSATIONS[conversation_id]["slack_post_id"] = slack_post_id
        return slack_post_id

    with conn.cursor() as cursor:
        slack_post_id = f"pending-{uuid4()}"
        cursor.execute(
            "UPDATE conversations SET slack_post_id = %s WHERE id = %s AND slack_post_id IS NULL",
            (slack_post_id, conversation_id),
        )
        if cursor.rowcount != 1:
            return None

    return send_slack_webhook(payload)


def to_conversation_model(row: dict[str, Any]) -> dict[str, Any]:
    normalized_fields = parse_normalized_fields(row.get("normalized_fields"))
    created_at = row.get("created_at", utc_now())
    updated_at = row.get("updated_at", created_at)
    return {
        "id": row["id"],
        "status": row.get("status", "active"),
        "state": row.get("state", "WELCOME"),
        "participant_name": row.get("participant_name") or normalized_fields.get("full_name"),
        "participant_email": row.get("participant_email") or normalized_fields.get("email"),
        "normalized_fields": normalized_fields,
        "messages": row.get("messages", []),
        "attachments": row.get("attachments", []),
        "intake_brief": row.get("intake_brief"),
        "created_at": created_at,
        "updated_at": updated_at,
    }


def update_local_conversation(
    conversation_id: UUID,
    fields: dict[str, str],
    state: str | None = None,
    status: str | None = None,
    attachments: list[Attachment] | None = None,
) -> dict[str, Any]:
    with _STORE_LOCK:
        conversation = _CONVERSATIONS[conversation_id]
        conversation["normalized_fields"] = fields
        if fields.get("full_name"):
            conversation["participant_name"] = fields["full_name"]
        if fields.get("email"):
            conversation["participant_email"] = fields["email"]
        if state:
            conversation["state"] = state
        if status:
            conversation["status"] = status
        if attachments is not None:
            conversation["attachments"] = [attachment.model_dump() for attachment in attachments]
        conversation["updated_at"] = utc_now()
        return dict(conversation)


def create_stripe_draft_invoice(estimate_row: dict[str, Any]) -> dict[str, str]:
    return {
        "provider": "stripe",
        "provider_invoice_id": f"local-invoice-{estimate_row['id']}",
        "provider_invoice_url": "https://payments.local/onb1",
    }


def get_stripe_client() -> Any:
    raise HTTPException(status_code=503, detail="stripe_not_configured")


def post_request_update(*_args, **_kwargs) -> None:
    return None


def approve_estimate(estimate_id: UUID) -> ApproveEstimateResponse:
    with get_conn() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM estimates WHERE id = %s", (estimate_id,))
            estimate_row = cursor.fetchone()
            if not estimate_row:
                raise HTTPException(status_code=404, detail="estimate_not_found")

            cursor.execute("SELECT * FROM invoices WHERE estimate_id = %s", (estimate_id,))
            existing_invoice = cursor.fetchone()
            if existing_invoice:
                return ApproveEstimateResponse(
                    estimate_id=estimate_id,
                    invoice_id=existing_invoice["id"],
                    provider=existing_invoice.get("provider", "stripe"),
                    provider_invoice_id=existing_invoice.get("provider_invoice_id"),
                    provider_invoice_url=existing_invoice.get("provider_invoice_url"),
                )

        stripe_invoice = create_stripe_draft_invoice(estimate_row)
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO invoices (estimate_id, provider_invoice_id, provider_invoice_url) VALUES (%s, %s, %s) RETURNING id",
                (
                    estimate_id,
                    stripe_invoice["provider_invoice_id"],
                    stripe_invoice["provider_invoice_url"],
                ),
            )
            created_invoice = cursor.fetchone() or {"id": uuid4()}

    return ApproveEstimateResponse(
        estimate_id=estimate_id,
        invoice_id=created_invoice["id"],
        provider=stripe_invoice.get("provider", "stripe"),
        provider_invoice_id=stripe_invoice.get("provider_invoice_id"),
        provider_invoice_url=stripe_invoice.get("provider_invoice_url"),
    )


def send_invoice(invoice_id: UUID) -> SendInvoiceResponse:
    with get_conn() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM invoices WHERE id = %s", (invoice_id,))
            invoice_row = cursor.fetchone()
            if not invoice_row:
                raise HTTPException(status_code=404, detail="invoice_not_found")

        if invoice_row.get("sent_at"):
            return SendInvoiceResponse(
                invoice_id=invoice_id,
                provider_invoice_id=invoice_row["provider_invoice_id"],
                provider_invoice_url=invoice_row.get("provider_invoice_url"),
                status="already_sent",
            )

        stripe_client = get_stripe_client()
        stripe_client.Invoice.send_invoice(invoice_row["provider_invoice_id"])

        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE invoices SET sent_at = now() WHERE id = %s",
                (invoice_id,),
            )

    if invoice_row.get("slack_ts") and invoice_row.get("request_id"):
        post_request_update(invoice_row["request_id"], invoice_row["slack_ts"], "Invoice sent")

    return SendInvoiceResponse(
        invoice_id=invoice_id,
        provider_invoice_id=invoice_row["provider_invoice_id"],
        provider_invoice_url=invoice_row.get("provider_invoice_url"),
        status="sent",
    )


def end_and_send(
    conversation_id: UUID,
    payload: EndAndSendRequest | None = None,
    request: Request | None = None,
) -> dict[str, Any]:
    payload = payload or EndAndSendRequest()

    with get_conn() as conn:
        conversation = fetch_conversation(conn, conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="conversation_not_found")

        fields = parse_normalized_fields(conversation.get("normalized_fields"))
        if payload.summary:
            fields["summary"] = clean_text(payload.summary)
        if payload.notes:
            fields["notes"] = clean_text(payload.notes)
        if not fields.get("summary"):
            fields["summary"] = build_summary(fields)

        if isinstance(conn, LocalConnection):
            update_local_conversation(
                conversation_id,
                fields=fields,
                state="SUBMIT",
                status="ended",
                attachments=payload.attachments,
            )
        else:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE conversations SET state = %s WHERE id = %s",
                    ("SUBMIT", conversation_id),
                )

        updated_row = fetch_conversation(conn, conversation_id)
        if not updated_row:
            raise HTTPException(status_code=404, detail="conversation_not_found")

        brief = build_intake_brief(fields, payload.notes)
        persist_intake_brief(conn, conversation_id, brief)
        persist_attachments(conn, conversation_id, payload.attachments)
        log_audit(conn, conversation_id, "end_and_send", {"notes": payload.notes or "", "request_path": request.url.path if request else ""})
        slack_post_id = maybe_post_slack(conn, conversation_id, brief)
        if isinstance(conn, LocalConnection):
            with _STORE_LOCK:
                _CONVERSATIONS[conversation_id]["intake_brief"] = brief
                _CONVERSATIONS[conversation_id]["slack_post_id"] = slack_post_id
                updated_row = dict(_CONVERSATIONS[conversation_id])
                updated_row["normalized_fields"] = json.dumps(_CONVERSATIONS[conversation_id]["normalized_fields"])

        return to_conversation_model(updated_row)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/conversations", status_code=201)
def create_conversation(payload: CreateConversationRequest) -> dict[str, Any]:
    mode = canonical_mode(payload.mode)
    fields = normalize_fields(
        {
            "full_name": payload.participant_name,
            "email": payload.participant_email,
            "mode": mode,
            "role": payload.role,
        }
    )
    conversation_id = uuid4()
    now = utc_now()
    conversation = {
        "id": conversation_id,
        "status": "active",
        "state": "WELCOME",
        "participant_name": fields.get("full_name"),
        "participant_email": fields.get("email"),
        "normalized_fields": fields,
        "messages": [new_message(conversation_id, "assistant", prompt_for_state("WELCOME", fields))],
        "attachments": [],
        "intake_brief": None,
        "audit_log": [],
        "slack_post_id": None,
        "created_at": now,
        "updated_at": now,
    }
    with _STORE_LOCK:
        _CONVERSATIONS[conversation_id] = conversation
    return to_conversation_model(conversation)


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: UUID) -> dict[str, Any]:
    with _STORE_LOCK:
        conversation = _CONVERSATIONS.get(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="conversation_not_found")
        return to_conversation_model(conversation)


@app.post("/api/conversations/{conversation_id}/message", status_code=201)
def create_conversation_message(conversation_id: UUID, payload: CreateMessageRequest) -> dict[str, Any]:
    with _STORE_LOCK:
        conversation = _CONVERSATIONS.get(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="conversation_not_found")
        current_state = conversation["state"]
        existing_fields = dict(conversation["normalized_fields"])

    incoming_fields = normalize_fields(payload.fields)
    merged_fields = {**existing_fields, **incoming_fields}
    if current_state == "SUBMIT":
        return to_conversation_model(conversation)

    validate_required_fields(current_state, merged_fields)
    if not merged_fields.get("summary"):
        merged_fields["summary"] = build_summary(merged_fields)

    user_content = clean_text(payload.content) or summarize_step_response(current_state, merged_fields)
    next_step = next_state(current_state, merged_fields) if payload.advance else current_state

    updated = update_local_conversation(conversation_id, fields=merged_fields, state=next_step)
    with _STORE_LOCK:
        if user_content:
            updated["messages"].append(new_message(conversation_id, "user", user_content, payload.attachments))
        updated["messages"].append(new_message(conversation_id, "assistant", prompt_for_state(next_step, merged_fields)))
        updated["updated_at"] = utc_now()
        _CONVERSATIONS[conversation_id] = updated
        return to_conversation_model(updated)


@app.post("/api/conversations/{conversation_id}/end-and-send")
def end_and_send_endpoint(
    conversation_id: UUID,
    payload: EndAndSendRequest,
    request: Request,
) -> dict[str, Any]:
    conversation = end_and_send(conversation_id, payload=payload, request=request)
    return {"conversation": conversation, "handoffQueued": bool(conversation.get("slack_post_id") or conversation.get("intake_brief"))}


@app.post("/api/uploads/presign", status_code=201)
def create_upload_presign(payload: UploadPresignRequest) -> dict[str, Any]:
    token = uuid4()
    expires_at = utc_now() + timedelta(minutes=15)
    return {
        "upload_url": f"http://localhost:8000/api/uploads/local/{token}",
        "file_url": f"http://localhost:8000/api/uploads/local/{token}/{payload.file_name}",
        "method": "PUT",
        "expires_at": expires_at,
        "headers": {"Content-Type": payload.content_type},
    }


@app.post("/api/handoff/slack", status_code=202)
def send_slack_handoff(payload: SlackHandoffRequest) -> dict[str, Any]:
    message_ts = send_slack_webhook(payload.model_dump())
    return {"accepted": True, "message_ts": message_ts}
