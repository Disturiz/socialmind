from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError
from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
        )
    return user


def require_specialist(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.specialist:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para especialistas.",
        )
    return current_user


def require_parent(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.parent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para padres.",
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para administradores.",
        )
    return current_user
