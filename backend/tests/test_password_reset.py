from datetime import datetime, timezone, timedelta
import secrets
from unittest.mock import patch, MagicMock
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.services.email_service import send_password_reset_email


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


def test_send_password_reset_email_calls_resend():
    with patch("app.services.email_service.resend.Emails.send") as mock_send:
        mock_send.return_value = MagicMock()
        send_password_reset_email(
            to_email="user@example.com",
            full_name="Ana García",
            token="abc123token",
        )
        mock_send.assert_called_once()
        call_args = mock_send.call_args[0][0]
        assert call_args["to"] == "user@example.com"
        assert "abc123token" in call_args["html"]
        assert "Ana García" in call_args["html"]
        assert call_args["from"] == "noreply@socialmind.it.com"
