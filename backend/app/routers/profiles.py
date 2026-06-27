from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_parent
from app.models.user import User
from app.models.child_profile import ChildProfile
from app.schemas.profiles import ChildProfileCreate, ChildProfileOut, ParentProfileOut

router = APIRouter()


@router.get("/me", response_model=ParentProfileOut)
def get_my_profile(
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    child = db.query(ChildProfile).filter(ChildProfile.parent_id == current_user.id).first()
    return ParentProfileOut(child=child)


@router.post("/children", response_model=ChildProfileOut, status_code=201)
def create_child(
    data: ChildProfileCreate,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    existing = db.query(ChildProfile).filter(ChildProfile.parent_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya tienes un niño registrado.")
    child = ChildProfile(
        parent_id=current_user.id,
        name=data.name,
        age=data.age,
        avatar_emoji=data.avatar_emoji,
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return child
