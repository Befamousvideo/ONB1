from datetime import datetime
from typing import Optional, Dict
from uuid import UUID, uuid4

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ONB1 API")


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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/conversations", response_model=Conversation, status_code=201)
def create_conversation(payload: ConversationCreate):
    return Conversation(
        id=uuid4(),
        account_id=payload.account_id,
        contact_id=payload.contact_id,
        channel=payload.channel,
        subject=payload.subject,
        intake_brief=payload.intake_brief,
        created_at=datetime.utcnow(),
    )


@app.post("/api/conversations/{id}/message", response_model=Message, status_code=201)
def post_message(id: UUID, payload: MessageCreate):
    return Message(
        id=uuid4(),
        conversation_id=id,
        sender_type=payload.sender_type,
        sender_contact_id=payload.sender_contact_id,
        body=payload.body,
        created_at=datetime.utcnow(),
    )


@app.post("/api/conversations/{id}/end-and-send", response_model=Conversation)
def end_and_send(id: UUID, payload: Optional[EndAndSendRequest] = None):
    _ = payload
    return Conversation(
        id=id,
        account_id=uuid4(),
        contact_id=None,
        channel="email",
        subject="Ended",
        intake_brief=None,
        created_at=datetime.utcnow(),
    )


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
