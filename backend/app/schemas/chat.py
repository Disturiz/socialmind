from datetime import datetime
from pydantic import BaseModel


class ChatStartRequest(BaseModel):
    emotion_key: str


class ChatStartOut(BaseModel):
    conversation_id: int
    message: str
    options: list[str]
    lumi_state: str


class ChatMessageRequest(BaseModel):
    content: str


class ChatMessageOut(BaseModel):
    message: str
    options: list[str]
    lumi_state: str
    ended: bool


class ChatHistoryItem(BaseModel):
    conversation_id: int
    emotion_key: str
    started_at: datetime
    ended_at: datetime | None
    message_count: int

    model_config = {"from_attributes": True}


class ChatMessageItem(BaseModel):
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatConversationOut(BaseModel):
    conversation_id: int
    emotion_key: str
    messages: list[ChatMessageItem]
