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
    "WELCOME": "Welcome to StorenTech AI. We can scope your intake in a few quick steps.",
    "MODE_SELECT": "Are you a new prospect or an existing client?",
    "IDENTITY": "Great. What is your full name, work email, and optional phone number?",
    "BUSINESS_CONTEXT": "Tell me about your business so we can tailor the intake.",
    "NEEDS": "What are you trying to accomplish with AI right now?",
    "SCHEDULING": "Want to book time now or share a few windows that work for you?",
    "SUMMARY": "Here is the current draft of your intake. Review it, edit anything needed, or send it now.",
    "SUBMIT": "Your intake is queued. We will review it and follow up with next steps.",
}

STATE_FIELDS = {
    "MODE_SELECT": ["mode"],
    "IDENTITY": ["full_name", "email"],
    "BUSINESS_CONTEXT": ["business_name"],
    "NEEDS": ["needs_summary"],
    "SUMMARY": ["summary"],
}

app = FastAPI(
    title="ONB1 API",
    version="0.1.0",
    description="Local-first intake API for ONB1.",
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
    mode: str = "prospect"


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


def build_summary(fields: dict[str, str]) -> str:
    lines: list[str] = []
    if fields.get("full_name"):
        lines.append(f"Name: {fields['full_name']}")
    if fields.get("email"):
        lines.append(f"Email: {fields['email']}")
    if fields.get("phone"):
        lines.append(f"Phone: {fields['phone']}")
    if fields.get("business_name"):
        lines.append(f"Business: {fields['business_name']}")
    if fields.get("industry"):
        lines.append(f"Industry: {fields['industry']}")
    if fields.get("company_size"):
        lines.append(f"Company Size: {fields['company_size']}")
    if fields.get("needs_summary"):
        lines.append(f"Primary Need: {fields['needs_summary']}")
    if fields.get("solution_interest"):
        lines.append(f"Solution Interest: {fields['solution_interest']}")
    if fields.get("timeline"):
        lines.append(f"Timeline: {fields['timeline']}")
    if fields.get("budget_band"):
        lines.append(f"Budget: {fields['budget_band']}")
    if fields.get("preferred_times"):
        timezone_value = fields.get("timezone")
        suffix = f" ({timezone_value})" if timezone_value else ""
        lines.append(f"Availability: {fields['preferred_times']}{suffix}")
    if fields.get("preferred_contact_channel"):
        lines.append(f"Preferred Contact: {fields['preferred_contact_channel']}")
    if fields.get("notes"):
        lines.append(f"Notes: {fields['notes']}")
    return "\n".join(lines)


def build_intake_brief(fields: dict[str, str], notes: str | None = None) -> dict[str, Any]:
    summary = clean_text(fields.get("summary")) or build_summary(fields) or "Prospect requested a StorenTech AI intake."
    goals = [clean_text(fields.get("needs_summary"))] if fields.get("needs_summary") else ["Clarify fit and next steps."]
    constraints: list[str] = []
    if fields.get("timeline"):
        constraints.append(f"Timeline: {fields['timeline']}")
    if fields.get("budget_band"):
        constraints.append(f"Budget: {fields['budget_band']}")
    if fields.get("preferred_contact_channel"):
        constraints.append(f"Contact via {fields['preferred_contact_channel']}")
    if fields.get("preferred_times"):
        timezone_value = fields.get("timezone")
        suffix = f" ({timezone_value})" if timezone_value else ""
        constraints.append(f"Availability: {fields['preferred_times']}{suffix}")
    if notes:
        constraints.append(f"Operator note: {notes}")
    next_steps = [
        "Review the intake summary.",
        "Prepare a follow-up recommendation.",
    ]
    if fields.get("preferred_times"):
        next_steps.append("Offer a call during the preferred windows.")
    else:
        next_steps.append("Follow up by email to schedule a discovery call.")
    return {
        "summary": summary,
        "goals": goals,
        "constraints": constraints or ["No additional constraints captured yet."],
        "timeline": fields.get("timeline"),
        "budget": fields.get("budget_band"),
        "recommended_next_steps": next_steps,
    }


def prompt_for_state(state: str, fields: dict[str, str]) -> str:
    if state == "SUMMARY":
        summary = build_summary(fields)
        if summary:
            return f"{STATE_PROMPTS[state]}\n\n{summary}"
    if state == "SUBMIT" and fields.get("mode") == "client":
        return "Existing-client intake is queued for the next build. Leave a note and we will follow up manually."
    return STATE_PROMPTS[state]


def summarize_step_response(state: str, fields: dict[str, str]) -> str:
    if state == "WELCOME":
        return "Ready to start."
    if state == "MODE_SELECT":
        return "Existing client" if fields.get("mode") == "client" else "New prospect"
    if state == "IDENTITY":
        pieces = [fields.get("full_name", "")]
        if fields.get("email"):
            pieces.append(fields["email"])
        return " | ".join(piece for piece in pieces if piece)
    if state == "BUSINESS_CONTEXT":
        pieces = [fields.get("business_name", "")]
        if fields.get("industry"):
            pieces.append(fields["industry"])
        return " | ".join(piece for piece in pieces if piece)
    if state == "NEEDS":
        return fields.get("needs_summary", "")
    if state == "SCHEDULING":
        if fields.get("preferred_times"):
            return fields["preferred_times"]
        return fields.get("scheduling_option", "Skipped scheduling")
    if state == "SUMMARY":
        return fields.get("summary", build_summary(fields))
    return ""


def next_state(current_state: str, fields: dict[str, str]) -> str:
    if current_state == "WELCOME":
        return "MODE_SELECT"
    if current_state == "MODE_SELECT":
        return "SUBMIT" if clean_text(fields.get("mode")).lower() == "client" else "IDENTITY"
    if current_state == "IDENTITY":
        return "BUSINESS_CONTEXT"
    if current_state == "BUSINESS_CONTEXT":
        return "NEEDS"
    if current_state == "NEEDS":
        return "SUMMARY" if as_bool(fields.get("skip_scheduling")) else "SCHEDULING"
    if current_state == "SCHEDULING":
        return "SUMMARY"
    if current_state == "SUMMARY":
        return "SUBMIT"
    return "SUBMIT"


def validate_required_fields(state: str, fields: dict[str, str]) -> None:
    if state == "SCHEDULING":
        if clean_text(fields.get("scheduling_option")).lower() == "link":
            return
        required = [field for field in ["preferred_times", "timezone"] if not clean_text(fields.get(field))]
        if required:
            raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": required})
        return

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
    fields = normalize_fields(
        {
            "full_name": payload.participant_name,
            "email": payload.participant_email,
            "mode": payload.mode,
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
