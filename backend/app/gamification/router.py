from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.gamification.schemas import ProgressOut
from app.gamification import service as gamification_service

router = APIRouter()


@router.get("/progreso", response_model=ProgressOut)
def get_my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return gamification_service.get_progress(db, current_user.id)
