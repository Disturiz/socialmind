# Aprendo Hábitos (Infografías de Comportamiento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a module where specialists/admin upload behavior infographics (image or PDF) organized by category, and any logged-in user (parent/child, specialist, admin) browses them in a gallery.

**Architecture:** Backend follows the existing Biblioteca (RAG) pattern — FastAPI router + service layer + SQLAlchemy model, files stored on disk under `/data/habitos`, metadata in a new `habit_infographics` table. Unlike Biblioteca, the file must be *displayed* to the user, so a new authenticated file-serving endpoint is added, and the frontend fetches files as authenticated blobs (not raw `<img src>` URLs, since `<img>` cannot send the JWT header).

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pytest (backend) · React, React Router, Axios, Framer Motion, Tailwind (frontend)

**Spec:** `docs/superpowers/specs/2026-07-19-aprendo-habitos-infografias-design.md`

## Global Constraints

- Todo texto visible al usuario: mínimo `text-base`
- Elementos interactivos: `min-h-[44px]`
- Colores: solo clases estáticas en Tailwind (sin concatenación dinámica)
- Idioma: solo español latinoamericano en todo texto visible
- Sin lenguaje clínico, médico ni diagnóstico en ninguna etiqueta visible
- Cualquier `motion.*` nuevo debe usar `useReducedMotion()` si anima opacidad/posición de forma continua o de entrada
- Tamaño máximo de archivo: 10 MB (10 485 760 bytes)
- Tipos de archivo permitidos: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`
- Subida y eliminación: solo roles `specialist` y `admin` (eliminación también permitida al propio uploader)
- Backend actual: SQLite en memoria para tests (`backend/tests/conftest.py`), Postgres en dev/prod

---

## Task 1: Modelo, migración y registro

**Files:**
- Create: `backend/app/models/habit_infographic.py`
- Create: `backend/alembic/versions/24c535367986_add_habit_infographics.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_habitos.py`

**Interfaces:**
- Produces: `HabitInfographic` SQLAlchemy model (`app.models.habit_infographic.HabitInfographic`) with fields `id: int`, `uploaded_by: int`, `title: str`, `description: str | None`, `category: str`, `file_type: str`, `filename: str`, `original_name: str`, `mime_type: str`, `file_size_bytes: int`, `created_at: datetime` — used by Tasks 2–6.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_habitos.py`:

```python
from sqlalchemy import text


def test_habit_infographics_table_exists(db):
    result = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='habit_infographics'")
    )
    assert result.fetchone() is not None, "Tabla 'habit_infographics' no existe"
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_habitos.py -v`
Expected: FAIL — the table doesn't exist yet because the model isn't imported into `Base.metadata` (via `app/models/__init__.py`), so `Base.metadata.create_all()` in the `db` fixture never creates it.

- [ ] **Step 3: Create the model**

Create `backend/app/models/habit_infographic.py`:

```python
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class HabitInfographic(Base):
    __tablename__ = "habit_infographics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    uploaded_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
```

- [ ] **Step 4: Register the model in `app/models/__init__.py`**

Modify `backend/app/models/__init__.py` — current content:

```python
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.scenario_completion import ScenarioCompletion
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.calm_session import CalmSession
from app.models.specialist_note import SpecialistNote
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.password_reset_token import PasswordResetToken

__all__ = [
    "User", "UserRole", "ChildProfile",
    "EmotionLog", "ScenarioCompletion",
    "ChatConversation", "ChatMessage",
    "CalmSession", "SpecialistNote",
    "Document", "DocumentChunk",
    "PasswordResetToken",
]
```

Replace with:

```python
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.scenario_completion import ScenarioCompletion
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.calm_session import CalmSession
from app.models.specialist_note import SpecialistNote
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.password_reset_token import PasswordResetToken
from app.models.habit_infographic import HabitInfographic

__all__ = [
    "User", "UserRole", "ChildProfile",
    "EmotionLog", "ScenarioCompletion",
    "ChatConversation", "ChatMessage",
    "CalmSession", "SpecialistNote",
    "Document", "DocumentChunk",
    "PasswordResetToken",
    "HabitInfographic",
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_habitos.py -v`
Expected: PASS

- [ ] **Step 6: Create the Alembic migration for production/dev Postgres**

Current migration head is `e1f2a3b4c5d6` (verify with `python -m alembic history` from `backend/` — the line ending in `(head)`).

Create `backend/alembic/versions/24c535367986_add_habit_infographics.py`:

```python
"""add_habit_infographics

Revision ID: 24c535367986
Revises: e1f2a3b4c5d6
Create Date: 2026-07-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '24c535367986'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('habit_infographics',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('uploaded_by', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('category', sa.String(length=60), nullable=False),
    sa.Column('file_type', sa.String(length=10), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('file_size_bytes', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_habit_infographics_id'), 'habit_infographics', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_habit_infographics_id'), table_name='habit_infographics')
    op.drop_table('habit_infographics')
```

Verify the migration chain is valid: run `python -m alembic history` from `backend/` and confirm the top line now reads `24c535367986 -> e1f2a3b4c5d6, add_habit_infographics` is NOT what you want — it should read `e1f2a3b4c5d6 -> 24c535367986 (head), add_habit_infographics`. If the arrow direction looks reversed, `down_revision` is wrong; it must equal the *previous* head (`e1f2a3b4c5d6`).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/habit_infographic.py backend/app/models/__init__.py backend/alembic/versions/24c535367986_add_habit_infographics.py backend/tests/test_habitos.py
git commit -m "feat: add HabitInfographic model and migration"
```

---

## Task 2: Capa de servicio — validación de archivo y almacenamiento

**Files:**
- Create: `backend/app/services/habitos_service.py`
- Test: `backend/tests/test_habitos.py` (append)

**Interfaces:**
- Consumes: `HabitInfographic` model from Task 1.
- Produces (used by Tasks 3–6):
  - `DATA_DIR: str` (module-level, monkeypatchable in tests like `biblioteca_service.DATA_DIR`)
  - `detect_file_type(content_type: str, file_bytes: bytes) -> tuple[str, str] | None` — returns `(file_type, extension)` or `None`
  - `save_infographic(db, uploaded_by, file_bytes, file_type, ext, mime_type, title, category, description, original_name) -> HabitInfographic`
  - `list_infographics(db, category=None) -> list[HabitInfographic]`
  - `list_categorias(db) -> list[str]`
  - `get_infographic(db, infographic_id) -> HabitInfographic` (raises `HTTPException(404)` if not found)
  - `delete_infographic(db, current_user_id, is_admin, infographic_id) -> None` (raises `HTTPException(404)` if not found or not owner/admin)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_habitos.py`:

```python
from app.services.habitos_service import detect_file_type


def test_detect_file_type_valid_pdf():
    assert detect_file_type("application/pdf", b"%PDF-1.4 fake content") == ("pdf", "pdf")


def test_detect_file_type_valid_png():
    body = b"\x89PNG\r\n\x1a\n" + b"restofpngbytes"
    assert detect_file_type("image/png", body) == ("image", "png")


def test_detect_file_type_valid_jpeg():
    body = b"\xff\xd8\xff" + b"restofjpegbytes"
    assert detect_file_type("image/jpeg", body) == ("image", "jpg")


def test_detect_file_type_valid_webp():
    body = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"restofwebpbytes"
    assert detect_file_type("image/webp", body) == ("image", "webp")


def test_detect_file_type_rejects_mismatched_signature():
    assert detect_file_type("application/pdf", b"this is not a real pdf") is None


def test_detect_file_type_rejects_unsupported_content_type():
    assert detect_file_type("application/zip", b"PK\x03\x04") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_habitos.py -v -k detect_file_type`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.habitos_service'`

- [ ] **Step 3: Implement the service**

Create `backend/app/services/habitos_service.py`:

```python
import os
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.habit_infographic import HabitInfographic

DATA_DIR = os.environ.get("HABITOS_DATA_DIR", "/data/habitos")


def detect_file_type(content_type: str, file_bytes: bytes) -> tuple[str, str] | None:
    """Valida que el tipo MIME declarado y la firma de bytes coincidan.
    Retorna (file_type, extension) o None si no es un formato soportado."""
    if content_type == "application/pdf":
        return ("pdf", "pdf") if file_bytes.startswith(b"%PDF-") else None
    if content_type == "image/png":
        return ("image", "png") if file_bytes.startswith(b"\x89PNG\r\n\x1a\n") else None
    if content_type == "image/jpeg":
        return ("image", "jpg") if file_bytes.startswith(b"\xff\xd8\xff") else None
    if content_type == "image/webp":
        is_webp = file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP"
        return ("image", "webp") if is_webp else None
    return None


def save_infographic(
    db: Session,
    uploaded_by: int,
    file_bytes: bytes,
    file_type: str,
    ext: str,
    mime_type: str,
    title: str,
    category: str,
    description: str | None,
    original_name: str,
) -> HabitInfographic:
    os.makedirs(DATA_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(DATA_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    infographic = HabitInfographic(
        uploaded_by=uploaded_by,
        title=title,
        description=description,
        category=category,
        file_type=file_type,
        filename=filename,
        original_name=original_name,
        mime_type=mime_type,
        file_size_bytes=len(file_bytes),
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)
    return infographic


def list_infographics(db: Session, category: str | None = None) -> list[HabitInfographic]:
    query = db.query(HabitInfographic)
    if category:
        query = query.filter(HabitInfographic.category == category)
    return query.order_by(HabitInfographic.created_at.desc()).all()


def list_categorias(db: Session) -> list[str]:
    rows = (
        db.query(HabitInfographic.category)
        .distinct()
        .order_by(HabitInfographic.category)
        .all()
    )
    return [row[0] for row in rows]


def get_infographic(db: Session, infographic_id: int) -> HabitInfographic:
    infographic = db.query(HabitInfographic).filter(HabitInfographic.id == infographic_id).first()
    if not infographic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infografía no encontrada.",
        )
    return infographic


def delete_infographic(
    db: Session,
    current_user_id: int,
    is_admin: bool,
    infographic_id: int,
) -> None:
    infographic = db.query(HabitInfographic).filter(HabitInfographic.id == infographic_id).first()
    if not infographic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infografía no encontrada.",
        )
    if infographic.uploaded_by != current_user_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infografía no encontrada.",
        )

    file_path = os.path.join(DATA_DIR, infographic.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(infographic)
    db.commit()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_habitos.py -v`
Expected: PASS (7 tests total: table-exists + 6 detect_file_type tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/habitos_service.py backend/tests/test_habitos.py
git commit -m "feat: add habitos_service with file validation and storage"
```

---

## Task 3: Dependencia de rol + endpoint de subida

**Files:**
- Modify: `backend/app/core/dependencies.py`
- Create: `backend/app/schemas/habitos.py`
- Create: `backend/app/routers/habitos.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_habitos.py` (append)

**Interfaces:**
- Consumes: `habitos_service.detect_file_type`, `habitos_service.save_infographic`, `habitos_service.DATA_DIR` (Task 2); `HabitInfographic` (Task 1); `get_current_user` (existing, `app/core/dependencies.py`).
- Produces: `require_specialist_or_admin` dependency (used by Task 6); FastAPI router `habitos.router` mounted at `/api/v1/habitos` (extended by Tasks 4–6); `HabitInfographicOut` schema (reused by Tasks 4–5).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_habitos.py`:

```python
import io


def _login_habitos(client, email, role="specialist"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _me_habitos(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def test_upload_infographic_creates_record(client, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "spec_habito_upload@test.com")
    files = {"file": ("saludo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent"), "image/png")}
    data = {"title": "Cómo saludar", "category": "Saludar", "description": "Pasos simples"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Cómo saludar"
    assert body["category"] == "Saludar"
    assert body["file_type"] == "image"
    assert body["original_name"] == "saludo.png"


def test_upload_infographic_pdf_admin_allowed(client, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "admin_habito_upload@test.com", role="admin")
    files = {"file": ("guia.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}
    data = {"title": "Guía en PDF", "category": "Esperar turno"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["file_type"] == "pdf"


def test_upload_infographic_invalid_type_returns_422(client):
    token = _login_habitos(client, "spec_habito_badtype@test.com")
    files = {"file": ("archivo.zip", io.BytesIO(b"PK\x03\x04"), "application/zip")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_upload_infographic_bad_signature_returns_422(client):
    token = _login_habitos(client, "spec_habito_badsig@test.com")
    files = {"file": ("fake.png", io.BytesIO(b"this is not a real png"), "image/png")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_upload_infographic_too_large_returns_413(client, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "spec_habito_toolarge@test.com")
    large_bytes = b"\x89PNG\r\n\x1a\n" + b"X" * (10 * 1024 * 1024 + 1)
    files = {"file": ("big.png", io.BytesIO(large_bytes), "image/png")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 413


def test_upload_infographic_parent_role_returns_403(client):
    token = _login_habitos(client, "parent_habito_noupload@test.com", role="parent")
    files = {"file": ("saludo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent"), "image/png")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_habitos.py -v -k upload_infographic`
Expected: FAIL with 404 (route `/api/v1/habitos/upload` doesn't exist yet)

- [ ] **Step 3: Add `require_specialist_or_admin` to dependencies**

Modify `backend/app/core/dependencies.py` — current end of file:

```python
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para administradores.",
        )
    return current_user
```

Append after it:

```python


def require_specialist_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.specialist, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para especialistas o administradores.",
        )
    return current_user
```

- [ ] **Step 4: Create the schema**

Create `backend/app/schemas/habitos.py`:

```python
from datetime import datetime
from pydantic import BaseModel


class HabitInfographicOut(BaseModel):
    id: int
    title: str
    description: str | None
    category: str
    file_type: str
    original_name: str
    file_size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Create the router with the upload endpoint**

Create `backend/app/routers/habitos.py`:

```python
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_specialist_or_admin
from app.database import get_db
from app.models.user import User
from app.schemas.habitos import HabitInfographicOut
from app.services import habitos_service

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter()


@router.post("/upload", response_model=HabitInfographicOut, status_code=201)
def upload_infographic(
    file: UploadFile = File(...),
    title: str = Form(..., min_length=1, max_length=120),
    category: str = Form(..., min_length=1, max_length=60),
    description: str | None = Form(None, max_length=500),
    current_user: User = Depends(require_specialist_or_admin),
    db: Session = Depends(get_db),
):
    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="El archivo excede el tamaño máximo de 10 MB.",
        )
    detected = habitos_service.detect_file_type(file.content_type, file_bytes)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo debe ser una imagen (PNG, JPG, WebP) o un PDF válido.",
        )
    file_type, ext = detected
    return habitos_service.save_infographic(
        db=db,
        uploaded_by=current_user.id,
        file_bytes=file_bytes,
        file_type=file_type,
        ext=ext,
        mime_type=file.content_type,
        title=title,
        category=category,
        description=description,
        original_name=file.filename,
    )
```

- [ ] **Step 6: Register the router and model import in `main.py`**

Modify `backend/app/main.py` — current line 4:

```python
from app.routers import auth, emotions, scenarios, chat, calm, panel, biblioteca, profiles, assignments, lumi_chat, admin as admin_router
```

Replace with:

```python
from app.routers import auth, emotions, scenarios, chat, calm, panel, biblioteca, profiles, assignments, lumi_chat, admin as admin_router, habitos
```

Current line 21 (last model import):

```python
import app.models.password_reset_token
```

Add right after it:

```python
import app.models.habit_infographic
```

Current line 48 (last router registration):

```python
app.include_router(admin_router.router, prefix="/api/v1/admin", tags=["administración"])
```

Add right after it:

```python
app.include_router(habitos.router, prefix="/api/v1/habitos", tags=["habitos"])
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `python -m pytest tests/test_habitos.py -v`
Expected: PASS (all tests so far)

- [ ] **Step 8: Commit**

```bash
git add backend/app/core/dependencies.py backend/app/schemas/habitos.py backend/app/routers/habitos.py backend/app/main.py backend/tests/test_habitos.py
git commit -m "feat: add habitos upload endpoint with specialist/admin access"
```

---

## Task 4: Endpoints de listado y categorías

**Files:**
- Modify: `backend/app/routers/habitos.py`
- Test: `backend/tests/test_habitos.py` (append)

**Interfaces:**
- Consumes: `habitos_service.list_infographics`, `habitos_service.list_categorias` (Task 2).
- Produces: `GET /api/v1/habitos` and `GET /api/v1/habitos/categorias`, used by the frontend gallery (Task 11).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_habitos.py`:

```python
def test_list_infographics_returns_all(client, db):
    spec_token = _login_habitos(client, "spec_habito_list@test.com")
    parent_token = _login_habitos(client, "parent_habito_list@test.com", role="parent")
    spec_id = _me_habitos(client, spec_token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    for i, cat in enumerate(["Saludar", "Esperar turno"]):
        db.add(HabitInfographic(
            uploaded_by=spec_id,
            title=f"Infografía {i}",
            description=None,
            category=cat,
            file_type="image",
            filename=f"f{i}.png",
            original_name=f"f{i}.png",
            mime_type="image/png",
            file_size_bytes=100,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    for token in [spec_token, parent_token]:
        response = client.get("/api/v1/habitos", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert len(response.json()) == 2


def test_list_infographics_filters_by_category(client, db):
    token = _login_habitos(client, "spec_habito_filter@test.com")
    spec_id = _me_habitos(client, token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    for i, cat in enumerate(["Saludar", "Esperar turno"]):
        db.add(HabitInfographic(
            uploaded_by=spec_id,
            title=f"Infografía {i}",
            description=None,
            category=cat,
            file_type="image",
            filename=f"f{i}.png",
            original_name=f"f{i}.png",
            mime_type="image/png",
            file_size_bytes=100,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    response = client.get(
        "/api/v1/habitos",
        params={"category": "Saludar"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["category"] == "Saludar"


def test_get_categorias_returns_distinct_sorted(client, db):
    token = _login_habitos(client, "spec_habito_cats@test.com")
    spec_id = _me_habitos(client, token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    for cat in ["Saludar", "Esperar turno", "Saludar"]:
        db.add(HabitInfographic(
            uploaded_by=spec_id,
            title="Infografía",
            description=None,
            category=cat,
            file_type="image",
            filename="f.png",
            original_name="f.png",
            mime_type="image/png",
            file_size_bytes=100,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    response = client.get("/api/v1/habitos/categorias", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == ["Esperar turno", "Saludar"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_habitos.py -v -k "list_infographics or categorias"`
Expected: FAIL with 404 (routes don't exist yet)

- [ ] **Step 3: Add the endpoints**

Modify `backend/app/routers/habitos.py` — append after the `upload_infographic` function:

```python


@router.get("", response_model=list[HabitInfographicOut])
def list_infographics(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return habitos_service.list_infographics(db, category=category)


@router.get("/categorias", response_model=list[str])
def list_categorias(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return habitos_service.list_categorias(db)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_habitos.py -v`
Expected: PASS (all tests so far)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/habitos.py backend/tests/test_habitos.py
git commit -m "feat: add habitos list and categorias endpoints"
```

---

## Task 5: Endpoint de servir archivo

**Files:**
- Modify: `backend/app/routers/habitos.py`
- Test: `backend/tests/test_habitos.py` (append)

**Interfaces:**
- Consumes: `habitos_service.get_infographic`, `habitos_service.DATA_DIR` (Task 2).
- Produces: `GET /api/v1/habitos/{id}/archivo`, consumed by the frontend as an authenticated blob fetch (Task 9/11).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_habitos.py`:

```python
def test_get_archivo_returns_file_with_correct_content_type(client, db, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "spec_habito_archivo@test.com")
    spec_id = _me_habitos(client, token)["id"]

    filename = "abc123.png"
    (tmp_path / filename).write_bytes(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent")

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    infographic = HabitInfographic(
        uploaded_by=spec_id,
        title="Test",
        description=None,
        category="Saludar",
        file_type="image",
        filename=filename,
        original_name="saludo.png",
        mime_type="image/png",
        file_size_bytes=20,
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)

    response = client.get(
        f"/api/v1/habitos/{infographic.id}/archivo",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_get_archivo_requires_auth(client, db, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "spec_habito_archivo_noauth@test.com")
    spec_id = _me_habitos(client, token)["id"]

    filename = "def456.png"
    (tmp_path / filename).write_bytes(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent")

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    infographic = HabitInfographic(
        uploaded_by=spec_id,
        title="Test",
        description=None,
        category="Saludar",
        file_type="image",
        filename=filename,
        original_name="saludo.png",
        mime_type="image/png",
        file_size_bytes=20,
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)

    response = client.get(f"/api/v1/habitos/{infographic.id}/archivo")
    assert response.status_code == 401


def test_get_archivo_unknown_id_returns_404(client):
    token = _login_habitos(client, "spec_habito_archivo_404@test.com")
    response = client.get("/api/v1/habitos/99999/archivo", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_habitos.py -v -k get_archivo`
Expected: FAIL with 404 (route doesn't exist as GET — note `test_get_archivo_requires_auth` may also fail differently; both should fail because the route isn't registered)

- [ ] **Step 3: Add the endpoint**

Modify `backend/app/routers/habitos.py` — add the import at the top:

```python
import os

from fastapi.responses import FileResponse
```

(add these two lines to the existing import block at the top of the file, alongside the other imports)

Append after `list_categorias`:

```python


@router.get("/{infographic_id}/archivo")
def get_infographic_file(
    infographic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    infographic = habitos_service.get_infographic(db, infographic_id)
    file_path = os.path.join(habitos_service.DATA_DIR, infographic.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")
    return FileResponse(file_path, media_type=infographic.mime_type)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_habitos.py -v`
Expected: PASS (all tests so far)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/habitos.py backend/tests/test_habitos.py
git commit -m "feat: add habitos file-serving endpoint"
```

---

## Task 6: Endpoint de eliminación

**Files:**
- Modify: `backend/app/routers/habitos.py`
- Test: `backend/tests/test_habitos.py` (append)

**Interfaces:**
- Consumes: `habitos_service.delete_infographic` (Task 2); `require_specialist_or_admin` (Task 3); `UserRole` (existing, `app.models.user`).
- Produces: `DELETE /api/v1/habitos/{id}`, consumed by the frontend management page (Task 10).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_habitos.py`:

```python
def test_delete_infographic_by_uploader_succeeds(client, db, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "spec_habito_del_owner@test.com")
    spec_id = _me_habitos(client, token)["id"]

    filename = "todelete.png"
    file_path = tmp_path / filename
    file_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent")

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    infographic = HabitInfographic(
        uploaded_by=spec_id,
        title="Test",
        description=None,
        category="Saludar",
        file_type="image",
        filename=filename,
        original_name="saludo.png",
        mime_type="image/png",
        file_size_bytes=20,
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)

    response = client.delete(
        f"/api/v1/habitos/{infographic.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204
    assert not file_path.exists()
    assert db.query(HabitInfographic).filter(HabitInfographic.id == infographic.id).first() is None


def test_delete_infographic_by_admin_succeeds(client, db, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    owner_token = _login_habitos(client, "spec_habito_del_owner2@test.com")
    admin_token = _login_habitos(client, "admin_habito_del@test.com", role="admin")
    owner_id = _me_habitos(client, owner_token)["id"]

    filename = "admindel.png"
    file_path = tmp_path / filename
    file_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent")

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    infographic = HabitInfographic(
        uploaded_by=owner_id,
        title="Test",
        description=None,
        category="Saludar",
        file_type="image",
        filename=filename,
        original_name="saludo.png",
        mime_type="image/png",
        file_size_bytes=20,
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)

    response = client.delete(
        f"/api/v1/habitos/{infographic.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 204


def test_delete_infographic_by_other_specialist_returns_404(client, db, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    owner_token = _login_habitos(client, "spec_habito_owner3@test.com")
    other_token = _login_habitos(client, "spec_habito_other3@test.com")
    owner_id = _me_habitos(client, owner_token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    infographic = HabitInfographic(
        uploaded_by=owner_id,
        title="Test",
        description=None,
        category="Saludar",
        file_type="image",
        filename="ownerfile.png",
        original_name="saludo.png",
        mime_type="image/png",
        file_size_bytes=20,
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)

    response = client.delete(
        f"/api/v1/habitos/{infographic.id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 404


def test_delete_infographic_parent_role_returns_403(client, db):
    parent_token = _login_habitos(client, "parent_habito_nodelete@test.com", role="parent")
    spec_token = _login_habitos(client, "spec_habito_fordelete@test.com")
    spec_id = _me_habitos(client, spec_token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    infographic = HabitInfographic(
        uploaded_by=spec_id,
        title="Test",
        description=None,
        category="Saludar",
        file_type="image",
        filename="somefile.png",
        original_name="saludo.png",
        mime_type="image/png",
        file_size_bytes=20,
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)

    response = client.delete(
        f"/api/v1/habitos/{infographic.id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_habitos.py -v -k delete_infographic`
Expected: FAIL with 405/404 (DELETE method not allowed / route doesn't exist)

- [ ] **Step 3: Add the endpoint**

Modify `backend/app/routers/habitos.py` — add `UserRole` to the imports:

```python
from app.models.user import User, UserRole
```

(replace the existing `from app.models.user import User` line with the line above)

Append after `get_infographic_file`:

```python


@router.delete("/{infographic_id}", status_code=204)
def delete_infographic(
    infographic_id: int,
    current_user: User = Depends(require_specialist_or_admin),
    db: Session = Depends(get_db),
):
    habitos_service.delete_infographic(
        db=db,
        current_user_id=current_user.id,
        is_admin=current_user.role == UserRole.admin,
        infographic_id=infographic_id,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_habitos.py -v`
Expected: PASS (all tests — full file)

- [ ] **Step 5: Run the entire backend test suite to check for regressions**

Run: `python -m pytest -v`
Expected: PASS (no existing test broken)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/habitos.py backend/tests/test_habitos.py
git commit -m "feat: add habitos delete endpoint"
```

---

## Task 7: Volumen persistente para archivos subidos

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`

**Interfaces:**
- No code interface — infrastructure change. Makes `/data` (used by both `biblioteca_service.DATA_DIR` and `habitos_service.DATA_DIR`) durable across container rebuilds.

- [ ] **Step 1: Modify `docker-compose.yml`**

Current `backend` service:

```yaml
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: socialmind_backend
    env_file:
      - .env
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - socialmind_net
    volumes:
      - ./backend:/app
    command: sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
```

Change the `volumes:` list to:

```yaml
    volumes:
      - ./backend:/app
      - uploads_data:/data
```

Current top-level `volumes:` section:

```yaml
volumes:
  postgres_data:
```

Change to:

```yaml
volumes:
  postgres_data:
  uploads_data:
```

- [ ] **Step 2: Modify `docker-compose.prod.yml`**

Current `backend` service:

```yaml
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    env_file: .env.prod
    depends_on:
      db:
        condition: service_healthy
    networks:
      - socialmind_net
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 40s
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"
```

Add a `volumes:` key (this service doesn't have one yet) right after `env_file: .env.prod`:

```yaml
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    env_file: .env.prod
    volumes:
      - uploads_data:/data
    depends_on:
      db:
        condition: service_healthy
    networks:
      - socialmind_net
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 40s
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"
```

Current top-level `volumes:` section:

```yaml
volumes:
  postgres_data:
```

Change to:

```yaml
volumes:
  postgres_data:
  uploads_data:
```

- [ ] **Step 3: Verify both files parse correctly**

Run: `docker compose -f docker-compose.yml config --quiet` (from the project root)
Expected: no output, exit code 0 (empty output means valid YAML + valid Compose schema)

Run: `docker compose -f docker-compose.prod.yml config --quiet`
Expected: no output, exit code 0

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.prod.yml
git commit -m "fix: persist uploaded files (biblioteca + habitos) with a named volume"
```

**Nota para el despliegue:** este cambio requiere `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build` en el VPS después del `git pull`, igual que los despliegues recientes de esta semana.

---

## Task 8: `habitosApi` en el cliente frontend

**Files:**
- Modify: `frontend/src/services/api.js`

**Interfaces:**
- Produces: `habitosApi` object with `upload`, `list`, `categorias`, `getArchivo`, `delete` — consumed by Tasks 10 and 11.

- [ ] **Step 1: Add `habitosApi`**

Modify `frontend/src/services/api.js` — find the `bibliotecaApi` block:

```js
export const bibliotecaApi = {
  upload: (formData) =>
    api.post('/biblioteca/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list:     ()         => api.get('/biblioteca/documents'),
  delete:   (docId)    => api.delete(`/biblioteca/documents/${docId}`),
  ask:      (question) => api.post('/biblioteca/ask', { question }),
}
```

Add right after it:

```js

export const habitosApi = {
  upload: (formData) =>
    api.post('/habitos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list:        (category) => api.get('/habitos', { params: category ? { category } : {} }),
  categorias:  ()          => api.get('/habitos/categorias'),
  getArchivo:  (id)        => api.get(`/habitos/${id}/archivo`, { responseType: 'blob' }),
  delete:      (id)        => api.delete(`/habitos/${id}`),
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run (from `frontend/`): `npm run build`
Expected: build succeeds (exit code 0). If other unrelated build errors already existed before this change, confirm they're pre-existing by checking `git stash` + rebuild; otherwise this step should be a clean pass since `api.js` only gained a new export.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "feat: add habitosApi client"
```

---

## Task 9: Componente compartido `InfographicThumbnail`

**Files:**
- Create: `frontend/src/components/habitos/InfographicThumbnail.jsx`

**Interfaces:**
- Consumes: `habitosApi.getArchivo` (Task 8).
- Produces: `InfographicThumbnail({ infographic, className })` React component — `infographic` must have `{ id, file_type, title }`. Consumed by Tasks 10 and 11.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/habitos/InfographicThumbnail.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { habitosApi } from '../../services/api'

export function InfographicThumbnail({ infographic, className = '' }) {
  const [imgUrl, setImgUrl] = useState(null)

  useEffect(() => {
    if (infographic.file_type !== 'image') return undefined

    let objectUrl = null
    let cancelled = false

    habitosApi.getArchivo(infographic.id)
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data)
        setImgUrl(objectUrl)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [infographic.id, infographic.file_type])

  if (infographic.file_type !== 'image') {
    return (
      <div className={`flex items-center justify-center bg-calm-bg text-4xl ${className}`} aria-hidden="true">
        📄
      </div>
    )
  }

  if (!imgUrl) {
    return <div className={`bg-calm-bg animate-pulse ${className}`} />
  }

  return (
    <img
      src={imgUrl}
      alt={infographic.title}
      className={`object-cover ${className}`}
    />
  )
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run (from `frontend/`): `npm run build`
Expected: build succeeds (this component isn't imported anywhere yet, but the build should still parse it without error since it's a valid module)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/habitos/InfographicThumbnail.jsx
git commit -m "feat: add InfographicThumbnail component"
```

---

## Task 10: Página `GestionHabitos.jsx` (specialist/admin)

**Files:**
- Create: `frontend/src/pages/GestionHabitos.jsx`

**Interfaces:**
- Consumes: `habitosApi` (Task 8), `InfographicThumbnail` (Task 9), `PageWrapper` (existing, `frontend/src/components/layout/PageWrapper.jsx`).
- Produces: `GestionHabitos` component, routed at `/habitos/gestionar` in Task 12.

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/GestionHabitos.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { habitosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { InfographicThumbnail } from '../components/habitos/InfographicThumbnail'

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export function GestionHabitos() {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [infografias, setInfografias] = useState([])
  const [categorias, setCategorias]   = useState([])
  const [file, setFile]               = useState(null)
  const [title, setTitle]             = useState('')
  const [category, setCategory]       = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmId, setConfirmId]     = useState(null)

  async function loadAll() {
    try {
      const [listRes, catsRes] = await Promise.all([habitosApi.list(), habitosApi.categorias()])
      setInfografias(listRes.data)
      setCategorias(catsRes.data)
    } catch {
      // silent — lista vacía si falla
    }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    setUploadError('')
    if (!selected) { setFile(null); return }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setUploadError('El archivo debe ser una imagen (PNG, JPG, WebP) o un PDF.')
      e.target.value = ''
      setFile(null)
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setUploadError('El archivo es demasiado grande (máximo 10 MB).')
      e.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setUploadError('')
    const finalCategory = category === '__nueva__' ? customCategory.trim() : category
    if (!file || !title.trim() || !finalCategory) {
      setUploadError('Completa el archivo, título y categoría.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title.trim())
    formData.append('category', finalCategory)
    if (description.trim()) formData.append('description', description.trim())

    try {
      await habitosApi.upload(formData)
      setFile(null)
      setTitle('')
      setCategory('')
      setCustomCategory('')
      setDescription('')
      const input = document.getElementById('habito-file-input')
      if (input) input.value = ''
      await loadAll()
    } catch {
      setUploadError('No se pudo subir la infografía. Intenta de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id) {
    try {
      await habitosApi.delete(id)
      setConfirmId(null)
      await loadAll()
    } catch {
      // silent
    }
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-extrabold text-primary-700">Gestionar Aprendo Hábitos</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-calm-surface border-2 border-calm-border rounded-3xl p-5 flex flex-col gap-3">
          <p className="text-base font-bold text-text-primary">Subir infografía</p>

          <input
            id="habito-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,.pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-base text-text-primary"
          />

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            disabled={uploading}
            className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2 min-h-[44px]"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={uploading}
            className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2 min-h-[44px]"
          >
            <option value="">Selecciona una categoría</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__nueva__">Otra...</option>
          </select>

          {category === '__nueva__' && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Nombre de la nueva categoría"
              disabled={uploading}
              className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2 min-h-[44px]"
            />
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            disabled={uploading}
            className="text-base text-text-primary border-2 border-calm-border rounded-xl px-3 py-2"
          />

          <button
            type="submit"
            disabled={uploading}
            className="text-base font-bold text-white bg-primary-500 rounded-full px-6 py-3 min-h-[44px] disabled:opacity-50"
          >
            {uploading ? 'Subiendo...' : 'Subir infografía'}
          </button>

          {uploadError && (
            <p className="text-base text-red-600">{uploadError}</p>
          )}
        </form>

        {infografias.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-4">
            Aún no hay infografías.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {infografias.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, delay: shouldReduceMotion ? 0 : i * 0.05 }}
                className="bg-calm-surface border-2 border-calm-border rounded-2xl p-4 flex gap-3"
              >
                <InfographicThumbnail infographic={item} className="w-16 h-16 rounded-xl shrink-0" />
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <p className="text-base font-bold text-text-primary truncate">{item.title}</p>
                  <p className="text-base text-text-secondary">
                    {item.category} · {formatSize(item.file_size_bytes)}
                  </p>
                  <p className="text-base text-text-secondary">
                    {new Date(item.created_at).toLocaleDateString('es-AR')}
                  </p>

                  {confirmId === item.id ? (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-base text-text-secondary">¿Eliminar esta infografía?</p>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-base font-bold text-red-600 min-h-[44px] px-3"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-base text-text-secondary min-h-[44px] px-3"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(item.id)}
                      className="text-base text-red-500 font-semibold min-h-[44px] text-left"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run (from `frontend/`): `npm run build`
Expected: build succeeds (page isn't routed yet, but must parse cleanly)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/GestionHabitos.jsx
git commit -m "feat: add GestionHabitos page for specialist/admin upload"
```

---

## Task 11: Página `AprendoHabitos.jsx` (galería para niño/padre)

**Files:**
- Create: `frontend/src/pages/AprendoHabitos.jsx`

**Interfaces:**
- Consumes: `habitosApi` (Task 8), `InfographicThumbnail` (Task 9), `PageWrapper` (existing).
- Produces: `AprendoHabitos` component, routed at `/habitos` in Task 12.

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/AprendoHabitos.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { habitosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { InfographicThumbnail } from '../components/habitos/InfographicThumbnail'

export function AprendoHabitos() {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [categorias, setCategorias]       = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('')
  const [infografias, setInfografias]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [modalItem, setModalItem]         = useState(null)
  const [modalUrl, setModalUrl]           = useState(null)

  useEffect(() => {
    habitosApi.categorias()
      .then((res) => setCategorias(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    habitosApi.list(categoriaActiva || undefined)
      .then((res) => setInfografias(res.data))
      .catch(() => setInfografias([]))
      .finally(() => setLoading(false))
  }, [categoriaActiva])

  async function handleOpen(item) {
    const res = await habitosApi.getArchivo(item.id)
    const url = URL.createObjectURL(res.data)
    if (item.file_type === 'pdf') {
      window.open(url, '_blank')
      return
    }
    setModalUrl(url)
    setModalItem(item)
  }

  function closeModal() {
    if (modalUrl) URL.revokeObjectURL(modalUrl)
    setModalUrl(null)
    setModalItem(null)
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-6">

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">Aprendo Hábitos</h1>
            <p className="text-base text-text-secondary">Infografías para practicar buenos hábitos</p>
          </div>
        </div>

        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoriaActiva('')}
              className={`text-base font-semibold px-4 py-2 rounded-full min-h-[44px] transition-colors ${
                categoriaActiva === ''
                  ? 'bg-primary-500 text-white'
                  : 'bg-calm-surface text-text-secondary border-2 border-calm-border'
              }`}
            >
              Todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`text-base font-semibold px-4 py-2 rounded-full min-h-[44px] transition-colors ${
                  categoriaActiva === cat
                    ? 'bg-primary-500 text-white'
                    : 'bg-calm-surface text-text-secondary border-2 border-calm-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-text-muted text-base text-center py-8">Cargando...</p>
        ) : infografias.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-4">
            Aún no hay infografías disponibles.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {infografias.map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, delay: shouldReduceMotion ? 0 : i * 0.05 }}
                onClick={() => handleOpen(item)}
                className="flex flex-col rounded-3xl overflow-hidden bg-calm-surface border-2 border-calm-border hover:border-primary-500 transition-colors text-left min-h-[44px]"
                aria-label={`Ver infografía: ${item.title}`}
              >
                <InfographicThumbnail infographic={item} className="w-full h-32" />
                <div className="p-3">
                  <p className="font-bold text-text-primary text-base truncate">{item.title}</p>
                  <p className="text-base text-text-secondary truncate">{item.category}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

      </div>

      {modalItem && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
          onClick={closeModal}
        >
          <div className="max-w-lg w-full flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <img src={modalUrl} alt={modalItem.title} className="w-full rounded-2xl" />
            <button
              onClick={closeModal}
              className="self-center text-base font-bold text-white bg-primary-600 rounded-full px-6 py-3 min-h-[44px]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run (from `frontend/`): `npm run build`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AprendoHabitos.jsx
git commit -m "feat: add AprendoHabitos gallery page"
```

---

## Task 12: Wiring de rutas

**Files:**
- Modify: `frontend/src/router/index.jsx`

**Interfaces:**
- Consumes: `GestionHabitos` (Task 10), `AprendoHabitos` (Task 11).
- Produces: routes `/habitos` (any authenticated role) and `/habitos/gestionar` (specialist/admin only), plus a new `SpecialistOrAdminRoute` guard reusable by future specialist/admin-only pages.

- [ ] **Step 1: Add the imports**

Modify `frontend/src/router/index.jsx` — find this import line:

```jsx
import { AdminPage } from '../pages/AdminPage'
```

Add right after it:

```jsx
import { AprendoHabitos } from '../pages/AprendoHabitos'
import { GestionHabitos } from '../pages/GestionHabitos'
```

- [ ] **Step 2: Add the `SpecialistOrAdminRoute` guard**

Find the `AdminRoute` function:

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

Add right after it:

```jsx

function SpecialistOrAdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'specialist' && user.role !== 'admin') return <Navigate to="/inicio" replace />
  return children
}
```

- [ ] **Step 3: Add the routes**

Find this block near the end of the router array:

```jsx
  {
    path: '/lumi-chat',
    element: <ProtectedRoute><LumiChatAdultosPage /></ProtectedRoute>,
  },
])
```

Replace with:

```jsx
  {
    path: '/lumi-chat',
    element: <ProtectedRoute><LumiChatAdultosPage /></ProtectedRoute>,
  },
  {
    path: '/habitos',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><AprendoHabitos /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/habitos/gestionar',
    element: <SpecialistOrAdminRoute><GestionHabitos /></SpecialistOrAdminRoute>,
  },
])
```

- [ ] **Step 4: Verify the app builds and routes resolve**

Run (from `frontend/`): `npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router/index.jsx
git commit -m "feat: wire habitos routes with SpecialistOrAdminRoute guard"
```

---

## Task 13: Tarjetas en el Dashboard

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: routes `/habitos` and `/habitos/gestionar` (Task 12).
- Produces: visible entry points for all roles.

- [ ] **Step 1: Add the card to `MODULE_CARDS`**

Modify `frontend/src/pages/Dashboard.jsx` — find `MODULE_CARDS`'s last entry:

```jsx
  {
    emoji: '🦉',
    title: 'Chat adultos con Lumi',
    desc: 'Consultas sobre el espectro autista',
    available: true,
    path: '/lumi-chat',
  },
]
```

Replace with:

```jsx
  {
    emoji: '🦉',
    title: 'Chat adultos con Lumi',
    desc: 'Consultas sobre el espectro autista',
    available: true,
    path: '/lumi-chat',
  },
  {
    emoji: '🌱',
    title: 'Aprendo Hábitos',
    desc: 'Infografías para practicar buenos hábitos',
    available: true,
    path: '/habitos',
  },
]
```

- [ ] **Step 2: Add the management card to `SPECIALIST_CARDS`**

Find `SPECIALIST_CARDS`'s last entry:

```jsx
  {
    emoji: '🦉',
    title: 'Chat con Lumi',
    desc: 'Consultas sobre el espectro autista',
    available: true,
    path: '/lumi-chat',
  },
]
```

Replace with:

```jsx
  {
    emoji: '🦉',
    title: 'Chat con Lumi',
    desc: 'Consultas sobre el espectro autista',
    available: true,
    path: '/lumi-chat',
  },
  {
    emoji: '🖼️',
    title: 'Gestionar Aprendo Hábitos',
    desc: 'Subir y administrar infografías',
    available: true,
    path: '/habitos/gestionar',
  },
]
```

- [ ] **Step 3: Add the management card to `ADMIN_CARDS`**

Find `ADMIN_CARDS`:

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

Replace with:

```jsx
const ADMIN_CARDS = [
  {
    emoji: '⚙️',
    title: 'Panel de administración',
    desc: 'Gestionar usuarios de la plataforma',
    available: true,
    path: '/admin',
  },
  {
    emoji: '🖼️',
    title: 'Gestionar Aprendo Hábitos',
    desc: 'Subir y administrar infografías',
    available: true,
    path: '/habitos/gestionar',
  },
]
```

- [ ] **Step 4: Verify the app builds**

Run (from `frontend/`): `npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: add Aprendo Habitos cards to Dashboard"
```

---

## Task 14: Verificación manual en navegador

**Files:** none (verification only, per spec's testing section — jsdom doesn't reproduce real file upload/blob rendering, so this is checked live)

**Interfaces:**
- Consumes: the entire feature (Tasks 1–13) running via `docker compose up` locally.

- [ ] **Step 1: Start the local stack**

Run (from project root): `docker compose up -d --build`
Expected: `db`, `backend`, `frontend` containers healthy/running

- [ ] **Step 2: Log in as a specialist and upload an infographic**

Navigate to `http://localhost:3000`, register or log in as a `specialist` user, go to Dashboard → "Gestionar Aprendo Hábitos" (`/habitos/gestionar`).
- Upload a PNG or JPG with a title and a new category (e.g. "Saludar") via the "Otra..." option
- Confirm it appears in the list below with correct title, category, size, and a visible thumbnail
- Upload a small PDF with a different category
- Confirm both appear; the PDF shows the 📄 placeholder icon (not a broken image)

- [ ] **Step 3: Verify validation errors show correctly**

- Try uploading a `.txt` file → confirm the client-side error `"El archivo debe ser una imagen (PNG, JPG, WebP) o un PDF."` appears and no request succeeds
- Try uploading with an empty title → confirm `"Completa el archivo, título y categoría."` appears

- [ ] **Step 4: Verify deletion**

- Click "Eliminar" on one uploaded infographic → confirm the inline "¿Eliminar esta infografía?" prompt appears
- Confirm deletion → confirm the item disappears from the list

- [ ] **Step 5: Log in as parent/child and browse the gallery**

Log in as a `parent` user (complete child onboarding if prompted), go to Dashboard → "Aprendo Hábitos" (`/habitos`).
- Confirm the category pills appear (including "Todas")
- Click a category pill → confirm the grid filters to only that category's infographics
- Click an image infographic → confirm a full-screen modal opens showing the image; click "Cerrar" → confirm it closes
- Click the PDF infographic → confirm it opens in a new browser tab showing the PDF (not a broken/blank tab)

- [ ] **Step 6: Verify access control**

- While logged in as `parent`, manually navigate to `http://localhost:3000/habitos/gestionar` → confirm it redirects to `/inicio` (parents can't manage uploads)
- Log out (clear `localStorage` or use an incognito window) and navigate to `http://localhost:3000/habitos` → confirm it redirects to `/login`

- [ ] **Step 7: Confirm no console errors**

Open browser DevTools console during steps 2–6 → confirm no uncaught errors (network 401/403/422/413 responses triggering the app's own error messages are expected and fine; uncaught JS exceptions are not)

No commit for this task — it's a verification checkpoint. If any step fails, fix the relevant task's code and re-run the failed step before considering the feature complete.
