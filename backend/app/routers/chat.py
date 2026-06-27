import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.chat import (
    ChatStartRequest, ChatStartOut,
    ChatMessageRequest, ChatMessageOut,
    ChatHistoryItem, ChatConversationOut,
)
from app.services import chat_service
from app.gamification.service import register_event

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start", response_model=ChatStartOut, status_code=status.HTTP_201_CREATED)
def start_chat(
    data: ChatStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = chat_service.start_conversation(db, current_user.id, data.emotion_key)
    try:
        register_event(db, current_user.id, "lumi_chat")
    except Exception:
        logger.exception("gamification register_event failed")
    return result


@router.post("/{conversation_id}/message", response_model=ChatMessageOut)
def send_chat_message(
    conversation_id: int,
    data: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chat_service.send_message(db, current_user.id, conversation_id, data.content)


@router.get("/history", response_model=list[ChatHistoryItem])
def get_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chat_service.get_history(db, current_user.id)


@router.get("/{conversation_id}", response_model=ChatConversationOut)
def get_chat_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chat_service.get_conversation(db, current_user.id, conversation_id)
