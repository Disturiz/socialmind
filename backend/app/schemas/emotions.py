from datetime import datetime
from pydantic import BaseModel


class EmotionOut(BaseModel):
    key: str
    label: str
    emoji: str


class EmotionLogRequest(BaseModel):
    emotion_key: str


class EmotionLogOut(BaseModel):
    id: int
    emotion_key: str
    logged_at: datetime

    model_config = {"from_attributes": True}
