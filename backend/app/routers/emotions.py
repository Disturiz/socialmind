from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.emotions import EmotionOut, EmotionLogRequest, EmotionLogOut
from app.services.emotion_service import list_emotions, log_emotion

router = APIRouter()


@router.get("", response_model=list[EmotionOut])
def get_emotions():
    return list_emotions()


@router.post("/log", response_model=EmotionLogOut, status_code=201)
def log_emotion_endpoint(
    data: EmotionLogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return log_emotion(db, current_user.id, data)
