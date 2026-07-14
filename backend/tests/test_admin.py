import pytest
from fastapi import HTTPException
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.schemas.admin import AdminUserOut, AdminUserUpdate


def _make_user(db, email="u@example.com", role=UserRole.parent):
    user = User(
        email=email,
        hashed_password=hash_password("Password123!"),
        full_name="Test User",
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_admin(db, email="admin@example.com"):
    return _make_user(db, email=email, role=UserRole.admin)


def _admin_token(client, db):
    admin = _make_admin(db)
    res = client.post("/api/v1/auth/login", json={
        "email": admin.email, "password": "Password123!"
    })
    return res.json()["access_token"], admin


# --- Schemas ---

def test_admin_user_out_serializes_user(db):
    user = _make_user(db)
    out = AdminUserOut.model_validate(user)
    assert out.id == user.id
    assert out.email == user.email
    assert out.role == user.role.value
    assert out.is_active is True


def test_admin_user_update_requires_at_least_one_field():
    with pytest.raises(Exception):
        AdminUserUpdate()  # ambos None → ValidationError


def test_admin_user_update_accepts_role_only():
    data = AdminUserUpdate(role=UserRole.specialist)
    assert data.role == UserRole.specialist
    assert data.is_active is None
