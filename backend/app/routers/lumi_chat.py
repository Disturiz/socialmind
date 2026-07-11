from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.lumi_chat import (
    ConversationOut,
    MessageIn,
    MessageOut,
    ConversationDetailOut,
)
from app.services import lumi_chat_service

router = APIRouter()


@router.post(
    "/conversations",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lumi_chat_service.create_conversation(db, current_user.id)


@router.post(
    "/conversations/{conv_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conv_id: int,
    body: MessageIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lumi_chat_service.send_message(
        db, conv_id, current_user.id, body.content, current_user.role.value
    )


@router.get(
    "/conversations/{conv_id}",
    response_model=ConversationDetailOut,
)
def get_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lumi_chat_service.get_conversation(db, conv_id, current_user.id)
