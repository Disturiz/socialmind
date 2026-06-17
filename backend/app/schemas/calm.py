from datetime import datetime
from typing import Literal
from pydantic import BaseModel, field_validator


class CalmSessionRequest(BaseModel):
    activity_type: Literal['respirar', 'pausa', 'frase']
    duration_seconds: int
    emotion_key: str

    @field_validator('duration_seconds')
    @classmethod
    def duration_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError('duration_seconds must be >= 0')
        return v

    @field_validator('emotion_key')
    @classmethod
    def emotion_key_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('emotion_key cannot be empty')
        return v


class CalmSessionOut(BaseModel):
    id: int
    activity_type: str
    duration_seconds: int
    emotion_key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CalmPhraseRequest(BaseModel):
    emotion_key: str


class CalmPhraseOut(BaseModel):
    phrase: str
