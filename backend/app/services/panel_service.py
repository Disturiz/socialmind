from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.calm_session import CalmSession
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.specialist_note import SpecialistNote


def list_children(db: Session) -> list[dict]:
    profiles = db.query(ChildProfile).order_by(ChildProfile.name).all()
    result = []
    for profile in profiles:
        pid = profile.parent_id
        last_emotion = (
            db.query(EmotionLog)
            .filter(EmotionLog.user_id == pid)
            .order_by(EmotionLog.logged_at.desc())
            .first()
        )
        total_calm = db.query(CalmSession).filter(CalmSession.user_id == pid).count()
        total_chats = db.query(ChatConversation).filter(ChatConversation.user_id == pid).count()
        result.append({
            "child_profile_id": profile.id,
            "name": profile.name,
            "age": profile.age,
            "avatar_emoji": profile.avatar_emoji,
            "last_emotion_key": last_emotion.emotion_key if last_emotion else None,
            "total_calm_sessions": total_calm,
            "total_chats": total_chats,
        })
    return result


def get_child_detail(db: Session, child_id: int, specialist_id: int) -> dict:
    profile = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Niño no encontrado.")

    pid = profile.parent_id

    emotions = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == pid)
        .order_by(EmotionLog.logged_at.desc())
        .limit(30)
        .all()
    )
    calm_sessions = (
        db.query(CalmSession)
        .filter(CalmSession.user_id == pid)
        .order_by(CalmSession.created_at.desc())
        .limit(30)
        .all()
    )
    conversations = (
        db.query(ChatConversation)
        .filter(ChatConversation.user_id == pid)
        .order_by(ChatConversation.started_at.desc())
        .limit(10)
        .all()
    )

    conv_details = []
    for conv in conversations:
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conv.id)
            .order_by(ChatMessage.created_at)
            .all()
        )
        conv_details.append({
            "conversation_id": conv.id,
            "emotion_key": conv.emotion_key,
            "started_at": conv.started_at,
            "ended_at": conv.ended_at,
            "message_count": len(messages),
            "messages": [
                {"role": m.role, "content": m.content, "created_at": m.created_at}
                for m in messages
            ],
        })

    note = (
        db.query(SpecialistNote)
        .filter(
            SpecialistNote.specialist_id == specialist_id,
            SpecialistNote.child_profile_id == child_id,
        )
        .first()
    )

    return {
        "child_profile_id": profile.id,
        "name": profile.name,
        "age": profile.age,
        "avatar_emoji": profile.avatar_emoji,
        "emotions": [
            {"emotion_key": e.emotion_key, "logged_at": e.logged_at}
            for e in emotions
        ],
        "calm_sessions": [
            {
                "activity_type": s.activity_type,
                "duration_seconds": s.duration_seconds,
                "emotion_key": s.emotion_key,
                "created_at": s.created_at,
            }
            for s in calm_sessions
        ],
        "conversations": conv_details,
        "specialist_note": note.content if note else None,
    }


def save_note(db: Session, specialist_id: int, child_id: int, content: str) -> dict:
    profile = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Niño no encontrado.")

    note = (
        db.query(SpecialistNote)
        .filter(
            SpecialistNote.specialist_id == specialist_id,
            SpecialistNote.child_profile_id == child_id,
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if note:
        note.content = content
        note.updated_at = now
    else:
        note = SpecialistNote(
            specialist_id=specialist_id,
            child_profile_id=child_id,
            content=content,
            updated_at=now,
        )
        db.add(note)

    db.commit()
    db.refresh(note)
    return {"content": note.content, "updated_at": note.updated_at}
