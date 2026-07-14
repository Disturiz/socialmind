# Módulo de Administración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un panel de administración en `/admin` que permita al rol `admin` listar, buscar, activar/desactivar, cambiar de rol y eliminar usuarios con borrado en cascada.

**Architecture:** Router FastAPI `/api/v1/admin/users` protegido con `require_admin`, servicio con las tres operaciones CRUD, y una página React `/admin` con tabla de usuarios y acciones inline. No se necesita migración de Alembic — el rol `admin` ya existe en el enum `UserRole` y el campo `is_active` ya está en `users`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Pydantic v2 + pytest / React 18 + Vite + Tailwind CSS + Framer Motion + React Router v6

## Global Constraints

- Rol `admin` ya está en `UserRole` enum — no crear un nuevo enum ni valor
- No añadir paginación — la plataforma es pequeña (YAGNI)
- No añadir página de detalle de usuario — acciones inline en la tabla (YAGNI)
- El admin nunca puede actuar sobre su propia cuenta (backend HTTP 400 + frontend deshabilitado)
- Borrado es hard-delete en cascada — no hay papelera ni soft-delete adicional
- No introducir nuevas dependencias de Python ni de npm
- Seguir el patrón de tests existente en `backend/tests/test_password_reset.py` (pytest + SQLite en memoria, fixtures `db` y `client` de `conftest.py`)
- Archivos de backend en `backend/`, frontend en `frontend/`
- WORKDIR del contenedor backend es `/app`; el código fuente de `backend/` se copia en `/app/`

---

### Task 1: Backend — Schemas + require_admin

**Files:**
- Create: `backend/app/schemas/admin.py`
- Modify: `backend/app/core/dependencies.py` (añadir `require_admin`)
- Test: `backend/tests/test_admin.py` (primeras 3 pruebas)

**Interfaces:**
- Consumes: `UserRole` de `app.models.user`, `User` de `app.models.user`, `get_current_user` de `app.core.dependencies`
- Produces:
  - `AdminUserOut(id, email, full_name, role, is_active, created_at)` — schema Pydantic con `from_attributes=True`
  - `AdminUserUpdate(role: Optional[UserRole], is_active: Optional[bool])` — con model_validator que rechaza si ambos son None
  - `require_admin(current_user: User = Depends(get_current_user)) -> User` — lanza HTTP 403 si el rol no es `admin`

- [ ] **Step 1: Escribir los tests que van a fallar**

Crear `backend/tests/test_admin.py`:

```python
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
```

- [ ] **Step 2: Ejecutar los tests — deben fallar**

```bash
cd backend
pytest tests/test_admin.py -v
```

Expected: `ImportError` o `ModuleNotFoundError` — `app.schemas.admin` no existe todavía.

- [ ] **Step 3: Crear `backend/app/schemas/admin.py`**

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator
from app.models.user import UserRole


class AdminUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserUpdate(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

    @model_validator(mode='after')
    def at_least_one_field(self) -> 'AdminUserUpdate':
        if self.role is None and self.is_active is None:
            raise ValueError('Debe proporcionar al menos un campo para actualizar.')
        return self
```

- [ ] **Step 4: Añadir `require_admin` en `backend/app/core/dependencies.py`**

Al final del archivo, después de `require_parent`:

```python
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para administradores.",
        )
    return current_user
```

- [ ] **Step 5: Ejecutar los tests — deben pasar**

```bash
cd backend
pytest tests/test_admin.py -v
```

Expected: 3 PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/admin.py backend/app/core/dependencies.py backend/tests/test_admin.py
git commit -m "feat: add AdminUserOut/AdminUserUpdate schemas and require_admin dependency"
```

---

### Task 2: Admin service — list_users y update_user

**Files:**
- Create: `backend/app/services/admin_service.py`
- Modify: `backend/tests/test_admin.py` (añadir pruebas de servicio)

**Interfaces:**
- Consumes: `AdminUserOut`, `AdminUserUpdate`, `User`, `UserRole`, `Session`
- Produces:
  - `list_users(db: Session, search: str | None, role: str | None, is_active: bool | None) -> list[User]`
  - `update_user(db: Session, user_id: int, data: AdminUserUpdate, current_user_id: int) -> User`

- [ ] **Step 1: Añadir tests de servicio a `backend/tests/test_admin.py`**

Añadir después de los tests existentes:

```python
from app.services.admin_service import list_users, update_user


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
```

- [ ] **Step 2: Ejecutar — deben fallar**

```bash
cd backend
pytest tests/test_admin.py -v
```

Expected: FAIL por `ImportError` — `admin_service` no existe.

- [ ] **Step 3: Crear `backend/app/services/admin_service.py`**

```python
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.specialist_note import SpecialistNote
from app.models.specialist_assignment import SpecialistAssignment
from app.models.document import Document
from app.models.adult_conversation import AdultConversation
from app.models.adult_message import AdultMessage
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.calm_session import CalmSession
from app.models.scenario_completion import ScenarioCompletion
from app.models.emotion_log import EmotionLog
from app.models.reward_event import RewardEvent
from app.models.user_rewards import UserRewards
from app.models.password_reset_token import PasswordResetToken
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
```

- [ ] **Step 4: Ejecutar — deben pasar**

```bash
cd backend
pytest tests/test_admin.py -v
```

Expected: los 8 nuevos tests PASSED (los 3 anteriores también siguen pasando).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/admin_service.py backend/tests/test_admin.py
git commit -m "feat: add admin service list_users and update_user"
```

---

### Task 3: Admin service — delete_user con cascada

**Files:**
- Modify: `backend/app/services/admin_service.py` (añadir `delete_user`)
- Modify: `backend/tests/test_admin.py` (añadir pruebas de delete)

**Interfaces:**
- Consumes: todos los modelos ya importados en `admin_service.py` desde Task 2
- Produces: `delete_user(db: Session, user_id: int, current_user_id: int) -> None`

- [ ] **Step 1: Añadir tests de delete a `backend/tests/test_admin.py`**

Añadir al final del archivo:

```python
from app.services.admin_service import delete_user
from app.models.child_profile import ChildProfile
from app.models.specialist_assignment import SpecialistAssignment


def test_delete_user_removes_from_db(db):
    admin = _make_admin(db)
    user = _make_user(db)
    delete_user(db, user.id, admin.id)
    assert db.get(User, user.id) is None


def test_delete_user_cascades_child_profiles(db):
    admin = _make_admin(db)
    parent = _make_user(db, email="parent@example.com", role=UserRole.parent)
    child = ChildProfile(parent_id=parent.id, name="Niño", age=8)
    db.add(child)
    db.commit()
    child_id = child.id
    delete_user(db, parent.id, admin.id)
    assert db.get(ChildProfile, child_id) is None


def test_delete_user_cascades_specialist_assignments(db):
    admin = _make_admin(db)
    parent = _make_user(db, email="parent@example.com", role=UserRole.parent)
    specialist = _make_user(db, email="spec@example.com", role=UserRole.specialist)
    child = ChildProfile(parent_id=parent.id, name="Niño", age=8)
    db.add(child)
    db.commit()
    assignment = SpecialistAssignment(specialist_id=specialist.id, child_profile_id=child.id)
    db.add(assignment)
    db.commit()
    assignment_id = assignment.id
    delete_user(db, specialist.id, admin.id)
    assert db.get(SpecialistAssignment, assignment_id) is None


def test_delete_self_raises_400(db):
    admin = _make_admin(db)
    with pytest.raises(HTTPException) as exc:
        delete_user(db, admin.id, admin.id)
    assert exc.value.status_code == 400


def test_delete_user_not_found_raises_404(db):
    admin = _make_admin(db)
    with pytest.raises(HTTPException) as exc:
        delete_user(db, 99999, admin.id)
    assert exc.value.status_code == 404
```

- [ ] **Step 2: Ejecutar — deben fallar**

```bash
cd backend
pytest tests/test_admin.py::test_delete_user_removes_from_db -v
```

Expected: FAIL — `delete_user` no está definida en `admin_service`.

- [ ] **Step 3: Añadir `delete_user` al final de `backend/app/services/admin_service.py`**

```python
def delete_user(db: Session, user_id: int, current_user_id: int) -> None:
    if user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes modificar ni eliminar tu propia cuenta.",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    # a. password_reset_tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id
    ).delete(synchronize_session=False)

    # b. reward_events
    db.query(RewardEvent).filter(
        RewardEvent.user_id == user_id
    ).delete(synchronize_session=False)

    # c. user_rewards
    db.query(UserRewards).filter(
        UserRewards.user_id == user_id
    ).delete(synchronize_session=False)

    # d. child_profile IDs de este usuario (para cascadar notes/assignments)
    child_ids = [
        c[0] for c in db.query(ChildProfile.id).filter(ChildProfile.parent_id == user_id).all()
    ]

    # e. specialist_notes: las propias (specialist_id) + las de hijos de este padre
    note_filter = SpecialistNote.specialist_id == user_id
    if child_ids:
        note_filter = or_(note_filter, SpecialistNote.child_profile_id.in_(child_ids))
    db.query(SpecialistNote).filter(note_filter).delete(synchronize_session=False)

    # f. specialist_assignments: las propias + las de hijos de este padre
    assign_filter = SpecialistAssignment.specialist_id == user_id
    if child_ids:
        assign_filter = or_(assign_filter, SpecialistAssignment.child_profile_id.in_(child_ids))
    db.query(SpecialistAssignment).filter(assign_filter).delete(synchronize_session=False)

    # g. documents (document_chunks se eliminan por ON DELETE CASCADE en la BD)
    db.query(Document).filter(
        Document.specialist_id == user_id
    ).delete(synchronize_session=False)

    # h. adult_messages → adult_conversations
    adult_conv_ids = [
        c[0] for c in db.query(AdultConversation.id).filter(AdultConversation.user_id == user_id).all()
    ]
    if adult_conv_ids:
        db.query(AdultMessage).filter(
            AdultMessage.conversation_id.in_(adult_conv_ids)
        ).delete(synchronize_session=False)
    db.query(AdultConversation).filter(
        AdultConversation.user_id == user_id
    ).delete(synchronize_session=False)

    # i. chat_messages → chat_conversations
    chat_conv_ids = [
        c[0] for c in db.query(ChatConversation.id).filter(ChatConversation.user_id == user_id).all()
    ]
    if chat_conv_ids:
        db.query(ChatMessage).filter(
            ChatMessage.conversation_id.in_(chat_conv_ids)
        ).delete(synchronize_session=False)
    db.query(ChatConversation).filter(
        ChatConversation.user_id == user_id
    ).delete(synchronize_session=False)

    # j. calm_sessions
    db.query(CalmSession).filter(CalmSession.user_id == user_id).delete(synchronize_session=False)

    # k. scenario_completions
    db.query(ScenarioCompletion).filter(
        ScenarioCompletion.user_id == user_id
    ).delete(synchronize_session=False)

    # l. emotion_logs
    db.query(EmotionLog).filter(EmotionLog.user_id == user_id).delete(synchronize_session=False)

    # m. child_profiles
    db.query(ChildProfile).filter(ChildProfile.parent_id == user_id).delete(synchronize_session=False)

    # n. usuario
    db.delete(user)
    db.commit()
```

- [ ] **Step 4: Ejecutar todos los tests del módulo — deben pasar**

```bash
cd backend
pytest tests/test_admin.py -v
```

Expected: todos los tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/admin_service.py backend/tests/test_admin.py
git commit -m "feat: add admin service delete_user with cascade"
```

---

### Task 4: Admin router + registro en main.py + tests de integración

**Files:**
- Create: `backend/app/routers/admin.py`
- Modify: `backend/app/main.py` (registrar router)
- Modify: `backend/tests/test_admin.py` (añadir tests de endpoint)

**Interfaces:**
- Consumes: `require_admin`, `list_users`, `update_user`, `delete_user`, `AdminUserOut`, `AdminUserUpdate`, `get_db`
- Produces: endpoints REST en `/api/v1/admin/users`

- [ ] **Step 1: Añadir tests de integración a `backend/tests/test_admin.py`**

Añadir al final:

```python
# --- Endpoint integration tests ---

def test_list_users_endpoint_returns_200(client, db):
    token, admin = _admin_token(client, db)
    _make_user(db, email="p@example.com")
    res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    # El admin + el parent creado
    emails = [u["email"] for u in data]
    assert "p@example.com" in emails


def test_list_users_requires_admin(client, db):
    parent = _make_user(db)
    res_login = client.post("/api/v1/auth/login", json={"email": parent.email, "password": "Password123!"})
    token = res_login.json()["access_token"]
    res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_list_users_filter_by_role_endpoint(client, db):
    token, admin = _admin_token(client, db)
    _make_user(db, email="p@example.com", role=UserRole.parent)
    _make_user(db, email="s@example.com", role=UserRole.specialist)
    res = client.get("/api/v1/admin/users?role=parent", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    roles = [u["role"] for u in res.json()]
    assert all(r == "parent" for r in roles)


def test_update_user_endpoint_changes_role(client, db):
    token, admin = _admin_token(client, db)
    user = _make_user(db)
    res = client.patch(
        f"/api/v1/admin/users/{user.id}",
        json={"role": "specialist"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["role"] == "specialist"


def test_update_user_endpoint_self_returns_400(client, db):
    token, admin = _admin_token(client, db)
    res = client.patch(
        f"/api/v1/admin/users/{admin.id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


def test_update_user_endpoint_not_found(client, db):
    token, admin = _admin_token(client, db)
    res = client.patch(
        "/api/v1/admin/users/99999",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_delete_user_endpoint_returns_204(client, db):
    token, admin = _admin_token(client, db)
    user = _make_user(db)
    res = client.delete(
        f"/api/v1/admin/users/{user.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 204
    assert db.get(User, user.id) is None


def test_delete_user_endpoint_self_returns_400(client, db):
    token, admin = _admin_token(client, db)
    res = client.delete(
        f"/api/v1/admin/users/{admin.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


def test_delete_user_endpoint_not_found(client, db):
    token, admin = _admin_token(client, db)
    res = client.delete(
        "/api/v1/admin/users/99999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_delete_user_endpoint_requires_admin(client, db):
    parent = _make_user(db, email="p@example.com")
    res_login = client.post("/api/v1/auth/login", json={"email": parent.email, "password": "Password123!"})
    token = res_login.json()["access_token"]
    other = _make_user(db, email="other@example.com")
    res = client.delete(f"/api/v1/admin/users/{other.id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
```

- [ ] **Step 2: Ejecutar — deben fallar**

```bash
cd backend
pytest tests/test_admin.py::test_list_users_endpoint_returns_200 -v
```

Expected: FAIL con 404 — la ruta `/api/v1/admin/users` no existe.

- [ ] **Step 3: Crear `backend/app/routers/admin.py`**

```python
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
```

- [ ] **Step 4: Registrar el router en `backend/app/main.py`**

Añadir el import junto a los demás routers (línea 4):

```python
from app.routers import auth, emotions, scenarios, chat, calm, panel, biblioteca, profiles, assignments, lumi_chat, admin as admin_router
```

Añadir `include_router` después de `lumi_chat` (línea 48):

```python
app.include_router(admin_router.router, prefix="/api/v1/admin", tags=["administración"])
```

- [ ] **Step 5: Ejecutar todos los tests — deben pasar**

```bash
cd backend
pytest tests/test_admin.py -v
```

Expected: 26+ tests PASSED.

- [ ] **Step 6: Ejecutar toda la suite para detectar regresiones**

```bash
cd backend
pytest -v
```

Expected: todos PASSED.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/admin.py backend/app/main.py backend/tests/test_admin.py
git commit -m "feat: add admin router with list/update/delete user endpoints"
```

---

### Task 5: CLI script create_admin

**Files:**
- Create: `backend/scripts/__init__.py` (vacío)
- Create: `backend/scripts/create_admin.py`

**Interfaces:**
- Consumes: `SessionLocal` de `app.database`, `User` de `app.models.user`, `hash_password` de `app.core.security`
- Produces: ejecutable como `python -m scripts.create_admin --email EMAIL --password PASS --full-name NAME`

- [ ] **Step 1: Crear `backend/scripts/__init__.py`** (vacío — necesario para `python -m`)

```python
```

(archivo vacío)

- [ ] **Step 2: Crear `backend/scripts/create_admin.py`**

```python
import argparse
import sys
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password


def main():
    parser = argparse.ArgumentParser(description="Crear usuario administrador en SocialMind")
    parser.add_argument("--email",     required=True,  help="Email del administrador")
    parser.add_argument("--password",  required=True,  help="Contraseña (mínimo 8 caracteres)")
    parser.add_argument("--full-name", default="Administrador", help="Nombre completo")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("Error: la contraseña debe tener al menos 8 caracteres.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == args.email).first()
        if existing:
            print(f"Error: ya existe un usuario con el email '{args.email}'.", file=sys.stderr)
            sys.exit(1)

        admin = User(
            email=args.email,
            hashed_password=hash_password(args.password),
            full_name=args.full_name,
            role=UserRole.admin,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"Admin creado: {admin.email} (id={admin.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Verificar que el script se puede importar sin errores**

```bash
cd backend
python -c "import scripts.create_admin; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Verificar el mensaje de ayuda**

```bash
cd backend
python -m scripts.create_admin --help
```

Expected: muestra argumentos `--email`, `--password`, `--full-name`.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/__init__.py backend/scripts/create_admin.py
git commit -m "feat: add create_admin CLI script"
```

---

### Task 6: Frontend — adminApi + AdminRoute + stub AdminPage + Dashboard link

**Files:**
- Modify: `frontend/src/services/api.js` (añadir `adminApi`)
- Create: `frontend/src/pages/AdminPage.jsx` (stub mínimo)
- Modify: `frontend/src/router/index.jsx` (añadir `AdminRoute` + ruta `/admin`)
- Modify: `frontend/src/pages/Dashboard.jsx` (añadir tarjeta admin)

**Interfaces:**
- Produces:
  - `adminApi.listUsers(params)` → GET `/admin/users`
  - `adminApi.updateUser(id, data)` → PATCH `/admin/users/{id}`
  - `adminApi.deleteUser(id)` → DELETE `/admin/users/{id}`
  - `AdminRoute` — guard que redirige a `/login` si no autenticado, a `/inicio` si rol ≠ `admin`
  - Ruta `/admin` → `<AdminPage />`

- [ ] **Step 1: Añadir `adminApi` a `frontend/src/services/api.js`**

Añadir al final del archivo, después de `lumiChatApi`:

```js
export const adminApi = {
  listUsers:  (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id)       => api.delete(`/admin/users/${id}`),
}
```

- [ ] **Step 2: Crear stub `frontend/src/pages/AdminPage.jsx`**

```jsx
import { PageWrapper } from '../components/layout/PageWrapper'

export function AdminPage() {
  return (
    <PageWrapper className="px-6 py-10">
      <h1 className="text-xl font-extrabold text-primary-700">Panel de administración</h1>
      <p className="text-text-secondary mt-2">Cargando...</p>
    </PageWrapper>
  )
}
```

- [ ] **Step 3: Añadir `AdminRoute` y la ruta `/admin` en `frontend/src/router/index.jsx`**

Añadir el import de `AdminPage` junto a los demás imports de páginas:

```jsx
import { AdminPage } from '../pages/AdminPage'
```

Añadir `AdminRoute` después de `SpecialistRoute` (antes de `ParentOnboardingGuard`):

```jsx
function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/inicio" replace />
  return children
}
```

Añadir la ruta en el array del router después de `/reset-password`:

```jsx
{ path: '/admin', element: <AdminRoute><AdminPage /></AdminRoute> },
```

- [ ] **Step 4: Añadir tarjeta admin en `frontend/src/pages/Dashboard.jsx`**

Añadir `ADMIN_CARDS` después de `SPECIALIST_CARDS` (alrededor de la línea 98):

```jsx
const ADMIN_CARDS = [
  {
    emoji: '⚙️',
    title: 'Panel de administración',
    desc: 'Gestionar usuarios de la plataforma',
    available: true,
    path: '/admin',
  },
]
```

Reemplazar la línea que asigna `cards` (actualmente línea 113):

```jsx
// Antes:
const cards = user?.role === 'specialist' ? SPECIALIST_CARDS : MODULE_CARDS

// Después:
const cards = user?.role === 'specialist' ? SPECIALIST_CARDS
  : user?.role === 'admin' ? ADMIN_CARDS
  : MODULE_CARDS
```

- [ ] **Step 5: Verificar que el frontend compila sin errores**

```bash
cd frontend
npm run build
```

Expected: sin errores. (O `npm run dev` y navegar a `/admin` con una cuenta admin).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/api.js frontend/src/pages/AdminPage.jsx frontend/src/router/index.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: wire admin route, adminApi and Dashboard admin card"
```

---

### Task 7: Frontend — AdminPage.jsx implementación completa

**Files:**
- Modify: `frontend/src/pages/AdminPage.jsx` (reemplazar stub con implementación completa)

**Interfaces:**
- Consumes: `adminApi` de `../services/api`, `useAuth` de `../context/AuthContext`, `PageWrapper`, `Button`, `Input`, `LumiCharacter`
- Produces: tabla de usuarios con filtros, toggle activo/inactivo, cambio de rol, y eliminar con confirmación de dos pasos

- [ ] **Step 1: Verificar que el stub existe**

```bash
ls frontend/src/pages/AdminPage.jsx
```

- [ ] **Step 2: Reemplazar el stub con la implementación completa**

Contenido completo de `frontend/src/pages/AdminPage.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const ROLE_LABELS = {
  parent:     'Padre/Madre',
  specialist: 'Especialista',
  admin:      'Admin',
}

const ROLE_BADGE = {
  parent:     'bg-green-100 text-green-800',
  specialist: 'bg-blue-100 text-blue-800',
  admin:      'bg-purple-100 text-purple-800',
}

export function AdminPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [search, setSearch]             = useState('')
  const [roleFilter, setRoleFilter]     = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loadingRow, setLoadingRow]     = useState({})

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (search)               params.search    = search
      if (roleFilter)           params.role      = roleFilter
      if (activeFilter !== '')  params.is_active = activeFilter
      const res = await adminApi.listUsers(params)
      setUsers(res.data)
    } catch {
      setError('Error al cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, activeFilter])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  async function handleToggleActive(u) {
    setLoadingRow(prev => ({ ...prev, [u.id]: true }))
    try {
      const res = await adminApi.updateUser(u.id, { is_active: !u.is_active })
      setUsers(prev => prev.map(x => x.id === u.id ? res.data : x))
    } catch {
      setError('Error al actualizar el usuario.')
    } finally {
      setLoadingRow(prev => ({ ...prev, [u.id]: false }))
    }
  }

  async function handleRoleChange(userId, newRole) {
    setLoadingRow(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await adminApi.updateUser(userId, { role: newRole })
      setUsers(prev => prev.map(x => x.id === userId ? res.data : x))
    } catch {
      setError('Error al cambiar el rol.')
    } finally {
      setLoadingRow(prev => ({ ...prev, [userId]: false }))
    }
  }

  async function handleDelete(userId) {
    if (confirmDelete !== userId) {
      setConfirmDelete(userId)
      return
    }
    setLoadingRow(prev => ({ ...prev, [userId]: true }))
    try {
      await adminApi.deleteUser(userId)
      setUsers(prev => prev.filter(x => x.id !== userId))
      setConfirmDelete(null)
    } catch {
      setError('Error al eliminar el usuario.')
    } finally {
      setLoadingRow(prev => ({ ...prev, [userId]: false }))
    }
  }

  const isSelf = (u) => u.id === currentUser?.id

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">

        <h1 className="text-xl font-extrabold text-primary-700">Panel de administración</h1>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="border-2 border-calm-border rounded-2xl px-4 py-3 text-base bg-calm-surface focus:outline-none focus:border-primary-500 min-h-[56px]"
          >
            <option value="">Todos los roles</option>
            <option value="parent">Padres</option>
            <option value="specialist">Especialistas</option>
            <option value="admin">Admins</option>
          </select>

          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            className="border-2 border-calm-border rounded-2xl px-4 py-3 text-base bg-calm-surface focus:outline-none focus:border-primary-500 min-h-[56px]"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Suspendidos</option>
          </select>
        </div>

        {/* Error global */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-accent-coral text-sm"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {/* Tabla */}
        {loading ? (
          <p className="text-text-secondary text-base">Cargando usuarios...</p>
        ) : users.length === 0 ? (
          <p className="text-text-secondary text-base">No se encontraron usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary border-b border-calm-border">
                  <th className="pb-3 pr-4 font-semibold">Nombre</th>
                  <th className="pb-3 pr-4 font-semibold">Email</th>
                  <th className="pb-3 pr-4 font-semibold">Rol</th>
                  <th className="pb-3 pr-4 font-semibold">Estado</th>
                  <th className="pb-3 pr-4 font-semibold">Registro</th>
                  <th className="pb-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-calm-border last:border-0">
                    <td className="py-3 pr-4 font-medium text-text-primary">{u.full_name}</td>
                    <td className="py-3 pr-4 text-text-secondary">{u.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-800'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {new Date(u.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Toggle activo */}
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={isSelf(u) || loadingRow[u.id]}
                          className="text-xs px-3 py-1.5 rounded-xl border-2 border-calm-border hover:border-primary-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {u.is_active ? 'Suspender' : 'Activar'}
                        </button>

                        {/* Cambiar rol */}
                        <select
                          value={u.role}
                          disabled={isSelf(u) || loadingRow[u.id]}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="text-xs px-2 py-1.5 rounded-xl border-2 border-calm-border focus:outline-none focus:border-primary-500 bg-calm-surface disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="parent">Padre/Madre</option>
                          <option value="specialist">Especialista</option>
                          <option value="admin">Admin</option>
                        </select>

                        {/* Eliminar */}
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={isSelf(u) || loadingRow[u.id]}
                          className={`text-xs px-3 py-1.5 rounded-xl border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            confirmDelete === u.id
                              ? 'border-red-400 bg-red-50 text-red-700 font-semibold'
                              : 'border-calm-border hover:border-red-400 hover:text-red-600'
                          }`}
                        >
                          {confirmDelete === u.id ? '¿Seguro?' : 'Eliminar'}
                        </button>

                        {/* Cancelar confirmación */}
                        {confirmDelete === u.id && (
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-text-secondary hover:text-text-primary"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 3: Verificar que el frontend compila**

```bash
cd frontend
npm run build
```

Expected: sin errores.

- [ ] **Step 4: Iniciar el servidor de desarrollo y probar manualmente**

```bash
cd frontend
npm run dev
```

Pasos de verificación:
1. Iniciar sesión con una cuenta admin (créala con el CLI si es necesario)
2. Navegar a `/inicio` → debe aparecer la tarjeta "Panel de administración" con ⚙️
3. Hacer clic → navegar a `/admin`
4. La tabla muestra los usuarios con nombre, email, rol, estado y fecha
5. Buscar por nombre → la tabla filtra en tiempo real (con debounce de 300ms)
6. Filtrar por rol → solo aparecen usuarios de ese rol
7. Hacer clic en "Suspender" en un usuario → el badge cambia a "Suspendido"
8. Hacer clic en "Eliminar" → el botón cambia a "¿Seguro?"; segundo clic → el usuario desaparece de la tabla
9. Hacer clic en "Cancelar" en el segundo paso → se cancela la confirmación
10. La propia fila del admin tiene los botones deshabilitados (gris, no clickeable)
11. Iniciar sesión como `parent` e intentar ir a `/admin` → redirige a `/inicio`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminPage.jsx
git commit -m "feat: implement AdminPage with user table, filters, and inline actions"
```

---

## Creación del primer admin en producción

Una vez desplegado, ejecutar una sola vez en el VPS:

```bash
docker compose -f /root/socialmind/docker-compose.prod.yml exec backend \
  python -m scripts.create_admin \
  --email admin@socialmind.it.com \
  --full-name "Administrador" \
  --password "CONTRASEÑA_SEGURA_AQUI"
```
