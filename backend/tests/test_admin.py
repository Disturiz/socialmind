import pytest
from fastapi import HTTPException
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.schemas.admin import AdminUserOut, AdminUserUpdate
from app.services.admin_service import list_users, update_user


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


# --- list_users ---

def test_list_users_returns_all(db):
    _make_user(db, email="p@example.com", role=UserRole.parent)
    _make_user(db, email="s@example.com", role=UserRole.specialist)
    result = list_users(db, search=None, role=None, is_active=None)
    assert len(result) == 2


def test_list_users_filter_by_role(db):
    _make_user(db, email="p@example.com", role=UserRole.parent)
    _make_user(db, email="s@example.com", role=UserRole.specialist)
    result = list_users(db, search=None, role="parent", is_active=None)
    assert len(result) == 1
    assert result[0].role == UserRole.parent


def test_list_users_filter_by_search(db):
    u1 = User(email="ana@example.com", hashed_password=hash_password("P123!"), full_name="Ana García", role=UserRole.parent)
    u2 = User(email="bob@example.com", hashed_password=hash_password("P123!"), full_name="Bob Smith", role=UserRole.parent)
    db.add_all([u1, u2])
    db.commit()
    result = list_users(db, search="ana", role=None, is_active=None)
    assert len(result) == 1
    assert result[0].full_name == "Ana García"


def test_list_users_filter_by_active(db):
    u = _make_user(db)
    u.is_active = False
    db.commit()
    result = list_users(db, search=None, role=None, is_active=False)
    assert len(result) == 1
    result_active = list_users(db, search=None, role=None, is_active=True)
    assert len(result_active) == 0


# --- update_user ---

def test_update_user_changes_role(db):
    admin = _make_admin(db)
    user = _make_user(db)
    updated = update_user(db, user.id, AdminUserUpdate(role=UserRole.specialist), admin.id)
    assert updated.role == UserRole.specialist


def test_update_user_changes_is_active(db):
    admin = _make_admin(db)
    user = _make_user(db)
    updated = update_user(db, user.id, AdminUserUpdate(is_active=False), admin.id)
    assert updated.is_active is False


def test_update_user_self_raises_400(db):
    admin = _make_admin(db)
    with pytest.raises(HTTPException) as exc:
        update_user(db, admin.id, AdminUserUpdate(is_active=False), admin.id)
    assert exc.value.status_code == 400


def test_update_user_not_found_raises_404(db):
    admin = _make_admin(db)
    with pytest.raises(HTTPException) as exc:
        update_user(db, 99999, AdminUserUpdate(is_active=False), admin.id)
    assert exc.value.status_code == 404
