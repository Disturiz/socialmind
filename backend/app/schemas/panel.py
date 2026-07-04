from datetime import datetime
from pydantic import BaseModel, field_validator


class ChildSummaryOut(BaseModel):
    child_profile_id: int
    name: str
    age: int
    avatar_emoji: str
    last_emotion_key: str | None
    total_calm_sessions: int
    total_chats: int
    total_scenarios_completed: int


class EmotionEntryOut(BaseModel):
    emotion_key: str
    logged_at: datetime


class CalmEntryOut(BaseModel):
    activity_type: str
    duration_seconds: int
    emotion_key: str
    created_at: datetime


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: datetime


class ConversationOut(BaseModel):
    conversation_id: int
    emotion_key: str
    started_at: datetime
    ended_at: datetime | None
    message_count: int
    messages: list[MessageOut]


class GamificationProgressOut(BaseModel):
    total_stars: int
    current_streak: int
    level_key: str
    level_name: str
    progress_pct: int
    badges_earned: int


class ScenarioCompletedOut(BaseModel):
    scenario_id: int
    emoji: str
    title: str
    completed_at: datetime


class ChildDetailOut(BaseModel):
    child_profile_id: int
    name: str
    age: int
    avatar_emoji: str
    emotions: list[EmotionEntryOut]
    calm_sessions: list[CalmEntryOut]
    conversations: list[ConversationOut]
    scenarios_completed: list[ScenarioCompletedOut]
    specialist_note: str | None
    gamification_progress: GamificationProgressOut | None = None


class NoteRequest(BaseModel):
    content: str

    @field_validator('content')
    @classmethod
    def content_valid(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('content cannot be empty')
        if len(v) > 2000:
            raise ValueError('content must be at most 2000 characters')
        return v


class NoteOut(BaseModel):
    content: str
    updated_at: datetime
