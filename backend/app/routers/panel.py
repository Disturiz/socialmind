from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_specialist
from app.models.user import User
from app.schemas.panel import ChildSummaryOut, ChildDetailOut, NoteRequest, NoteOut
from app.services import panel_service

router = APIRouter()


@router.get("/children", response_model=list[ChildSummaryOut])
def list_children(
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return panel_service.list_children(db, current_user.id)


@router.get("/children/{child_id}", response_model=ChildDetailOut)
def get_child_detail(
    child_id: int,
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return panel_service.get_child_detail(db, child_id, current_user.id)


@router.put("/children/{child_id}/note", response_model=NoteOut)
def save_note(
    child_id: int,
    data: NoteRequest,
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return panel_service.save_note(db, current_user.id, child_id, data.content)
