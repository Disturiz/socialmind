import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest, LoginRequest
from app.core.security import hash_password, verify_password, create_access_token
from app.models.password_reset_token import PasswordResetToken
from app.services.email_service import send_password_reset_email


def register_user(db: Session, data: RegisterRequest) -> User:
    if data.role not in (UserRole.parent, UserRole.specialist):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol seleccionado no está permitido en el registro público.",
        )
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cuenta con este correo electrónico.",
        )
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, data: LoginRequest) -> tuple[str, User]:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta no está activa.",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return token, user


def request_password_reset(db: Session, email: str) -> None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()
    send_password_reset_email(to_email=user.email, full_name=user.full_name, token=token)


def reset_password(db: Session, token: str, new_password: str) -> None:
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token == token).first()
    if not reset or reset.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token inválido o expirado.")
    user = db.query(User).filter(User.id == reset.user_id).first()
    user.hashed_password = hash_password(new_password)
    db.delete(reset)
    db.commit()
