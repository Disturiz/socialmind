from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.admin import AdminUserUpdate
from app.models.password_reset_token import PasswordResetToken
from app.models.reward_event import RewardEvent
from app.models.user_rewards import UserRewards
from app.models.child_profile import ChildProfile
from app.models.specialist_note import SpecialistNote
from app.models.specialist_assignment import SpecialistAssignment
from app.models.document import Document
from app.models.adult_conversation import AdultConversation
from app.models.adult_message import AdultMessage
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.calm_session import CalmSession
from app.models.scenario_completion import ScenarioCompletion
from app.models.emotion_log import EmotionLog


def list_users(
    db: Session,
    search: str | None,
    role: str | None,
    is_active: bool | None,
) -> list[User]:
    q = db.query(User)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(User.full_name.ilike(pattern), User.email.ilike(pattern))
        )
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    return q.order_by(User.created_at.desc()).all()


def update_user(
    db: Session,
    user_id: int,
    data: AdminUserUpdate,
    current_user_id: int,
) -> User:
    if user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes modificar ni eliminar tu propia cuenta.",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int, current_user_id: int) -> None:
    if user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes modificar ni eliminar tu propia cuenta.",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    # a. password_reset_tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id
    ).delete(synchronize_session=False)

    # b. reward_events
    db.query(RewardEvent).filter(
        RewardEvent.user_id == user_id
    ).delete(synchronize_session=False)

    # c. user_rewards
    db.query(UserRewards).filter(
        UserRewards.user_id == user_id
    ).delete(synchronize_session=False)

    # d. child_profile IDs de este usuario (para cascadar notes/assignments)
    child_ids = [
        c[0] for c in db.query(ChildProfile.id).filter(ChildProfile.parent_id == user_id).all()
    ]

    # e. specialist_notes: las propias (specialist_id) + las de hijos de este padre
    note_filter = SpecialistNote.specialist_id == user_id
    if child_ids:
        note_filter = or_(note_filter, SpecialistNote.child_profile_id.in_(child_ids))
    db.query(SpecialistNote).filter(note_filter).delete(synchronize_session=False)

    # f. specialist_assignments: las propias + las de hijos de este padre
    assign_filter = SpecialistAssignment.specialist_id == user_id
    if child_ids:
        assign_filter = or_(assign_filter, SpecialistAssignment.child_profile_id.in_(child_ids))
    db.query(SpecialistAssignment).filter(assign_filter).delete(synchronize_session=False)

    # g. documents (document_chunks se eliminan por ON DELETE CASCADE en la BD)
    db.query(Document).filter(
        Document.specialist_id == user_id
    ).delete(synchronize_session=False)

    # h. adult_messages → adult_conversations
    adult_conv_ids = [
        c[0] for c in db.query(AdultConversation.id).filter(AdultConversation.user_id == user_id).all()
    ]
    if adult_conv_ids:
        db.query(AdultMessage).filter(
            AdultMessage.conversation_id.in_(adult_conv_ids)
        ).delete(synchronize_session=False)
    db.query(AdultConversation).filter(
        AdultConversation.user_id == user_id
    ).delete(synchronize_session=False)

    # i. chat_messages → chat_conversations
    chat_conv_ids = [
        c[0] for c in db.query(ChatConversation.id).filter(ChatConversation.user_id == user_id).all()
    ]
    if chat_conv_ids:
        db.query(ChatMessage).filter(
            ChatMessage.conversation_id.in_(chat_conv_ids)
        ).delete(synchronize_session=False)
    db.query(ChatConversation).filter(
        ChatConversation.user_id == user_id
    ).delete(synchronize_session=False)

    # j. calm_sessions
    db.query(CalmSession).filter(CalmSession.user_id == user_id).delete(synchronize_session=False)

    # k. scenario_completions
    db.query(ScenarioCompletion).filter(
        ScenarioCompletion.user_id == user_id
    ).delete(synchronize_session=False)

    # l. emotion_logs
    db.query(EmotionLog).filter(EmotionLog.user_id == user_id).delete(synchronize_session=False)

    # m. child_profiles
    db.query(ChildProfile).filter(ChildProfile.parent_id == user_id).delete(synchronize_session=False)

    # n. usuario
    db.delete(user)
    db.commit()
