from datetime import datetime
from pydantic import BaseModel, Field


class ConversationOut(BaseModel):
    id: int
    started_at: datetime
    model_config = {"from_attributes": True}


class MessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: int
    started_at: datetime
    messages: list[MessageOut]
    model_config = {"from_attributes": True}
