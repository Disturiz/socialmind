from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.calm import CalmSessionRequest, CalmSessionOut, CalmPhraseRequest, CalmPhraseOut
from app.services import calm_service

router = APIRouter()


@router.post("/session", response_model=CalmSessionOut, status_code=status.HTTP_201_CREATED)
def save_calm_session(
    data: CalmSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return calm_service.save_session(
        db, current_user.id, data.activity_type, data.duration_seconds, data.emotion_key
    )


@router.post("/phrase", response_model=CalmPhraseOut)
def get_calm_phrase(
    data: CalmPhraseRequest,
    current_user: User = Depends(get_current_user),
):
    phrase = calm_service.generate_phrase(data.emotion_key)
    return {"phrase": phrase}
