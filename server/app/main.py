from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
import secrets
import re
import time
import urllib.request
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4

import boto3
import stripe
from botocore.config import Config
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from psycopg import connect
from psycopg.rows import dict_row
from cryptography.fernet import Fernet, InvalidToken

app = FastAPI(title="ONB1 API")

origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
if origins_raw == "*":
    allow_origins = ["*"]
else:
    allow_origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_UPLOAD_TYPES = [
    t.strip() for t in os.getenv("ALLOWED_UPLOAD_TYPES", "image/png,image/jpeg,application/pdf").split(",") if t.strip()
]
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "10485760"))
REQUIRE_CAPTCHA = os.getenv("REQUIRE_CAPTCHA", "false").lower() in {"1", "true", "yes"}
CAPTCHA_BYPASS_TOKEN = os.getenv("CAPTCHA_BYPASS_TOKEN", "")
RATE_LIMIT_CREATE_PER_MIN = int(os.getenv("RATE_LIMIT_CREATE_PER_MIN", "10"))
RATE_LIMIT_MESSAGE_PER_MIN = int(os.getenv("RATE_LIMIT_MESSAGE_PER_MIN", "60"))
OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
OTP_PEPPER = os.getenv("OTP_PEPPER", "")
ALLOW_DEV_OTP = os.getenv("ALLOW_DEV_OTP", "false").lower() in {"1", "true", "yes"}
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "24"))
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")
SLACK_REQUEST_CHANNEL = os.getenv("SLACK_REQUEST_CHANNEL", "#onb1-intake")
STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SENSITIVE_FIELDS = {"email", "phone"}

RATE_LIMIT_STORE: Dict[str, Dict[str, List[float]]] = {
    "create": {},
    "message": {},
    "auth": {},
    "request": {},
}


STATE_ORDER = [
    "WELCOME",
    "MODE_SELECT",
    "IDENTITY",
    "BUSINESS_CONTEXT",
    "NEEDS",
    "SCHEDULING",
    "SUMMARY",
    "SUBMIT",
]

STATE_REQUIREMENTS = {
    "MODE_SELECT": ["mode"],
    "IDENTITY": ["full_name", "email"],
    "BUSINESS_CONTEXT": ["business_name"],
    "NEEDS": ["needs_summary"],
    "SCHEDULING": [],
    "SUMMARY": ["summary"],
}


class IntakeBrief(BaseModel):
    summary: str
    goals: Optional[str] = None
    constraints: Optional[str] = None


class Conversation(BaseModel):
    id: UUID
    account_id: UUID
    contact_id: Optional[UUID] = None
    channel: str
    subject: Optional[str] = None
    intake_brief: Optional[IntakeBrief] = None
    mode: str
    state: str
    normalized_fields: Dict[str, Any]
    summary: Optional[str] = None
    ended_at: Optional[datetime] = None
    created_at: datetime


class ConversationCreate(BaseModel):
    account_id: UUID
    contact_id: Optional[UUID] = None
    channel: str
    subject: Optional[str] = None
    intake_brief: Optional[IntakeBrief] = None


class Message(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_type: str
    sender_contact_id: Optional[UUID] = None
    body: str
    created_at: datetime


class MessageCreate(BaseModel):
    sender_type: str
    sender_contact_id: Optional[UUID] = None
    body: str
    fields: Optional[Dict[str, Any]] = None


class EndAndSendRequest(BaseModel):
    summary: Optional[str] = None


class UploadPresignRequest(BaseModel):
    file_name: str
    content_type: str
    content_length: Optional[int] = None
    conversation_id: Optional[UUID] = None


class UploadLink(BaseModel):
    upload_url: str
    file_url: str
    key: str
    max_size: int


class SlackHandoffRequest(BaseModel):
    conversation_id: UUID
    channel: str
    text: str


class SlackHandoffResponse(BaseModel):
    status: str


class AuthRequest(BaseModel):
    email: str


class AuthVerifyRequest(BaseModel):
    challenge_id: UUID
    code: str


class ClientRequestCreate(BaseModel):
    project_id: UUID
    request_type: str
    description: str
    impact: str
    urgency: str
    attachments: Optional[List[Dict[str, Any]]] = None


class RequestUpdate(BaseModel):
    message: str


class EstimateDraft(BaseModel):
    id: UUID
    request_id: UUID
    min_total_cents: int
    max_total_cents: int
    currency: str
    status: str
    line_items: List[Dict[str, Any]]


class EstimateApproveResponse(BaseModel):
    estimate_id: UUID
    invoice_id: UUID
    provider_invoice_id: Optional[str] = None
    provider_invoice_url: Optional[str] = None


class InvoiceSendResponse(BaseModel):
    invoice_id: UUID
    provider_invoice_id: Optional[str] = None
    provider_invoice_url: Optional[str] = None
    status: str


def get_conn():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not set")
    return connect(database_url, row_factory=dict_row)


def parse_json(value: Optional[str]) -> Dict[str, Any]:
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    return json.loads(value)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(bucket: str, key: str, limit: int, window_seconds: int = 60) -> None:
    if limit <= 0:
        return
    now = time.time()
    entries = RATE_LIMIT_STORE[bucket].setdefault(key, [])
    entries[:] = [ts for ts in entries if now - ts < window_seconds]
    if len(entries) >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    entries.append(now)


def verify_captcha(request: Request) -> None:
    if not REQUIRE_CAPTCHA:
        return
    token = request.headers.get("x-captcha-token")
    if token and CAPTCHA_BYPASS_TOKEN and token == CAPTCHA_BYPASS_TOKEN:
        return
    raise HTTPException(status_code=403, detail="Captcha required")


def get_fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="ENCRYPTION_KEY is not set")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(value: str) -> str:
    if not value:
        return value
    fernet = get_fernet()
    return "enc:" + fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    if not value:
        return value
    if not isinstance(value, str) or not value.startswith("enc:"):
        return value
    fernet = get_fernet()
    token = value[4:]
    try:
        return fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def encrypt_fields(fields: Dict[str, Any]) -> Dict[str, Any]:
    encrypted = dict(fields)
    for key in SENSITIVE_FIELDS:
        if key in encrypted and encrypted[key]:
            encrypted[key] = encrypt_value(str(encrypted[key]))
    return encrypted


def decrypt_normalized_fields(normalized: Dict[str, Any]) -> Dict[str, Any]:
    decrypted = dict(normalized)
    for key in SENSITIVE_FIELDS:
        if key in decrypted and decrypted[key]:
            decrypted[key] = decrypt_value(str(decrypted[key]))
    return decrypted


def next_state(current_state: str, fields: Dict[str, Any]) -> str:
    if current_state == "WELCOME":
        return "MODE_SELECT"
    if current_state == "MODE_SELECT" and fields.get("mode") == "client":
        return "SUBMIT"
    if current_state == "NEEDS":
        skip = str(fields.get("skip_scheduling", "")).lower() in {"true", "1", "yes"}
        if skip:
            return "SUMMARY"
        return "SCHEDULING"
    idx = STATE_ORDER.index(current_state)
    if current_state == "SUBMIT":
        return "SUBMIT"
    return STATE_ORDER[min(idx + 1, len(STATE_ORDER) - 1)]


def validate_required_fields(current_state: str, fields: Dict[str, Any]) -> None:
    if current_state == "SCHEDULING":
        scheduling_option = fields.get("scheduling_option")
        preferred_times = fields.get("preferred_times")
        timezone = fields.get("timezone")
        if scheduling_option == "link":
            return
        if preferred_times and timezone:
            return
        missing = []
        if not preferred_times:
            missing.append("preferred_times")
        if not timezone:
            missing.append("timezone")
        raise HTTPException(
            status_code=400,
            detail={"error": "missing_fields", "fields": missing, "state": current_state},
        )

    required = STATE_REQUIREMENTS.get(current_state, [])
    missing = [key for key in required if not fields.get(key)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail={"error": "missing_fields", "fields": missing, "state": current_state},
        )


def fetch_conversation(conn, conversation_id: UUID) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, account_id, contact_id, channel, subject, mode, state,
                   normalized_fields, summary, ended_at, created_at,
                   slack_posted_at, slack_post_id
              FROM conversations
             WHERE id = %s
            """,
            (conversation_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return row


def to_conversation_model(row: dict) -> Conversation:
    normalized = parse_json(row.get("normalized_fields"))
    normalized = decrypt_normalized_fields(normalized)
    intake_brief = normalized.get("intake_brief")
    return Conversation(
        id=row["id"],
        account_id=row["account_id"],
        contact_id=row.get("contact_id"),
        channel=row["channel"],
        subject=row.get("subject"),
        intake_brief=IntakeBrief(**intake_brief) if intake_brief else None,
        mode=row["mode"],
        state=row["state"],
        normalized_fields=normalized,
        summary=row.get("summary"),
        ended_at=row.get("ended_at"),
        created_at=row["created_at"],
    )


def persist_intake_brief(conn, conversation: dict, normalized: Dict[str, Any]) -> Optional[UUID]:
    summary = normalized.get("summary") or normalized.get("needs_summary") or "Prospect intake"
    goals = normalized.get("goals")
    constraints = normalized.get("constraints")
    scheduling_option = normalized.get("scheduling_option")
    booking_url = normalized.get("booking_url")
    preferred_times = normalized.get("preferred_times")
    timezone_value = normalized.get("timezone")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO intake_briefs (
                account_id, project_id, summary, goals, constraints,
                scheduling_option, booking_url, preferred_times, timezone
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                conversation["account_id"],
                None,
                summary,
                goals,
                constraints,
                scheduling_option,
                booking_url,
                preferred_times,
                timezone_value,
            ),
        )
        return cur.fetchone()["id"]


def persist_attachments(conn, conversation_id: UUID, intake_brief_id: Optional[UUID], attachments: List[Dict[str, Any]]) -> None:
    if not attachments:
        return
    with conn.cursor() as cur:
        for attachment in attachments:
            cur.execute(
                """
                INSERT INTO attachments (
                    conversation_id, intake_brief_id, file_name, content_type, size_bytes, storage_key, storage_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    conversation_id,
                    intake_brief_id,
                    attachment.get("file_name"),
                    attachment.get("content_type"),
                    attachment.get("size"),
                    attachment.get("key"),
                    attachment.get("url"),
                ),
            )


def persist_request_attachments(conn, request_id: UUID, attachments: List[Dict[str, Any]]) -> None:
    if not attachments:
        return
    with conn.cursor() as cur:
        for attachment in attachments:
            cur.execute(
                """
                INSERT INTO attachments (
                    conversation_id, intake_brief_id, request_id, file_name, content_type, size_bytes, storage_key, storage_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    None,
                    None,
                    request_id,
                    attachment.get("file_name"),
                    attachment.get("content_type"),
                    attachment.get("size"),
                    attachment.get("key"),
                    attachment.get("url"),
                ),
            )


def log_audit(conn, conversation_id: UUID, event_type: str, metadata: Dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_logs (event_type, conversation_id, metadata)
            VALUES (%s, %s, %s)
            """,
            (event_type, conversation_id, json.dumps(metadata)),
        )


def build_slack_payload(conversation_id: UUID, normalized: Dict[str, Any]) -> dict:
    normalized = decrypt_normalized_fields(normalized)
    admin_base = os.getenv("ADMIN_BASE_URL", "http://localhost:8000")
    admin_link = f"{admin_base.rstrip('/')}/conversations/{conversation_id}"
    slack_channel = os.getenv("SLACK_CHANNEL")

    full_name = normalized.get("full_name") or "Unknown"
    email = normalized.get("email") or ""
    business_name = normalized.get("business_name") or "Unknown"

    needs = normalized.get("needs_summary")
    urgency = normalized.get("urgency")
    budget_band = normalized.get("budget_band")
    preferred_channel = normalized.get("preferred_contact_channel")
    preferred_times = normalized.get("preferred_times")
    timezone = normalized.get("timezone")
    booking_url = normalized.get("booking_url")
    summary = normalized.get("summary")
    attachments = normalized.get("attachments") or []

    bullets = []
    if needs:
        bullets.append(f"• Needs: {needs}")
    if urgency:
        bullets.append(f"• Urgency: {urgency}")
    if budget_band:
        bullets.append(f"• Budget: {budget_band}")
    if summary:
        bullets.append(f"• Summary: {summary}")

    contact_line = f"*Contact:* {full_name}"
    if email:
        contact_line += f" ({email})"

    fields_lines = []
    if preferred_channel:
        fields_lines.append(f"*Preferred Channel:* {preferred_channel}")
    if preferred_times:
        times_line = preferred_times
        if timezone:
            times_line = f"{preferred_times} ({timezone})"
        fields_lines.append(f"*Preferred Times:* {times_line}")
    if booking_url:
        fields_lines.append(f"*Booking Link:* {booking_url}")

    attachment_lines = []
    for attachment in attachments:
        name = attachment.get("file_name") or "Attachment"
        url = attachment.get("url") or ""
        if url:
            attachment_lines.append(f"• <{url}|{name}>")
        else:
            attachment_lines.append(f"• {name}")

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": "Prospect Intake"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": contact_line}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Company:* {business_name}"}},
    ]

    if bullets:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(bullets)}})

    if fields_lines:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(fields_lines)}})

    if attachment_lines:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "*Attachments:*\n" + "\n".join(attachment_lines)}})

    blocks.append(
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Admin:* {admin_link}"},
        }
    )

    payload = {
        "text": "Prospect Intake",
        "blocks": blocks,
    }
    if slack_channel:
        payload["channel"] = slack_channel
    return payload


def send_slack_webhook(payload: dict) -> None:
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        raise HTTPException(status_code=500, detail="SLACK_WEBHOOK_URL is not set")

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
                if resp.status >= 200 and resp.status < 300 and body.strip() == "ok":
                    return
                last_error = f"Slack webhook error: {resp.status} {body}"
        except Exception as exc:  # pragma: no cover - network errors
            last_error = str(exc)
        time.sleep(2 ** attempt)

    raise HTTPException(status_code=502, detail=f"Slack webhook failed: {last_error}")


def slack_api_call(method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not SLACK_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="SLACK_BOT_TOKEN is not set")
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"https://slack.com/api/{method}",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SLACK_BOT_TOKEN}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read().decode("utf-8")
    parsed = json.loads(body)
    if not parsed.get("ok"):
        raise HTTPException(status_code=502, detail=f"Slack API error: {parsed.get('error')}")
    return parsed


def build_request_slack_payload(
    request_id: UUID, project: Dict[str, Any], payload: ClientRequestCreate, addon: Dict[str, Any]
) -> Dict[str, Any]:
    attachments = payload.attachments or []
    attachment_lines = []
    for attachment in attachments:
        name = attachment.get("file_name") or "Attachment"
        url = attachment.get("url") or ""
        if url:
            attachment_lines.append(f"• <{url}|{name}>")
        else:
            attachment_lines.append(f"• {name}")

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": "Client Request"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Project:* {project.get('name', 'Unknown')}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Type:* {payload.request_type}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Impact:* {payload.impact}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Urgency:* {payload.urgency}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Description:* {payload.description}"}},
    ]
    if addon.get("addon_flag"):
        rationale = addon.get("addon_rationale") or "outside scope"
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"*Add-on Likely:* {rationale}"}})
    if attachment_lines:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "*Attachments:*\n" + "\n".join(attachment_lines)}})

    return {
        "channel": SLACK_REQUEST_CHANNEL,
        "text": f"Client Request ({request_id})",
        "blocks": blocks,
    }


def post_request_to_slack(request_id: UUID, project: Dict[str, Any], payload: ClientRequestCreate, addon: Dict[str, Any]) -> str:
    response = slack_api_call("chat.postMessage", build_request_slack_payload(request_id, project, payload, addon))
    return response.get("ts")


def post_request_update(request_id: UUID, thread_ts: str, message: str) -> None:
    slack_api_call(
        "chat.postMessage",
        {
            "channel": SLACK_REQUEST_CHANNEL,
            "thread_ts": thread_ts,
            "text": f"Update for request {request_id}: {message}",
        },
    )


def load_estimate_template(conn, request_type: str) -> Dict[str, Any]:
    name_map = {
        "bug": "Bug Fix",
        "change": "Change Request",
        "new": "New Feature",
    }
    template_name = name_map.get(request_type.lower(), "Change Request")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, line_items, min_total_cents, max_total_cents
              FROM estimate_templates
             WHERE name = %s
             LIMIT 1
            """,
            (template_name,),
        )
        row = cur.fetchone()
    if not row:
        return {
            "name": template_name,
            "line_items": [],
            "min_total_cents": 0,
            "max_total_cents": 0,
        }
    return row


def create_draft_estimate(conn, request_id: UUID, request_type: str) -> Dict[str, Any]:
    template = load_estimate_template(conn, request_type)
    min_total = int(template.get("min_total_cents") or 0)
    max_total = int(template.get("max_total_cents") or 0)
    currency = "USD"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estimates (request_id, amount_cents, currency, status)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (request_id, max_total, currency, "draft"),
        )
        estimate_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO audit_logs (event_type, conversation_id, metadata)
            VALUES (%s, %s, %s)
            """,
            ("estimate_draft_created", None, json.dumps({"estimate_id": str(estimate_id), "request_id": str(request_id)})),
        )
    return {
        "id": estimate_id,
        "request_id": request_id,
        "min_total_cents": min_total,
        "max_total_cents": max_total,
        "currency": currency,
        "status": "draft",
        "line_items": template.get("line_items") or [],
    }


def get_account_primary_email(conn, account_id: UUID) -> Optional[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT email
              FROM contacts
             WHERE account_id = %s
             ORDER BY created_at ASC
             LIMIT 1
            """,
            (account_id,),
        )
        row = cur.fetchone()
    return row["email"] if row else None


def get_or_create_stripe_customer(conn, account_id: UUID, account_name: str, email: Optional[str]) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT stripe_customer_id
              FROM accounts
             WHERE id = %s
            """,
            (account_id,),
        )
        row = cur.fetchone()
        if row and row.get("stripe_customer_id"):
            return row["stripe_customer_id"]

    stripe_client = get_stripe_client()
    customer = stripe_client.Customer.create(
        name=account_name or "ONB1 Client",
        email=email,
    )
    customer_id = customer["id"]

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE accounts
               SET stripe_customer_id = %s
             WHERE id = %s
            """,
            (customer_id, account_id),
        )
    return customer_id


def create_stripe_draft_invoice(
    conn, estimate_id: UUID, account_id: UUID, account_name: str, amount_cents: int, currency: str
) -> Dict[str, Any]:
    stripe_client = get_stripe_client()
    customer_email = get_account_primary_email(conn, account_id)
    customer_id = get_or_create_stripe_customer(conn, account_id, account_name, customer_email)

    stripe_client.InvoiceItem.create(
        customer=customer_id,
        amount=amount_cents,
        currency=currency.lower(),
        description=f"Estimate {estimate_id} (draft)",
    )

    invoice = stripe_client.Invoice.create(
        customer=customer_id,
        auto_advance=False,
        collection_method="send_invoice",
    )

    return {
        "provider": "stripe",
        "provider_invoice_id": invoice.get("id"),
        "provider_invoice_url": invoice.get("hosted_invoice_url"),
    }

def extract_integration_mentions(description: str) -> List[str]:
    if not description:
        return []
    matches = re.findall(r"(?:integrate|integration|connect|connected|add|hook)\s+(?:with\s+|to\s+)?([A-Za-z0-9._-]+)", description, re.IGNORECASE)
    return [m.lower() for m in matches]


def evaluate_addon(payload: ClientRequestCreate, project_metadata: Dict[str, Any]) -> Dict[str, Any]:
    reasons = []
    integrations = [i.lower() for i in project_metadata.get("integrations", [])]
    sla_same_day = bool(project_metadata.get("sla_same_day", False))

    if payload.request_type.lower() == "new":
        reasons.append("request_type=new")

    mentioned = extract_integration_mentions(payload.description or "")
    new_integrations = [m for m in mentioned if m and m not in integrations]
    if new_integrations:
        reasons.append(f"new_integration={','.join(new_integrations)}")

    urgency = payload.urgency.lower()
    if urgency in {"urgent", "same-day", "today", "asap"} and not sla_same_day:
        reasons.append("same_day_no_sla")

    return {
        "addon_flag": len(reasons) > 0,
        "addon_rationale": "; ".join(reasons) if reasons else None,
    }


def maybe_post_slack(conn, conversation_id: UUID, normalized: Dict[str, Any]) -> None:
    if not os.getenv("SLACK_WEBHOOK_URL"):
        print("skipped slack: SLACK_WEBHOOK_URL not set")
        return
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE conversations
               SET slack_post_id = %s
             WHERE id = %s
               AND slack_posted_at IS NULL
               AND slack_post_id IS NULL
            """,
            (str(uuid4()), conversation_id),
        )
        claimed = cur.rowcount == 1

    if not claimed:
        return

    payload = build_slack_payload(conversation_id, normalized)
    try:
        send_slack_webhook(payload)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE conversations
                   SET slack_posted_at = %s
                 WHERE id = %s
                """,
                (now_utc(), conversation_id),
            )
    except HTTPException:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE conversations
                   SET slack_post_id = NULL
                 WHERE id = %s
                """,
                (conversation_id,),
            )
        raise


def get_s3_client():
    region = os.getenv("AWS_REGION")
    if not region:
        raise HTTPException(status_code=500, detail="AWS_REGION is not set")
    return boto3.client("s3", region_name=region, config=Config(signature_version="s3v4"))


def get_stripe_client():
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="STRIPE_API_KEY is not set")
    stripe.api_key = STRIPE_API_KEY
    return stripe


def build_storage_key(file_name: str, conversation_id: Optional[UUID]) -> str:
    safe_name = file_name.replace(" ", "_")
    prefix = f"conversations/{conversation_id}" if conversation_id else "uploads"
    return f"{prefix}/{uuid4()}-{safe_name}"


def get_public_url(bucket: str, key: str) -> str:
    base = os.getenv("S3_PUBLIC_BASE_URL")
    if base:
        return f"{base.rstrip('/')}/{key}"
    region = os.getenv("AWS_REGION", "us-west-2")
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def validate_upload_request(payload: UploadPresignRequest) -> None:
    if payload.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    if payload.content_length is None:
        raise HTTPException(status_code=400, detail="content_length is required")
    if payload.content_length > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large")


def hash_code(code: str) -> str:
    return hashlib.sha256(f"{code}{OTP_PEPPER}".encode("utf-8")).hexdigest()


def create_session(conn, account_id: UUID) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = now_utc() + timedelta(hours=SESSION_TTL_HOURS)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO auth_sessions (account_id, token, expires_at)
            VALUES (%s, %s, %s)
            """,
            (account_id, token, expires_at),
        )
    return token


def require_session(conn, request: Request) -> UUID:
    header = request.headers.get("authorization") or ""
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = header.split(" ", 1)[1].strip()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT account_id, expires_at
              FROM auth_sessions
             WHERE token = %s
            """,
            (token,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    if row["expires_at"] < now_utc():
        raise HTTPException(status_code=401, detail="Auth token expired")
    return row["account_id"]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/conversations", response_model=Conversation, status_code=201)
def create_conversation(payload: ConversationCreate, request: Request):
    enforce_rate_limit("create", get_client_ip(request), RATE_LIMIT_CREATE_PER_MIN)
    verify_captcha(request)
    normalized = {}
    if payload.intake_brief:
        normalized["intake_brief"] = payload.intake_brief.dict()
    with get_conn() as conn:
        with conn.cursor() as cur:
            if payload.intake_brief:
                cur.execute(
                    """
                    INSERT INTO intake_briefs (account_id, project_id, summary, goals, constraints)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        payload.account_id,
                        None,
                        payload.intake_brief.summary,
                        payload.intake_brief.goals,
                        payload.intake_brief.constraints,
                    ),
                )
            cur.execute(
                """
                INSERT INTO conversations (account_id, contact_id, channel, subject, mode, state, normalized_fields)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, account_id, contact_id, channel, subject, mode, state,
                          normalized_fields, summary, ended_at, created_at,
                          slack_posted_at, slack_post_id
                """,
                (
                    payload.account_id,
                    payload.contact_id,
                    payload.channel,
                    payload.subject,
                    "prospect",
                    "WELCOME",
                    json.dumps(normalized),
                ),
            )
            row = cur.fetchone()
    return to_conversation_model(row)


@app.get("/api/conversations/{id}", response_model=Conversation)
def get_conversation(id: UUID):
    with get_conn() as conn:
        conversation = fetch_conversation(conn, id)
    return to_conversation_model(conversation)


@app.post("/api/conversations/{id}/message", response_model=Message, status_code=201)
def post_message(id: UUID, payload: MessageCreate, request: Request):
    enforce_rate_limit("message", get_client_ip(request), RATE_LIMIT_MESSAGE_PER_MIN)
    fields = payload.fields or {}
    with get_conn() as conn:
        conversation = fetch_conversation(conn, id)
        current_state = conversation["state"]

        if payload.sender_type == "contact" and current_state != "SUBMIT":
            validate_required_fields(current_state, fields)
            next_state_value = next_state(current_state, fields)
        else:
            next_state_value = current_state

        normalized = parse_json(conversation.get("normalized_fields"))
        if fields:
            if "attachments" in fields:
                existing = normalized.get("attachments", [])
                normalized["attachments"] = existing + fields.get("attachments", [])
                fields = {k: v for k, v in fields.items() if k != "attachments"}
            encrypted_fields = encrypt_fields(fields)
            normalized.update(encrypted_fields)

        summary_value = conversation.get("summary")
        if fields.get("summary"):
            summary_value = fields.get("summary")

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO messages (conversation_id, sender_type, sender_contact_id, body)
                VALUES (%s, %s, %s, %s)
                RETURNING id, conversation_id, sender_type, sender_contact_id, body, created_at
                """,
                (id, payload.sender_type, payload.sender_contact_id, payload.body),
            )
            message_row = cur.fetchone()

            cur.execute(
                """
                UPDATE conversations
                   SET state = %s,
                       normalized_fields = %s,
                       summary = %s
                 WHERE id = %s
                """,
                (next_state_value, json.dumps(normalized), summary_value, id),
            )

        if next_state_value == "SUBMIT":
            intake_brief_id = persist_intake_brief(conn, conversation, normalized)
            persist_attachments(conn, id, intake_brief_id, normalized.get("attachments") or [])
            log_audit(
                conn,
                id,
                "submit",
                {
                    "ip": get_client_ip(request),
                    "state": current_state,
                    "attachments": len(normalized.get("attachments") or []),
                },
            )
            maybe_post_slack(conn, id, normalized)

    return Message(**message_row)


@app.post("/api/conversations/{id}/end-and-send", response_model=Conversation)
def end_and_send(id: UUID, payload: Optional[EndAndSendRequest] = None, request: Request = None):
    summary_value = payload.summary if payload else None
    with get_conn() as conn:
        conversation = fetch_conversation(conn, id)
        normalized = parse_json(conversation.get("normalized_fields"))
        if summary_value:
            normalized["summary"] = summary_value
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE conversations
                   SET state = %s,
                       summary = %s,
                       ended_at = %s,
                       normalized_fields = %s
                 WHERE id = %s
                """,
                ("SUBMIT", summary_value, now_utc(), json.dumps(normalized), id),
            )

        intake_brief_id = persist_intake_brief(conn, conversation, normalized)
        persist_attachments(conn, id, intake_brief_id, normalized.get("attachments") or [])
        log_audit(
            conn,
            id,
            "submit",
            {
                "ip": get_client_ip(request) if request else "unknown",
                "state": conversation.get("state"),
                "attachments": len(normalized.get("attachments") or []),
                "end_and_send": True,
            },
        )
        maybe_post_slack(conn, id, normalized)
        updated = fetch_conversation(conn, id)

    return to_conversation_model(updated)


@app.post("/api/uploads/presign", response_model=UploadLink)
def create_upload_presign(payload: UploadPresignRequest):
    validate_upload_request(payload)
    bucket = os.getenv("S3_BUCKET")
    if not bucket:
        raise HTTPException(status_code=500, detail="S3_BUCKET is not set")

    key = build_storage_key(payload.file_name, payload.conversation_id)
    s3_client = get_s3_client()
    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": payload.content_type,
        },
        ExpiresIn=900,
    )

    file_url = get_public_url(bucket, key)
    return UploadLink(upload_url=upload_url, file_url=file_url, key=key, max_size=MAX_UPLOAD_BYTES)


@app.post("/api/auth/request-otp")
def request_otp(payload: AuthRequest, request: Request):
    enforce_rate_limit("auth", get_client_ip(request), 10)
    verify_captcha(request)
    email = payload.email.strip().lower()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT account_id
                  FROM contacts
                 WHERE lower(email) = %s
                """,
                (email,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Email not found")
            account_id = row["account_id"]

            code = f"{secrets.randbelow(1000000):06d}"
            code_hash = hash_code(code)
            expires_at = now_utc() + timedelta(minutes=OTP_TTL_MINUTES)
            cur.execute(
                """
                INSERT INTO auth_codes (account_id, email, code_hash, expires_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (account_id, email, code_hash, expires_at),
            )
            challenge_id = cur.fetchone()["id"]

    response = {
        "challenge_id": str(challenge_id),
        "expires_at": expires_at.isoformat(),
    }
    if ALLOW_DEV_OTP:
        response["dev_code"] = code
    return response


@app.post("/api/auth/verify-otp")
def verify_otp(payload: AuthVerifyRequest, request: Request):
    enforce_rate_limit("auth", get_client_ip(request), 20)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, account_id, code_hash, expires_at, used_at, attempts
                  FROM auth_codes
                 WHERE id = %s
                """,
                (payload.challenge_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Invalid challenge")
            if row["used_at"] is not None or row["expires_at"] < now_utc():
                raise HTTPException(status_code=400, detail="Code expired")
            if row["attempts"] >= 5:
                raise HTTPException(status_code=429, detail="Too many attempts")

            if hash_code(payload.code.strip()) != row["code_hash"]:
                cur.execute(
                    """
                    UPDATE auth_codes
                       SET attempts = attempts + 1
                     WHERE id = %s
                    """,
                    (payload.challenge_id,),
                )
                raise HTTPException(status_code=401, detail="Invalid code")

            cur.execute(
                """
                UPDATE auth_codes
                   SET used_at = %s
                 WHERE id = %s
                """,
                (now_utc(), payload.challenge_id),
            )

        token = create_session(conn, row["account_id"])

    return {"token": token, "account_id": str(row["account_id"])}


@app.get("/api/projects")
def list_projects(request: Request):
    with get_conn() as conn:
        account_id = require_session(conn, request)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, status, start_date, end_date
                  FROM projects
                 WHERE account_id = %s
                 ORDER BY created_at DESC
                """,
                (account_id,),
            )
            rows = cur.fetchall()
    return rows


@app.post("/api/requests")
def create_request(payload: ClientRequestCreate, request: Request):
    enforce_rate_limit("request", get_client_ip(request), 20)
    with get_conn() as conn:
        account_id = require_session(conn, request)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, metadata
                  FROM projects
                 WHERE id = %s AND account_id = %s
                """,
                (payload.project_id, account_id),
            )
            project = cur.fetchone()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

        project_metadata = project.get("metadata") or {}
        addon = evaluate_addon(payload, project_metadata)

        request_id = uuid4()
        slack_ts = post_request_to_slack(request_id, project, payload, addon)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO requests (
                    id, project_id, requester_contact_id, title, description, status,
                    request_type, impact, urgency, slack_channel, slack_ts,
                    addon_flag, addon_rationale
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    request_id,
                    payload.project_id,
                    None,
                    payload.request_type,
                    payload.description,
                    "open",
                    payload.request_type,
                    payload.impact,
                    payload.urgency,
                    SLACK_REQUEST_CHANNEL,
                    slack_ts,
                    addon["addon_flag"],
                    addon["addon_rationale"],
                ),
            )
            persist_request_attachments(conn, request_id, payload.attachments or [])
            log_audit(
                conn,
                None,
                "client_request_submit",
                {
                    "request_id": str(request_id),
                    "project_id": str(payload.project_id),
                    "attachments": len(payload.attachments or []),
                },
            )
            estimate = create_draft_estimate(conn, request_id, payload.request_type)
        client_message = None
        if addon["addon_flag"]:
            client_message = "This may be outside scope; we'll confirm with an estimate."
        return {
            "id": str(request_id),
            "slack_ts": slack_ts,
            "addon_flag": addon["addon_flag"],
            "addon_rationale": addon["addon_rationale"],
            "client_message": client_message,
            "estimate": estimate,
        }


@app.get("/admin/estimates")
def list_estimates_admin():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.id, e.request_id, e.amount_cents, e.currency, e.status, e.created_at
                  FROM estimates e
                 ORDER BY e.created_at DESC
                 LIMIT 50
                """
            )
            rows = cur.fetchall()
    return {"items": rows}


@app.post("/admin/estimates/{id}/approve", response_model=EstimateApproveResponse)
def approve_estimate(id: UUID):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.id, e.request_id, e.amount_cents, e.currency, e.status,
                       r.project_id, p.account_id, a.name as account_name
                  FROM estimates e
                  JOIN requests r ON e.request_id = r.id
                  JOIN projects p ON r.project_id = p.id
                  JOIN accounts a ON p.account_id = a.id
                 WHERE e.id = %s
                """,
                (id,),
            )
            estimate = cur.fetchone()
            if not estimate:
                raise HTTPException(status_code=404, detail="Estimate not found")

            cur.execute(
                """
                SELECT id, provider_invoice_id, provider_invoice_url
                  FROM invoices
                 WHERE estimate_id = %s
                """,
                (id,),
            )
            existing = cur.fetchone()
            if existing:
                return EstimateApproveResponse(
                    estimate_id=id,
                    invoice_id=existing["id"],
                    provider_invoice_id=existing.get("provider_invoice_id"),
                    provider_invoice_url=existing.get("provider_invoice_url"),
                )

        provider_data = create_stripe_draft_invoice(
            conn,
            estimate["id"],
            estimate["account_id"],
            estimate["account_name"],
            estimate["amount_cents"],
            estimate["currency"],
        )

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO invoices (
                    project_id, estimate_id, amount_cents, currency, status,
                    provider, provider_invoice_id, provider_invoice_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    estimate["project_id"],
                    estimate["id"],
                    estimate["amount_cents"],
                    estimate["currency"],
                    "draft",
                    provider_data.get("provider"),
                    provider_data.get("provider_invoice_id"),
                    provider_data.get("provider_invoice_url"),
                ),
            )
            invoice_id = cur.fetchone()["id"]

            cur.execute(
                """
                UPDATE estimates
                   SET status = %s
                 WHERE id = %s
                """,
                ("approved", estimate["id"]),
            )

        return EstimateApproveResponse(
            estimate_id=estimate["id"],
            invoice_id=invoice_id,
            provider_invoice_id=provider_data.get("provider_invoice_id"),
            provider_invoice_url=provider_data.get("provider_invoice_url"),
        )


@app.post("/admin/invoices/{id}/send", response_model=InvoiceSendResponse)
def send_invoice(id: UUID):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT i.id, i.provider_invoice_id, i.provider_invoice_url, i.sent_at,
                       i.estimate_id, i.project_id, r.slack_ts, r.id as request_id,
                       p.account_id
                  FROM invoices i
                  LEFT JOIN estimates e ON i.estimate_id = e.id
                  LEFT JOIN requests r ON e.request_id = r.id
                  LEFT JOIN projects p ON i.project_id = p.id
                 WHERE i.id = %s
                """,
                (id,),
            )
            invoice = cur.fetchone()
            if not invoice:
                raise HTTPException(status_code=404, detail="Invoice not found")

            if invoice.get("sent_at"):
                return InvoiceSendResponse(
                    invoice_id=invoice["id"],
                    provider_invoice_id=invoice.get("provider_invoice_id"),
                    provider_invoice_url=invoice.get("provider_invoice_url"),
                    status="already_sent",
                )

        stripe_client = get_stripe_client()
        if not invoice.get("provider_invoice_id"):
            raise HTTPException(status_code=400, detail="Invoice not linked to Stripe")
        stripe_client.Invoice.send_invoice(invoice["provider_invoice_id"])

        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE invoices
                   SET status = %s,
                       sent_at = %s
                 WHERE id = %s
                """,
                ("sent", now_utc(), invoice["id"]),
            )

        if invoice.get("slack_ts"):
            post_request_update(
                invoice.get("request_id"),
                invoice.get("slack_ts"),
                f"Invoice sent: {invoice.get('provider_invoice_url')}",
            )

        return InvoiceSendResponse(
            invoice_id=invoice["id"],
            provider_invoice_id=invoice.get("provider_invoice_id"),
            provider_invoice_url=invoice.get("provider_invoice_url"),
            status="sent",
        )


@app.post("/api/requests/{id}/updates")
def update_request(id: UUID, payload: RequestUpdate, request: Request):
    enforce_rate_limit("request", get_client_ip(request), 60)
    with get_conn() as conn:
        account_id = require_session(conn, request)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.id, r.slack_ts, r.project_id
                  FROM requests r
                  JOIN projects p ON r.project_id = p.id
                 WHERE r.id = %s AND p.account_id = %s
                """,
                (id, account_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Request not found")
            if not row["slack_ts"]:
                raise HTTPException(status_code=400, detail="Request not linked to Slack")

        post_request_update(id, row["slack_ts"], payload.message)
        log_audit(
            conn,
            None,
            "client_request_update",
            {"request_id": str(id)},
        )
    return {"status": "ok"}


@app.post("/api/handoff/slack", response_model=SlackHandoffResponse)
def handoff_slack(payload: SlackHandoffRequest):
    _ = payload
    return SlackHandoffResponse(status="ok")
