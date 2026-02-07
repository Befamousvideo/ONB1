from datetime import datetime, timezone
import json
import os
import time
import urllib.request
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from psycopg import connect
from psycopg.rows import dict_row

app = FastAPI(title="ONB1 API")


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
    "SCHEDULING": ["preferred_times"],
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


class UploadLink(BaseModel):
    upload_url: str
    file_url: str
    headers: Optional[Dict[str, str]] = None


class SlackHandoffRequest(BaseModel):
    conversation_id: UUID
    channel: str
    text: str


class SlackHandoffResponse(BaseModel):
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


def next_state(current_state: str, fields: Dict[str, Any]) -> str:
    if current_state == "WELCOME":
        return "MODE_SELECT"
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


def build_slack_payload(conversation_id: UUID, normalized: Dict[str, Any]) -> dict:
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
    summary = normalized.get("summary")

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
        fields_lines.append(f"*Preferred Times:* {preferred_times}")

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": "Prospect Intake"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": contact_line}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Company:* {business_name}"}},
    ]

    if bullets:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(bullets)}})

    if fields_lines:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(fields_lines)}})

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


def maybe_post_slack(conn, conversation_id: UUID, normalized: Dict[str, Any]) -> None:
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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/conversations", response_model=Conversation, status_code=201)
def create_conversation(payload: ConversationCreate):
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


@app.post("/api/conversations/{id}/message", response_model=Message, status_code=201)
def post_message(id: UUID, payload: MessageCreate):
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
            normalized.update(fields)

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
            maybe_post_slack(conn, id, normalized)

    return Message(**message_row)


@app.post("/api/conversations/{id}/end-and-send", response_model=Conversation)
def end_and_send(id: UUID, payload: Optional[EndAndSendRequest] = None):
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

        maybe_post_slack(conn, id, normalized)
        updated = fetch_conversation(conn, id)

    return to_conversation_model(updated)


@app.post("/api/uploads/presign", response_model=UploadLink)
def create_upload_presign(payload: UploadPresignRequest):
    _ = payload
    return UploadLink(
        upload_url="https://example.com/upload",
        file_url="https://example.com/file",
        headers={"x-mock": "true"},
    )


@app.post("/api/handoff/slack", response_model=SlackHandoffResponse)
def handoff_slack(payload: SlackHandoffRequest):
    _ = payload
    return SlackHandoffResponse(status="ok")
