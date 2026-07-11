from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_parent, require_specialist
from app.models.user import User
from app.schemas.assignments import AssignmentOut, ParentOut, SpecialistOut
from app.services import assignments_service

router = APIRouter()


@router.get("/specialists", response_model=list[SpecialistOut])
def list_all_specialists(
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    return assignments_service.list_specialists(db)


@router.get("/children/{child_id}/specialists", response_model=list[SpecialistOut])
def get_assigned_specialists(
    child_id: int,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    return assignments_service.get_assigned_specialists(db, child_id, current_user.id)


@router.post(
    "/children/{child_id}/specialists/{specialist_id}",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_specialist(
    child_id: int,
    specialist_id: int,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    return assignments_service.assign_specialist(db, child_id, specialist_id, current_user.id)


@router.delete(
    "/children/{child_id}/specialists/{specialist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unassign_specialist(
    child_id: int,
    specialist_id: int,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    assignments_service.unassign_specialist(db, child_id, specialist_id, current_user.id)


@router.get("/my-parents", response_model=list[ParentOut])
def get_my_parents(
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return assignments_service.get_my_parents(db, current_user.id)
