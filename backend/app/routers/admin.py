from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_admin
from app.models.user import User
from app.schemas.admin import AdminUserOut, AdminUserUpdate
from app.services.admin_service import list_users, update_user, delete_user

router = APIRouter()


@router.get("/users", response_model=list[AdminUserOut])
def get_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_users(db, search=search, role=role, is_active=is_active)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def patch_user(
    user_id: int,
    data: AdminUserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return update_user(db, user_id, data, current_user.id)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    delete_user(db, user_id, current_user.id)
