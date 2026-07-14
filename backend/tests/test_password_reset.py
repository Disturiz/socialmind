from datetime import datetime, timezone, timedelta
import secrets
from unittest.mock import patch, MagicMock
import pytest
from fastapi import HTTPException
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.services.email_service import send_password_reset_email
from app.services.auth_service import request_password_reset, reset_password


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


def test_request_password_reset_creates_token(db):
    user = _make_user(db)
    with patch("app.services.auth_service.send_password_reset_email") as mock_email:
        request_password_reset(db, user.email)
        mock_email.assert_called_once()
        assert mock_email.call_args[1]["to_email"] == user.email

    token_row = db.query(PasswordResetToken).filter_by(user_id=user.id).first()
    assert token_row is not None
    assert len(token_row.token) > 10


def test_request_password_reset_unknown_email_is_silent(db):
    with patch("app.services.auth_service.send_password_reset_email") as mock_email:
        request_password_reset(db, "noexiste@example.com")
        mock_email.assert_not_called()


def test_request_password_reset_deletes_previous_tokens(db):
    user = _make_user(db)
    old_token = PasswordResetToken(
        user_id=user.id,
        token="old_token_value",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(old_token)
    db.commit()

    with patch("app.services.auth_service.send_password_reset_email"):
        request_password_reset(db, user.email)

    count = db.query(PasswordResetToken).filter_by(user_id=user.id).count()
    assert count == 1
    remaining = db.query(PasswordResetToken).filter_by(user_id=user.id).first()
    assert remaining.token != "old_token_value"


def test_reset_password_valid_token(db):
    user = _make_user(db)
    token_value = secrets.token_urlsafe(32)
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_value,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset_token)
    db.commit()

    reset_password(db, token_value, "NuevaPassword123!")

    db.refresh(user)
    from app.core.security import verify_password
    assert verify_password("NuevaPassword123!", user.hashed_password)
    assert db.query(PasswordResetToken).filter_by(token=token_value).first() is None


def test_reset_password_invalid_token(db):
    with pytest.raises(HTTPException) as exc_info:
        reset_password(db, "token_inventado", "NuevaPassword123!")
    assert exc_info.value.status_code == 400
    assert "inválido" in exc_info.value.detail


def test_reset_password_expired_token(db):
    user = _make_user(db)
    token_value = secrets.token_urlsafe(32)
    expired_token = PasswordResetToken(
        user_id=user.id,
        token=token_value,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    db.add(expired_token)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        reset_password(db, token_value, "NuevaPassword123!")
    assert exc_info.value.status_code == 400
