from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.calm_session import CalmSession
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.specialist_note import SpecialistNote
from app.models.scenario_completion import ScenarioCompletion
from app.services.scenario_service import _SCENARIO_MAP
from app.gamification.service import get_progress as get_gamification_progress


def list_children(db: Session, specialist_id: int) -> list[dict]:
    from app.models.specialist_assignment import SpecialistAssignment
    profiles = (
        db.query(ChildProfile)
        .join(SpecialistAssignment, SpecialistAssignment.child_profile_id == ChildProfile.id)
        .filter(SpecialistAssignment.specialist_id == specialist_id)
        .order_by(ChildProfile.name)
        .all()
    )
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
        total_scenarios = (
            db.query(ScenarioCompletion).filter(ScenarioCompletion.user_id == pid).count()
        )
        result.append({
            "child_profile_id": profile.id,
            "name": profile.name,
            "age": profile.age,
            "avatar_emoji": profile.avatar_emoji,
            "last_emotion_key": last_emotion.emotion_key if last_emotion else None,
            "total_calm_sessions": total_calm,
            "total_chats": total_chats,
            "total_scenarios_completed": total_scenarios,
        })
    return result


def get_child_detail(db: Session, child_id: int, specialist_id: int) -> dict:
    from app.models.specialist_assignment import SpecialistAssignment
    profile = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Niño no encontrado.")

    assignment = db.query(SpecialistAssignment).filter(
        SpecialistAssignment.specialist_id == specialist_id,
        SpecialistAssignment.child_profile_id == child_id,
    ).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este niño.",
        )

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
    completions = (
        db.query(ScenarioCompletion)
        .filter(ScenarioCompletion.user_id == pid)
        .order_by(ScenarioCompletion.completed_at.desc())
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

    scenarios_completed = [
        {
            "scenario_id": c.scenario_id,
            "emoji": _SCENARIO_MAP[c.scenario_id].emoji
                     if c.scenario_id in _SCENARIO_MAP else "🌟",
            "title": _SCENARIO_MAP[c.scenario_id].title
                     if c.scenario_id in _SCENARIO_MAP else f"Escenario {c.scenario_id}",
            "completed_at": c.completed_at,
        }
        for c in completions
    ]

    note = (
        db.query(SpecialistNote)
        .filter(
            SpecialistNote.specialist_id == specialist_id,
            SpecialistNote.child_profile_id == child_id,
        )
        .first()
    )

    gamification = get_gamification_progress(db, pid)

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
        "scenarios_completed": scenarios_completed,
        "specialist_note": note.content if note else None,
        "gamification_progress": {
            "total_stars": gamification["total_stars"],
            "current_streak": gamification["current_streak"],
            "level_key": gamification["level"]["key"],
            "level_name": gamification["level"]["name"],
            "progress_pct": gamification["progress_pct"],
            "badges_earned": sum(1 for b in gamification["badges"] if b["earned"]),
        },
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
