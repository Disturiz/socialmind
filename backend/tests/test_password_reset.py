from datetime import datetime, timezone, timedelta
import secrets
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole
from app.core.security import hash_password


def _make_user(db):
    user = User(
        email="test@example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Test User",
        role=UserRole.parent,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_password_reset_token_model(db):
    user = _make_user(db)
    token = PasswordResetToken(
        user_id=user.id,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(token)
    db.commit()
    db.refresh(token)

    assert token.id is not None
    assert token.user_id == user.id
    assert token.created_at is not None
