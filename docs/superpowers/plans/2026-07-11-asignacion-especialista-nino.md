# Asignación Especialista-Niño: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada especialista ve solo los niños que le fueron asignados; el padre gestiona las asignaciones desde su Dashboard.

**Architecture:** Se agrega una tabla `specialist_assignments` (muchos-a-muchos entre usuarios especialistas y perfiles de niño). El Panel Profesional filtra por esa tabla. El padre gestiona las asignaciones desde una página nueva `/perfil/nino/:childId/especialistas` accesible desde el Dashboard. El especialista ve en su panel las familias que lo asignaron.

**Tech Stack:** Python/FastAPI/SQLAlchemy 2.x (Mapped/mapped_column) · Alembic · pytest · React 18/Vite/Tailwind/Framer Motion · axios

## Global Constraints

- IDs son `Integer`, nunca UUID (coherente con el resto del código)
- SQLAlchemy usa `Mapped[T]` / `mapped_column()` — nunca `Column()` ni `declarative_base()` clásico
- Español latinoamericano en todos los textos de UI
- `down_revision` de la migración nueva: `'f3a2c1b9d0e8'`
- Revision ID de la migración nueva: `'c8d9e0f1a2b3'`
- TDD: escribir test fallando → implementar → verificar verde → commit
- Tests usan SQLite en memoria (conftest.py ya configurado)
- El padre solo puede gestionar asignaciones de sus propios hijos — cualquier intento con hijo ajeno retorna 404

---

## Mapa de archivos

**Crear:**
- `backend/app/models/specialist_assignment.py`
- `backend/alembic/versions/c8d9e0f1a2b3_add_specialist_assignments.py`
- `backend/app/schemas/assignments.py`
- `backend/app/services/assignments_service.py`
- `backend/app/routers/assignments.py`
- `backend/tests/test_assignments.py`
- `frontend/src/components/SpecialistAssignments.jsx`
- `frontend/src/pages/ManageSpecialistsPage.jsx`

**Modificar:**
- `backend/app/main.py` — importar modelo + registrar router
- `backend/app/services/panel_service.py` — filtrar por asignaciones
- `backend/app/routers/panel.py` — pasar `specialist_id` a `list_children`
- `backend/tests/test_panel.py` — actualizar tests que necesitan asignación
- `frontend/src/services/api.js` — agregar `assignmentsApi`
- `frontend/src/pages/Dashboard.jsx` — link "Gestionar especialistas" en header de hijo
- `frontend/src/router/index.jsx` — agregar ruta `/perfil/nino/:childId/especialistas`
- `frontend/src/pages/PanelProfesional.jsx` — sección "Mis familias"

---

### Task 1: Modelo SpecialistAssignment + Migración Alembic

**Files:**
- Create: `backend/app/models/specialist_assignment.py`
- Create: `backend/alembic/versions/c8d9e0f1a2b3_add_specialist_assignments.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: clase `SpecialistAssignment` con campos `id`, `specialist_id`, `child_profile_id`, `assigned_at` y restricción única `uq_specialist_child`

- [ ] **Step 1: Crear el modelo**

```python
# backend/app/models/specialist_assignment.py
from datetime import datetime, timezone
from sqlalchemy import Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SpecialistAssignment(Base):
    __tablename__ = "specialist_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specialist_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    child_profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("child_profiles.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (UniqueConstraint("specialist_id", "child_profile_id", name="uq_specialist_child"),)
```

- [ ] **Step 2: Registrar el modelo en main.py**

Agregar en `backend/app/main.py` junto a los otros imports de modelos:

```python
import app.models.specialist_assignment
```

- [ ] **Step 3: Crear la migración Alembic**

```python
# backend/alembic/versions/c8d9e0f1a2b3_add_specialist_assignments.py
"""add_specialist_assignments

Revision ID: c8d9e0f1a2b3
Revises: f3a2c1b9d0e8
Create Date: 2026-07-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'f3a2c1b9d0e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'specialist_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('specialist_id', sa.Integer(), nullable=False),
        sa.Column('child_profile_id', sa.Integer(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['specialist_id'], ['users.id']),
        sa.ForeignKeyConstraint(['child_profile_id'], ['child_profiles.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('specialist_id', 'child_profile_id', name='uq_specialist_child'),
    )
    op.create_index(
        op.f('ix_specialist_assignments_id'), 'specialist_assignments', ['id'], unique=False
    )
    # Seed de compatibilidad: asignar todos los especialistas existentes a todos los niños existentes
    op.execute("""
        INSERT INTO specialist_assignments (specialist_id, child_profile_id, assigned_at)
        SELECT u.id, cp.id, CURRENT_TIMESTAMP
        FROM users u CROSS JOIN child_profiles cp
        WHERE u.role = 'specialist'
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_specialist_assignments_id'), table_name='specialist_assignments')
    op.drop_table('specialist_assignments')
```

- [ ] **Step 4: Verificar que los tests existentes siguen pasando**

```bash
cd backend
pytest tests/ -x -q
```

Expected: todos los tests pasan (el modelo nuevo no rompe nada existente).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/specialist_assignment.py \
        backend/alembic/versions/c8d9e0f1a2b3_add_specialist_assignments.py \
        backend/app/main.py
git commit -m "feat: modelo SpecialistAssignment y migración Alembic"
```

---

### Task 2: Schemas + Servicio + Router de asignaciones

**Files:**
- Create: `backend/app/schemas/assignments.py`
- Create: `backend/app/services/assignments_service.py`
- Create: `backend/app/routers/assignments.py`
- Create: `backend/tests/test_assignments.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `SpecialistAssignment` de Task 1; `require_parent`, `require_specialist` de `app.core.dependencies`
- Produces:
  - `assignments_service.list_specialists(db) -> list[User]`
  - `assignments_service.get_assigned_specialists(db, child_id, parent_id) -> list[User]`
  - `assignments_service.assign_specialist(db, child_id, specialist_id, parent_id) -> SpecialistAssignment`
  - `assignments_service.unassign_specialist(db, child_id, specialist_id, parent_id) -> None`
  - `assignments_service.get_my_parents(db, specialist_id) -> list[User]`
  - Router en `/api/v1/assignments`

- [ ] **Step 1: Escribir los tests (fallan primero)**

```python
# backend/tests/test_assignments.py
import pytest
from app.models.child_profile import ChildProfile


def _login(client, email, role="parent"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _me(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def _make_child(db, parent_id, name="Juan", age=10):
    child = ChildProfile(parent_id=parent_id, name=name, age=age, avatar_emoji="⭐")
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


def test_list_specialists_returns_all_active_specialists(client, db):
    parent_token = _login(client, "parent_a1@test.com", "parent")
    _login(client, "spec_a1@test.com", "specialist")
    _login(client, "spec_a2@test.com", "specialist")

    resp = client.get(
        "/api/v1/assignments/specialists",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    emails = {d["email"] for d in data}
    assert "spec_a1@test.com" in emails
    assert "spec_a2@test.com" in emails


def test_list_specialists_specialist_role_returns_403(client):
    spec_token = _login(client, "spec_b1@test.com", "specialist")
    resp = client.get(
        "/api/v1/assignments/specialists",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert resp.status_code == 403


def test_assign_creates_assignment(client, db):
    parent_token = _login(client, "parent_c1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_c1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["specialist_id"] == spec_id
    assert data["child_profile_id"] == child.id
    assert "assigned_at" in data


def test_assign_duplicate_returns_409(client, db):
    parent_token = _login(client, "parent_d1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_d1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 409


def test_assign_other_parents_child_returns_404(client, db):
    parent1_token = _login(client, "parent_e1@test.com", "parent")
    parent1_id = _me(client, parent1_token)["id"]
    parent2_token = _login(client, "parent_e2@test.com", "parent")
    spec_token = _login(client, "spec_e1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent1_id)

    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent2_token}"},
    )
    assert resp.status_code == 404


def test_assign_nonexistent_specialist_returns_404(client, db):
    parent_token = _login(client, "parent_f1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/9999",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 404


def test_unassign_removes_assignment(client, db):
    parent_token = _login(client, "parent_g1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_g1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.delete(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 204

    listed = client.get(
        f"/api/v1/assignments/children/{child.id}/specialists",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert listed.json() == []


def test_unassign_nonexistent_returns_404(client, db):
    parent_token = _login(client, "parent_h1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_h1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    resp = client.delete(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 404


def test_get_assigned_specialists_returns_list(client, db):
    parent_token = _login(client, "parent_i1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_i1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.get(
        f"/api/v1/assignments/children/{child.id}/specialists",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == spec_id
    assert data[0]["email"] == "spec_i1@test.com"


def test_my_parents_returns_parents_who_assigned(client, db):
    parent_token = _login(client, "parent_j1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_j1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.get(
        "/api/v1/assignments/my-parents",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == parent_id


def test_my_parents_no_assignments_returns_empty(client):
    spec_token = _login(client, "spec_k1@test.com", "specialist")
    resp = client.get(
        "/api/v1/assignments/my-parents",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_my_parents_parent_role_returns_403(client):
    parent_token = _login(client, "parent_l1@test.com", "parent")
    resp = client.get(
        "/api/v1/assignments/my-parents",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 403
```

- [ ] **Step 2: Ejecutar tests — deben FALLAR**

```bash
cd backend
pytest tests/test_assignments.py -v
```

Expected: ImportError o 404s — el router no existe aún.

- [ ] **Step 3: Crear schemas**

```python
# backend/app/schemas/assignments.py
from datetime import datetime
from pydantic import BaseModel


class SpecialistOut(BaseModel):
    id: int
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class ParentOut(BaseModel):
    id: int
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class AssignmentOut(BaseModel):
    id: int
    specialist_id: int
    child_profile_id: int
    assigned_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Crear servicio**

```python
# backend/app/services/assignments_service.py
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.specialist_assignment import SpecialistAssignment


def _get_child_for_parent(db: Session, child_id: int, parent_id: int) -> ChildProfile:
    child = db.query(ChildProfile).filter(
        ChildProfile.id == child_id,
        ChildProfile.parent_id == parent_id,
    ).first()
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de niño no encontrado.",
        )
    return child


def list_specialists(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == UserRole.specialist, User.is_active == True)
        .order_by(User.full_name)
        .all()
    )


def get_assigned_specialists(db: Session, child_id: int, parent_id: int) -> list[User]:
    _get_child_for_parent(db, child_id, parent_id)
    return (
        db.query(User)
        .join(SpecialistAssignment, SpecialistAssignment.specialist_id == User.id)
        .filter(SpecialistAssignment.child_profile_id == child_id)
        .order_by(User.full_name)
        .all()
    )


def assign_specialist(
    db: Session, child_id: int, specialist_id: int, parent_id: int
) -> SpecialistAssignment:
    _get_child_for_parent(db, child_id, parent_id)

    specialist = db.query(User).filter(
        User.id == specialist_id,
        User.role == UserRole.specialist,
        User.is_active == True,
    ).first()
    if not specialist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialista no encontrado.",
        )

    existing = db.query(SpecialistAssignment).filter(
        SpecialistAssignment.specialist_id == specialist_id,
        SpecialistAssignment.child_profile_id == child_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este especialista ya está asignado a este niño.",
        )

    assignment = SpecialistAssignment(
        specialist_id=specialist_id,
        child_profile_id=child_id,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def unassign_specialist(
    db: Session, child_id: int, specialist_id: int, parent_id: int
) -> None:
    _get_child_for_parent(db, child_id, parent_id)

    assignment = db.query(SpecialistAssignment).filter(
        SpecialistAssignment.specialist_id == specialist_id,
        SpecialistAssignment.child_profile_id == child_id,
    ).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada.",
        )

    db.delete(assignment)
    db.commit()


def get_my_parents(db: Session, specialist_id: int) -> list[User]:
    return (
        db.query(User)
        .join(ChildProfile, ChildProfile.parent_id == User.id)
        .join(SpecialistAssignment, SpecialistAssignment.child_profile_id == ChildProfile.id)
        .filter(SpecialistAssignment.specialist_id == specialist_id)
        .distinct()
        .order_by(User.full_name)
        .all()
    )
```

- [ ] **Step 5: Crear router**

```python
# backend/app/routers/assignments.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_parent, require_specialist
from app.models.user import User
from app.schemas.assignments import AssignmentOut, ParentOut, SpecialistOut
from app.services import assignments_service

router = APIRouter()


@router.get("/specialists", response_model=list[SpecialistOut])
def list_all_specialists(
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    return assignments_service.list_specialists(db)


@router.get("/children/{child_id}/specialists", response_model=list[SpecialistOut])
def get_assigned_specialists(
    child_id: int,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    return assignments_service.get_assigned_specialists(db, child_id, current_user.id)


@router.post(
    "/children/{child_id}/specialists/{specialist_id}",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_specialist(
    child_id: int,
    specialist_id: int,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    return assignments_service.assign_specialist(db, child_id, specialist_id, current_user.id)


@router.delete(
    "/children/{child_id}/specialists/{specialist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unassign_specialist(
    child_id: int,
    specialist_id: int,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    assignments_service.unassign_specialist(db, child_id, specialist_id, current_user.id)


@router.get("/my-parents", response_model=list[ParentOut])
def get_my_parents(
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return assignments_service.get_my_parents(db, current_user.id)
```

- [ ] **Step 6: Registrar router en main.py**

Reemplazar la línea de imports de routers en `backend/app/main.py`:

```python
from app.routers import auth, emotions, scenarios, chat, calm, panel, biblioteca, profiles, assignments
```

Agregar después de `app.include_router(gamification_router.router, ...)`:

```python
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["asignaciones"])
```

- [ ] **Step 7: Ejecutar tests — deben PASAR**

```bash
cd backend
pytest tests/test_assignments.py -v
```

Expected: 12 tests PASS.

- [ ] **Step 8: Verificar que todos los tests siguen pasando**

```bash
pytest tests/ -x -q
```

Expected: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/assignments.py \
        backend/app/services/assignments_service.py \
        backend/app/routers/assignments.py \
        backend/tests/test_assignments.py \
        backend/app/main.py
git commit -m "feat: schemas, servicio y router de asignaciones especialista-niño"
```

---

### Task 3: Filtrar Panel por asignaciones

**Files:**
- Modify: `backend/app/services/panel_service.py`
- Modify: `backend/app/routers/panel.py`
- Modify: `backend/tests/test_panel.py`

**Interfaces:**
- Consumes: `SpecialistAssignment` de Task 1
- Produces: `panel_service.list_children(db, specialist_id)` — firma cambia (agrega `specialist_id`)

- [ ] **Step 1: Escribir nuevos tests en test_panel.py + agregar helper _assign_child**

Agregar al inicio de `backend/tests/test_panel.py` el import del modelo:

```python
from app.models.specialist_assignment import SpecialistAssignment
from datetime import datetime, timezone
```

Agregar la función helper después de `_make_child`:

```python
def _assign_child(db, specialist_id, child_profile_id):
    a = SpecialistAssignment(
        specialist_id=specialist_id,
        child_profile_id=child_profile_id,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(a)
    db.commit()
```

Agregar al final del archivo dos nuevos tests:

```python
def test_list_children_only_shows_assigned_children(client, db):
    spec_token = _login(client, "spec_filter1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent_filter1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child1 = _make_child(db, parent_id, name="Asignado", age=10)
    _make_child(db, parent_id, name="NoAsignado", age=11)
    _assign_child(db, spec_id, child1.id)

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Asignado"


def test_get_child_detail_not_assigned_returns_403(client, db):
    spec_token = _login(client, "spec_403@test.com", "specialist")
    parent_token = _login(client, "parent_403@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Bloqueado", age=9)

    response = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 403


def test_list_children_empty_if_no_assignments(client, db):
    spec_token = _login(client, "spec_empty@test.com", "specialist")
    parent_token = _login(client, "parent_empty@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    _make_child(db, parent_id, name="Tomás", age=10)

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 2: Actualizar tests existentes que necesitan asignación**

Los siguientes tests en `test_panel.py` necesitan llamar a `_assign_child` después de crear el niño. Modificarlos uno por uno:

**test_list_children_returns_child_profiles** — agregar `_assign_child` después de `_make_child`:
```python
def test_list_children_returns_child_profiles(client, db):
    spec_token = _login(client, "spec1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Juan", age=10)
    _assign_child(db, spec_id, child.id)

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Juan"
    assert data[0]["age"] == 10
    assert data[0]["avatar_emoji"] == "⭐"
    assert data[0]["total_calm_sessions"] == 0
    assert data[0]["total_chats"] == 0
```

**test_get_child_detail_returns_emotions_calm_chats** — agregar spec_id + `_assign_child`:
```python
def test_get_child_detail_returns_emotions_calm_chats(client, db):
    from datetime import datetime, timezone
    spec_token = _login(client, "spec2@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent3@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Ana", age=12)
    _assign_child(db, spec_id, child.id)
    now = datetime.now(timezone.utc)

    db.add(EmotionLog(user_id=parent_id, emotion_key="feliz", logged_at=now))
    db.add(CalmSession(user_id=parent_id, activity_type="respirar",
                       duration_seconds=40, emotion_key="feliz", created_at=now))
    conv = ChatConversation(user_id=parent_id, emotion_key="feliz", started_at=now)
    db.add(conv)
    db.flush()
    db.add(ChatMessage(conversation_id=conv.id, role="assistant",
                       content="Hola", created_at=now))
    db.commit()

    response = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Ana"
    assert len(data["emotions"]) == 1
    assert data["emotions"][0]["emotion_key"] == "feliz"
    assert len(data["calm_sessions"]) == 1
    assert data["calm_sessions"][0]["activity_type"] == "respirar"
    assert len(data["conversations"]) == 1
    assert len(data["conversations"][0]["messages"]) == 1
    assert data["specialist_note"] is None
```

**test_get_child_detail_other_specialist_sees_same_child** — asignar AMBOS especialistas:
```python
def test_get_child_detail_other_specialist_sees_same_child(client, db):
    spec1_token = _login(client, "spec3@test.com", "specialist")
    spec1_id = _me(client, spec1_token)["id"]
    spec2_token = _login(client, "spec4@test.com", "specialist")
    spec2_id = _me(client, spec2_token)["id"]
    parent_token = _login(client, "parent4@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Pedro", age=9)
    _assign_child(db, spec1_id, child.id)
    _assign_child(db, spec2_id, child.id)

    r1 = client.get(f"/api/v1/panel/children/{child.id}",
                    headers={"Authorization": f"Bearer {spec1_token}"})
    r2 = client.get(f"/api/v1/panel/children/{child.id}",
                    headers={"Authorization": f"Bearer {spec2_token}"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["name"] == r2.json()["name"] == "Pedro"
```

**test_child_detail_includes_gamification** — agregar `_assign_child` antes de hacer el GET:
```python
def test_child_detail_includes_gamification(client, db):
    from app.core.security import hash_password
    from app.models.user import User, UserRole
    from app.models.child_profile import ChildProfile

    spec = User(
        email="spec_gami@test.com",
        hashed_password=hash_password("Password123!"),
        full_name="Spec", role=UserRole.specialist,
    )
    padre = User(
        email="padre_gami@test.com",
        hashed_password=hash_password("Password123!"),
        full_name="Padre", role=UserRole.parent,
    )
    db.add_all([spec, padre])
    db.commit()

    child = ChildProfile(parent_id=padre.id, name="Niño Test", age=10, avatar_emoji="🌟")
    db.add(child)
    db.commit()
    db.refresh(child)

    _assign_child(db, spec.id, child.id)

    spec_login = client.post(
        "/api/v1/auth/login",
        json={"email": "spec_gami@test.com", "password": "Password123!"},
    )
    spec_token = spec_login.json()["access_token"]

    r = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "gamification_progress" in data
    assert data["gamification_progress"]["total_stars"] == 0
    assert data["gamification_progress"]["level_key"] == "explorador"
```

**test_child_detail_includes_scenarios_completed** — agregar spec_id + `_assign_child`:
```python
def test_child_detail_includes_scenarios_completed(client, db):
    from datetime import datetime, timezone
    from app.models.scenario_completion import ScenarioCompletion

    spec_token = _login(client, "spec_sc1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent_sc1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="María", age=11)
    _assign_child(db, spec_id, child.id)
    now = datetime.now(timezone.utc)

    db.add(ScenarioCompletion(user_id=parent_id, scenario_id=1, completed_at=now))
    db.commit()

    response = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "scenarios_completed" in data
    assert len(data["scenarios_completed"]) == 1
    sc = data["scenarios_completed"][0]
    assert sc["scenario_id"] == 1
    assert sc["emoji"]
    assert sc["title"]
    assert "completed_at" in sc
```

**test_list_children_includes_total_scenarios_completed** — agregar spec_id + `_assign_child`:
```python
def test_list_children_includes_total_scenarios_completed(client, db):
    from app.models.scenario_completion import ScenarioCompletion

    spec_token = _login(client, "spec_sc2@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent_sc2@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Sofía", age=9)
    _assign_child(db, spec_id, child.id)

    db.add(ScenarioCompletion(user_id=parent_id, scenario_id=1))
    db.add(ScenarioCompletion(user_id=parent_id, scenario_id=2))
    db.commit()

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["total_scenarios_completed"] == 2
```

- [ ] **Step 3: Ejecutar tests — los nuevos tests deben FALLAR, los viejos actualizados también**

```bash
cd backend
pytest tests/test_panel.py -v
```

Expected: nuevos tests FAIL (403 no implementado, lista no filtrada).

- [ ] **Step 4: Actualizar panel_service.py**

Reemplazar `list_children` y `get_child_detail` en `backend/app/services/panel_service.py`:

```python
def list_children(db: Session, specialist_id: int) -> list[dict]:
    from app.models.specialist_assignment import SpecialistAssignment
    profiles = (
        db.query(ChildProfile)
        .join(SpecialistAssignment, SpecialistAssignment.child_profile_id == ChildProfile.id)
        .filter(SpecialistAssignment.specialist_id == specialist_id)
        .order_by(ChildProfile.name)
        .all()
    )
    result = []
    for profile in profiles:
        pid = profile.parent_id
        last_emotion = (
            db.query(EmotionLog)
            .filter(EmotionLog.user_id == pid)
            .order_by(EmotionLog.logged_at.desc())
            .first()
        )
        total_calm = db.query(CalmSession).filter(CalmSession.user_id == pid).count()
        total_chats = db.query(ChatConversation).filter(ChatConversation.user_id == pid).count()
        total_scenarios = (
            db.query(ScenarioCompletion).filter(ScenarioCompletion.user_id == pid).count()
        )
        result.append({
            "child_profile_id": profile.id,
            "name": profile.name,
            "age": profile.age,
            "avatar_emoji": profile.avatar_emoji,
            "last_emotion_key": last_emotion.emotion_key if last_emotion else None,
            "total_calm_sessions": total_calm,
            "total_chats": total_chats,
            "total_scenarios_completed": total_scenarios,
        })
    return result
```

Agregar verificación de asignación al inicio de `get_child_detail`, justo después del bloque que verifica `profile`:

```python
def get_child_detail(db: Session, child_id: int, specialist_id: int) -> dict:
    from app.models.specialist_assignment import SpecialistAssignment
    profile = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Niño no encontrado.")

    assignment = db.query(SpecialistAssignment).filter(
        SpecialistAssignment.specialist_id == specialist_id,
        SpecialistAssignment.child_profile_id == child_id,
    ).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este niño.",
        )

    pid = profile.parent_id
    # ... resto del código sin cambios desde "pid = profile.parent_id"
```

- [ ] **Step 5: Actualizar panel.py router**

Reemplazar la función `list_children` en `backend/app/routers/panel.py`:

```python
@router.get("/children", response_model=list[ChildSummaryOut])
def list_children(
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return panel_service.list_children(db, current_user.id)
```

- [ ] **Step 6: Ejecutar todos los tests del panel — deben PASAR**

```bash
cd backend
pytest tests/test_panel.py -v
```

Expected: todos los tests PASS.

- [ ] **Step 7: Verificar suite completa**

```bash
pytest tests/ -x -q
```

Expected: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/panel_service.py \
        backend/app/routers/panel.py \
        backend/tests/test_panel.py
git commit -m "feat: filtrar panel por asignaciones — cada especialista ve solo sus niños"
```

---

### Task 4: Frontend — assignmentsApi + SpecialistAssignments + ManageSpecialistsPage

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/components/SpecialistAssignments.jsx`
- Create: `frontend/src/pages/ManageSpecialistsPage.jsx`
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: endpoints de Task 2 (`/api/v1/assignments/...`)
- Produces: componente `<SpecialistAssignments childProfileId={n} />`, página en `/perfil/nino/:childId/especialistas`

- [ ] **Step 1: Agregar assignmentsApi en api.js**

Agregar al final de `frontend/src/services/api.js`:

```js
export const assignmentsApi = {
  listSpecialists: () => api.get('/assignments/specialists'),
  listAssigned: (childId) => api.get(`/assignments/children/${childId}/specialists`),
  assign: (childId, specialistId) =>
    api.post(`/assignments/children/${childId}/specialists/${specialistId}`),
  unassign: (childId, specialistId) =>
    api.delete(`/assignments/children/${childId}/specialists/${specialistId}`),
  myParents: () => api.get('/assignments/my-parents'),
}
```

- [ ] **Step 2: Crear SpecialistAssignments.jsx**

```jsx
// frontend/src/components/SpecialistAssignments.jsx
import { useState, useEffect } from 'react'
import { assignmentsApi } from '../services/api'

export function SpecialistAssignments({ childProfileId }) {
  const [assigned, setAssigned]           = useState([])
  const [allSpecialists, setAllSpecialists] = useState([])
  const [showPicker, setShowPicker]       = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    assignmentsApi.listAssigned(childProfileId)
      .then(res => setAssigned(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [childProfileId])

  const handleShowPicker = async () => {
    setError(null)
    try {
      const res = await assignmentsApi.listSpecialists()
      setAllSpecialists(res.data)
      setShowPicker(true)
    } catch {
      setError('No se pudo cargar la lista de especialistas.')
    }
  }

  const handleAssign = async (specialist) => {
    setError(null)
    try {
      await assignmentsApi.assign(childProfileId, specialist.id)
      setAssigned(prev => [...prev, specialist])
      setShowPicker(false)
    } catch (err) {
      if (err.response?.status === 409) {
        setError('Este especialista ya está asignado.')
      } else {
        setError('No se pudo asignar el especialista.')
      }
    }
  }

  const handleUnassign = async (specialistId) => {
    setError(null)
    try {
      await assignmentsApi.unassign(childProfileId, specialistId)
      setAssigned(prev => prev.filter(s => s.id !== specialistId))
    } catch {
      setError('No se pudo quitar el especialista.')
    }
  }

  const available = allSpecialists.filter(s => !assigned.find(a => a.id === s.id))

  if (loading) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-text-primary text-base">Especialistas asignados</p>

      {assigned.length === 0 && (
        <p className="text-sm text-text-secondary">Ningún especialista asignado aún.</p>
      )}

      {assigned.map(spec => (
        <div
          key={spec.id}
          className="flex items-center justify-between p-3 rounded-2xl bg-calm-surface border border-calm-border"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">👩‍⚕️ {spec.full_name}</p>
            <p className="text-xs text-text-secondary">{spec.email}</p>
          </div>
          <button
            onClick={() => handleUnassign(spec.id)}
            className="text-text-muted hover:text-red-500 text-lg leading-none px-2"
            aria-label={`Quitar a ${spec.full_name}`}
          >
            ✕
          </button>
        </div>
      ))}

      {showPicker && available.length > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-calm-surface border-2 border-primary-200">
          <p className="text-xs font-bold text-text-secondary mb-1">Selecciona un especialista:</p>
          {available.map(spec => (
            <button
              key={spec.id}
              onClick={() => handleAssign(spec)}
              className="text-left p-2 rounded-xl hover:bg-primary-50 transition-colors"
            >
              <p className="text-sm font-semibold text-text-primary">{spec.full_name}</p>
              <p className="text-xs text-text-secondary">{spec.email}</p>
            </button>
          ))}
        </div>
      )}

      {showPicker && available.length === 0 && (
        <p className="text-sm text-text-secondary">Todos los especialistas ya están asignados.</p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3 mt-1">
        {!showPicker ? (
          <button
            type="button"
            onClick={handleShowPicker}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 underline"
          >
            + Agregar especialista
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear ManageSpecialistsPage.jsx**

```jsx
// frontend/src/pages/ManageSpecialistsPage.jsx
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { SpecialistAssignments } from '../components/SpecialistAssignments'

export function ManageSpecialistsPage() {
  const { childId } = useParams()
  const navigate    = useNavigate()

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-extrabold text-primary-700">Especialistas del niño</h1>
        </div>
        <SpecialistAssignments childProfileId={parseInt(childId, 10)} />
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 4: Agregar ruta en router/index.jsx**

Agregar el import al inicio de `frontend/src/router/index.jsx`:

```jsx
import { ManageSpecialistsPage } from '../pages/ManageSpecialistsPage'
```

Agregar la ruta al array de rutas (después de `/perfil/nuevo-nino`):

```jsx
{
  path: '/perfil/nino/:childId/especialistas',
  element: <ProtectedRoute><ManageSpecialistsPage /></ProtectedRoute>,
},
```

- [ ] **Step 5: Agregar link en Dashboard.jsx**

En `frontend/src/pages/Dashboard.jsx`, dentro del bloque `{user?.role === 'parent' && child ? (...)}`, agregar el link bajo la edad del niño:

```jsx
{user?.role === 'parent' && child ? (
  <>
    <span className="text-5xl" role="img" aria-label={`Avatar de ${child.name}`}>
      {child.avatar_emoji}
    </span>
    <div>
      <h1 className="text-xl font-extrabold text-primary-700">{child.name}</h1>
      <p className="text-base text-text-secondary">{child.age} años</p>
      <button
        onClick={() => navigate(`/perfil/nino/${child.id}/especialistas`)}
        className="text-xs text-primary-600 font-semibold hover:underline mt-1"
      >
        Gestionar especialistas
      </button>
    </div>
  </>
) : (
  // ... bloque else sin cambios
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/api.js \
        frontend/src/components/SpecialistAssignments.jsx \
        frontend/src/pages/ManageSpecialistsPage.jsx \
        frontend/src/router/index.jsx \
        frontend/src/pages/Dashboard.jsx
git commit -m "feat: gestión de asignaciones de especialistas — UI para padres"
```

---

### Task 5: Frontend — Panel Profesional "Mis familias"

**Files:**
- Modify: `frontend/src/pages/PanelProfesional.jsx`

**Interfaces:**
- Consumes: `assignmentsApi.myParents()` de Task 4

- [ ] **Step 1: Actualizar PanelProfesional.jsx**

Reemplazar el contenido completo de `frontend/src/pages/PanelProfesional.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { panelApi, assignmentsApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { EMOTION_META } from '../components/panel/EmotionDistributionChart'

export function PanelProfesional() {
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [parents, setParents]   = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      panelApi.listChildren(),
      assignmentsApi.myParents(),
    ])
      .then(([childrenRes, parentsRes]) => {
        setChildren(childrenRes.data)
        setParents(parentsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageWrapper className="items-center justify-center">
        <LumiCharacter state="thinking" size={90} />
        <p className="text-base text-text-secondary mt-4">Cargando...</p>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-extrabold text-primary-700">Panel Profesional</h1>
        </div>

        <button
          onClick={() => navigate('/biblioteca/consultar')}
          className="
            w-full flex items-center gap-4 p-5 rounded-3xl text-left
            bg-calm-surface border-2 border-calm-border
            hover:border-primary-500 hover:bg-primary-50
            transition-all font-semibold text-base text-text-primary
          "
        >
          <span className="text-3xl">📖</span>
          <div>
            <div className="font-bold text-text-primary">Consultar Biblioteca</div>
            <div className="text-sm text-text-secondary">Consulta los documentos clínicos con IA</div>
          </div>
        </button>

        {parents.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-text-secondary">Familias que te asignaron</p>
            <div className="flex flex-wrap gap-2">
              {parents.map(parent => (
                <span
                  key={parent.id}
                  className="px-3 py-1 rounded-full bg-calm-surface border border-calm-border text-sm text-text-primary"
                >
                  👨‍👩‍👧 {parent.full_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {children.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-10">
            Aún no tienes niños asignados. Pide a un padre que te agregue desde el perfil de su hijo.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {children.map((child, i) => (
              <motion.button
                key={child.child_profile_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => navigate(`/panel/ninos/${child.child_profile_id}`)}
                className="
                  w-full flex items-center gap-4 p-5 rounded-3xl text-left
                  bg-calm-surface border-2 border-calm-border
                  hover:border-primary-500 hover:bg-primary-50
                  transition-colors min-h-[72px]
                "
                aria-label={`Ver perfil de ${child.name}`}
              >
                <span className="text-3xl">{child.avatar_emoji}</span>
                <div className="flex-1">
                  <p className="font-bold text-text-primary text-base">{child.name}</p>
                  <p className="text-base text-text-secondary">{child.age} años</p>
                </div>
                <div className="text-right">
                  {child.last_emotion_key && (
                    <p className="text-base text-text-secondary">
                      Hoy: {EMOTION_META[child.last_emotion_key]?.emoji ?? ''}{' '}
                      {EMOTION_META[child.last_emotion_key]?.label ?? child.last_emotion_key}
                    </p>
                  )}
                  <p className="text-base text-text-muted">
                    {child.total_chats} chats · {child.total_calm_sessions} calma · {child.total_scenarios_completed} escenarios
                  </p>
                </div>
                <span className="text-text-muted text-xl">›</span>
              </motion.button>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Verificar que el frontend compila sin errores**

```bash
cd frontend
npm run build
```

Expected: Build exitoso sin errores de TypeScript/lint.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PanelProfesional.jsx
git commit -m "feat: sección Mis familias en Panel Profesional"
```

---

## Verificación final

Después de todos los tasks:

```bash
# Backend — todos los tests
cd backend && pytest tests/ -v

# Frontend — build limpio
cd frontend && npm run build
```

**Prueba manual en producción (después de deploy):**
1. Iniciar sesión como `padre@prueba.com` → `/inicio` → ver link "Gestionar especialistas"
2. Abrir `/perfil/nino/{id}/especialistas` → agregar `esp@prueba.com` como especialista
3. Iniciar sesión como `esp@prueba.com` → `/panel` → ver al niño asignado y la familia en "Mis familias"
4. Verificar que un segundo especialista sin asignación ve panel vacío
