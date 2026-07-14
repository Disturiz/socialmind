from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from app.models.user import User, UserRole
from app.schemas.admin import AdminUserUpdate


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
