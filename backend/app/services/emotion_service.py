from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.emotion_log import EmotionLog
from app.schemas.emotions import EmotionOut, EmotionLogRequest

VALID_EMOTION_KEYS = {"feliz", "nervioso", "confundido", "frustrado", "cansado"}

EMOTIONS: list[EmotionOut] = [
    EmotionOut(key="feliz",      label="Feliz",      emoji="😊"),
    EmotionOut(key="nervioso",   label="Nervioso",   emoji="😰"),
    EmotionOut(key="confundido", label="Confundido", emoji="🤔"),
    EmotionOut(key="frustrado",  label="Frustrado",  emoji="😤"),
    EmotionOut(key="cansado",    label="Cansado",    emoji="😴"),
]


def list_emotions() -> list[EmotionOut]:
    return EMOTIONS


def log_emotion(db: Session, user_id: int, data: EmotionLogRequest) -> EmotionLog:
    if data.emotion_key not in VALID_EMOTION_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Emoción no reconocida: {data.emotion_key}",
        )
    entry = EmotionLog(user_id=user_id, emotion_key=data.emotion_key)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_today_emotion(db: Session, user_id: int) -> str | None:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    log = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user_id, EmotionLog.logged_at >= since)
        .order_by(EmotionLog.logged_at.desc())
        .first()
    )
    return log.emotion_key if log else None
