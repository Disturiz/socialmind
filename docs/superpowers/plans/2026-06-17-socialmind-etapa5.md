# SocialMind Etapa 5 — Panel Profesional: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el Panel Profesional: lista de niños + detalle por niño (emociones, calma, chats) + nota del especialista, accesible solo con rol `specialist`.

**Architecture:** Backend con nuevo router `/api/v1/panel` protegido por `require_specialist`; modelo `SpecialistNote` con upsert por `(specialist_id, child_profile_id)`; frontend con dos páginas nuevas en navegación de dos niveles (`/panel` → `/panel/ninos/:childId`); tarjeta en Dashboard visible solo para especialistas.

**Tech Stack:** Python 3.12 · FastAPI · SQLAlchemy · Alembic · pytest · React 18 · Vitest · Testing Library · Framer Motion · Tailwind CSS · React Router

## Global Constraints

- Todo texto visible: mínimo `text-base` (nunca `text-sm` ni menor)
- Elementos interactivos: `min-h-[44px]`
- Tailwind: solo clases estáticas — nunca concatenación dinámica como `'bg-' + var`; ternarios con strings literales son seguros
- Idioma: solo español latinoamericano en toda la UI
- Sin lenguaje clínico, médico ni diagnóstico en ninguna etiqueta visible al usuario
- API keys: siempre en `.env`, nunca en código ni frontend

---

## Mapa de archivos

**Crear:**
- `backend/app/models/specialist_note.py`
- `backend/alembic/versions/<hash>_add_specialist_notes.py`
- `backend/app/schemas/panel.py`
- `backend/app/services/panel_service.py`
- `backend/app/routers/panel.py`
- `backend/tests/test_panel.py`
- `frontend/src/pages/PanelProfesional.jsx`
- `frontend/src/pages/ChildDetail.jsx`
- `frontend/src/test/PanelProfesional.test.jsx`
- `frontend/src/test/ChildDetail.test.jsx`

**Modificar:**
- `backend/app/core/dependencies.py` — agregar `require_specialist`
- `backend/app/models/__init__.py` — exportar `SpecialistNote`
- `backend/app/main.py` — registrar router panel
- `frontend/src/services/api.js` — agregar `panelApi`
- `frontend/src/router/index.jsx` — rutas `/panel` y `/panel/ninos/:childId`
- `frontend/src/pages/Dashboard.jsx` — tarjeta Panel Profesional condicional

---

## Task 1: Backend — modelo, migración, schemas, servicio, router, tests

**Files:**
- Create: `backend/app/models/specialist_note.py`
- Create: `backend/alembic/versions/<hash>_add_specialist_notes.py`
- Create: `backend/app/schemas/panel.py`
- Create: `backend/app/services/panel_service.py`
- Create: `backend/app/routers/panel.py`
- Create: `backend/tests/test_panel.py`
- Modify: `backend/app/core/dependencies.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces:
  - `GET /api/v1/panel/children` → `list[ChildSummaryOut]`
  - `GET /api/v1/panel/children/{child_id}` → `ChildDetailOut`
  - `PUT /api/v1/panel/children/{child_id}/note` → `NoteOut`
  - Todos requieren JWT con `role == specialist`; si no: 403

- [ ] **Step 1: Crear modelo SpecialistNote**

Crear `backend/app/models/specialist_note.py`:

```python
from datetime import datetime
from sqlalchemy import Integer, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SpecialistNote(Base):
    __tablename__ = "specialist_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specialist_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    child_profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("child_profiles.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (
        UniqueConstraint("specialist_id", "child_profile_id", name="uq_note_specialist_child"),
    )
```

- [ ] **Step 2: Registrar modelo en `__init__.py`**

Editar `backend/app/models/__init__.py`:

```python
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.scenario_completion import ScenarioCompletion
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.calm_session import CalmSession
from app.models.specialist_note import SpecialistNote

__all__ = [
    "User", "UserRole", "ChildProfile",
    "EmotionLog", "ScenarioCompletion",
    "ChatConversation", "ChatMessage",
    "CalmSession", "SpecialistNote",
]
```

- [ ] **Step 3: Generar y revisar migración Alembic**

```bash
cd backend
alembic revision --autogenerate -m "add_specialist_notes"
```

Revisar el archivo generado en `backend/alembic/versions/`. Debe contener:

```python
def upgrade() -> None:
    op.create_table('specialist_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('specialist_id', sa.Integer(), nullable=False),
        sa.Column('child_profile_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['child_profile_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['specialist_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('specialist_id', 'child_profile_id', name='uq_note_specialist_child'),
    )
    op.create_index(op.f('ix_specialist_notes_id'), 'specialist_notes', ['id'], unique=False)
```

Aplicar la migración (solo en entorno local/dev, no en tests — tests usan StaticPool):

```bash
alembic upgrade head
```

- [ ] **Step 4: Escribir tests que fallan**

Crear `backend/tests/test_panel.py`:

```python
import pytest
from fastapi.testclient import TestClient
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.calm_session import CalmSession
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage


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


def test_list_children_returns_child_profiles(client, db):
    spec_token = _login(client, "spec1@test.com", "specialist")
    parent_token = _login(client, "parent1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    _make_child(db, parent_id, name="Juan", age=10)

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


def test_list_children_parent_role_returns_403(client):
    parent_token = _login(client, "parent2@test.com", "parent")
    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert response.status_code == 403


def test_list_children_unauthenticated_returns_401(client):
    response = client.get("/api/v1/panel/children")
    assert response.status_code == 401


def test_get_child_detail_returns_emotions_calm_chats(client, db):
    from datetime import datetime, timezone
    spec_token = _login(client, "spec2@test.com", "specialist")
    parent_token = _login(client, "parent3@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Ana", age=12)
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


def test_get_child_detail_other_specialist_sees_same_child(client, db):
    spec1_token = _login(client, "spec3@test.com", "specialist")
    spec2_token = _login(client, "spec4@test.com", "specialist")
    parent_token = _login(client, "parent4@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Pedro", age=9)

    r1 = client.get(f"/api/v1/panel/children/{child.id}",
                    headers={"Authorization": f"Bearer {spec1_token}"})
    r2 = client.get(f"/api/v1/panel/children/{child.id}",
                    headers={"Authorization": f"Bearer {spec2_token}"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["name"] == r2.json()["name"] == "Pedro"


def test_get_child_detail_nonexistent_returns_404(client):
    spec_token = _login(client, "spec5@test.com", "specialist")
    response = client.get(
        "/api/v1/panel/children/9999",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 404


def test_save_note_creates_note(client, db):
    spec_token = _login(client, "spec6@test.com", "specialist")
    parent_token = _login(client, "parent5@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    response = client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Juan muestra progreso excelente."},
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Juan muestra progreso excelente."
    assert "updated_at" in data


def test_save_note_updates_existing_note(client, db):
    spec_token = _login(client, "spec7@test.com", "specialist")
    parent_token = _login(client, "parent6@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Nota inicial."},
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    response = client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Nota actualizada."},
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "Nota actualizada."

    # Solo una nota en DB (upsert)
    from app.models.specialist_note import SpecialistNote
    count = db.query(SpecialistNote).count()
    assert count == 1


def test_save_note_parent_role_returns_403(client, db):
    parent_token = _login(client, "parent7@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    response = client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Intento no autorizado."},
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 5: Correr tests — deben fallar**

```bash
cd backend
python -m pytest tests/test_panel.py -v
```

Esperado: FAILED — `ImportError` o `404 Not Found` porque el router no existe aún.

- [ ] **Step 6: Agregar `require_specialist` a `dependencies.py`**

Editar `backend/app/core/dependencies.py` — agregar al final del archivo:

```python
from app.models.user import UserRole  # agregar al bloque de imports existente


def require_specialist(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.specialist:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para especialistas.",
        )
    return current_user
```

El archivo completo quedará:

```python
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
```

- [ ] **Step 7: Crear schemas `backend/app/schemas/panel.py`**

```python
from datetime import datetime
from pydantic import BaseModel, field_validator


class ChildSummaryOut(BaseModel):
    child_profile_id: int
    name: str
    age: int
    avatar_emoji: str
    last_emotion_key: str | None
    total_calm_sessions: int
    total_chats: int


class EmotionEntryOut(BaseModel):
    emotion_key: str
    logged_at: datetime


class CalmEntryOut(BaseModel):
    activity_type: str
    duration_seconds: int
    emotion_key: str
    created_at: datetime


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: datetime


class ConversationOut(BaseModel):
    conversation_id: int
    emotion_key: str
    started_at: datetime
    ended_at: datetime | None
    message_count: int
    messages: list[MessageOut]


class ChildDetailOut(BaseModel):
    child_profile_id: int
    name: str
    age: int
    avatar_emoji: str
    emotions: list[EmotionEntryOut]
    calm_sessions: list[CalmEntryOut]
    conversations: list[ConversationOut]
    specialist_note: str | None


class NoteRequest(BaseModel):
    content: str

    @field_validator('content')
    @classmethod
    def content_valid(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('content cannot be empty')
        if len(v) > 2000:
            raise ValueError('content must be at most 2000 characters')
        return v


class NoteOut(BaseModel):
    content: str
    updated_at: datetime
```

- [ ] **Step 8: Crear servicio `backend/app/services/panel_service.py`**

```python
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.calm_session import CalmSession
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.specialist_note import SpecialistNote


def list_children(db: Session) -> list[dict]:
    profiles = db.query(ChildProfile).order_by(ChildProfile.name).all()
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
        result.append({
            "child_profile_id": profile.id,
            "name": profile.name,
            "age": profile.age,
            "avatar_emoji": profile.avatar_emoji,
            "last_emotion_key": last_emotion.emotion_key if last_emotion else None,
            "total_calm_sessions": total_calm,
            "total_chats": total_chats,
        })
    return result


def get_child_detail(db: Session, child_id: int, specialist_id: int) -> dict:
    profile = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Niño no encontrado.")

    pid = profile.parent_id

    emotions = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == pid)
        .order_by(EmotionLog.logged_at.desc())
        .limit(30)
        .all()
    )
    calm_sessions = (
        db.query(CalmSession)
        .filter(CalmSession.user_id == pid)
        .order_by(CalmSession.created_at.desc())
        .limit(30)
        .all()
    )
    conversations = (
        db.query(ChatConversation)
        .filter(ChatConversation.user_id == pid)
        .order_by(ChatConversation.started_at.desc())
        .limit(10)
        .all()
    )

    conv_details = []
    for conv in conversations:
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conv.id)
            .order_by(ChatMessage.created_at)
            .all()
        )
        conv_details.append({
            "conversation_id": conv.id,
            "emotion_key": conv.emotion_key,
            "started_at": conv.started_at,
            "ended_at": conv.ended_at,
            "message_count": len(messages),
            "messages": [
                {"role": m.role, "content": m.content, "created_at": m.created_at}
                for m in messages
            ],
        })

    note = (
        db.query(SpecialistNote)
        .filter(
            SpecialistNote.specialist_id == specialist_id,
            SpecialistNote.child_profile_id == child_id,
        )
        .first()
    )

    return {
        "child_profile_id": profile.id,
        "name": profile.name,
        "age": profile.age,
        "avatar_emoji": profile.avatar_emoji,
        "emotions": [
            {"emotion_key": e.emotion_key, "logged_at": e.logged_at}
            for e in emotions
        ],
        "calm_sessions": [
            {
                "activity_type": s.activity_type,
                "duration_seconds": s.duration_seconds,
                "emotion_key": s.emotion_key,
                "created_at": s.created_at,
            }
            for s in calm_sessions
        ],
        "conversations": conv_details,
        "specialist_note": note.content if note else None,
    }


def save_note(db: Session, specialist_id: int, child_id: int, content: str) -> dict:
    profile = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Niño no encontrado.")

    note = (
        db.query(SpecialistNote)
        .filter(
            SpecialistNote.specialist_id == specialist_id,
            SpecialistNote.child_profile_id == child_id,
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if note:
        note.content = content
        note.updated_at = now
    else:
        note = SpecialistNote(
            specialist_id=specialist_id,
            child_profile_id=child_id,
            content=content,
            updated_at=now,
        )
        db.add(note)

    db.commit()
    db.refresh(note)
    return {"content": note.content, "updated_at": note.updated_at}
```

- [ ] **Step 9: Crear router `backend/app/routers/panel.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_specialist
from app.models.user import User
from app.schemas.panel import ChildSummaryOut, ChildDetailOut, NoteRequest, NoteOut
from app.services import panel_service

router = APIRouter()


@router.get("/children", response_model=list[ChildSummaryOut])
def list_children(
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return panel_service.list_children(db)


@router.get("/children/{child_id}", response_model=ChildDetailOut)
def get_child_detail(
    child_id: int,
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return panel_service.get_child_detail(db, child_id, current_user.id)


@router.put("/children/{child_id}/note", response_model=NoteOut)
def save_note(
    child_id: int,
    data: NoteRequest,
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    return panel_service.save_note(db, current_user.id, child_id, data.content)
```

- [ ] **Step 10: Registrar router en `backend/app/main.py`**

Editar `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios, chat, calm, panel
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message
import app.models.calm_session
import app.models.specialist_note

app = FastAPI(
    title="SocialMind API",
    description="Plataforma de apoyo social para personas en el espectro autista",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["autenticación"])
app.include_router(emotions.router,  prefix="/api/v1/emotions",  tags=["emociones"])
app.include_router(scenarios.router, prefix="/api/v1/scenarios", tags=["escenarios"])
app.include_router(chat.router,      prefix="/api/v1/chat",      tags=["chat"])
app.include_router(calm.router,      prefix="/api/v1/calma",     tags=["calma"])
app.include_router(panel.router,     prefix="/api/v1/panel",     tags=["panel"])


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

- [ ] **Step 11: Correr todos los tests backend**

```bash
cd backend
python -m pytest tests/ -v
```

Esperado: 49 passed (40 anteriores + 9 nuevos).

- [ ] **Step 12: Commit**

```bash
git add backend/app/models/specialist_note.py \
        backend/app/models/__init__.py \
        backend/alembic/versions/ \
        backend/app/schemas/panel.py \
        backend/app/services/panel_service.py \
        backend/app/routers/panel.py \
        backend/app/core/dependencies.py \
        backend/app/main.py \
        backend/tests/test_panel.py
git commit -m "feat: modelo SpecialistNote, endpoints /panel, require_specialist, tests"
```

---

## Task 2: Frontend — PanelProfesional, api.js, router, Dashboard, tests

**Files:**
- Create: `frontend/src/pages/PanelProfesional.jsx`
- Create: `frontend/src/test/PanelProfesional.test.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `panelApi.listChildren()` → `{ data: ChildSummaryOut[] }`
- Produces: página `/panel` que navega a `/panel/ninos/:childId` al hacer click

- [ ] **Step 1: Agregar `panelApi` a `frontend/src/services/api.js`**

Agregar al final del archivo (después de `calmApi`):

```js
export const panelApi = {
  listChildren: ()          => api.get('/panel/children'),
  getChild:     (childId)   => api.get(`/panel/children/${childId}`),
  saveNote:     (childId, content) =>
    api.put(`/panel/children/${childId}/note`, { content }),
}
```

- [ ] **Step 2: Escribir tests que fallan**

Crear `frontend/src/test/PanelProfesional.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PanelProfesional } from '../pages/PanelProfesional'
import { panelApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  panelApi: {
    listChildren: vi.fn(),
    getChild: vi.fn(),
    saveNote: vi.fn(),
  },
  authApi:     { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  emotionsApi: { list: vi.fn(), log: vi.fn(), today: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi:     { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
  calmApi:     { saveSession: vi.fn(), getPhrase: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, full_name: 'Dra. García', role: 'specialist' },
    loading: false,
  }),
}))

const mockChildren = [
  {
    child_profile_id: 1,
    name: 'Juan',
    age: 10,
    avatar_emoji: '⭐',
    last_emotion_key: 'nervioso',
    total_calm_sessions: 3,
    total_chats: 2,
  },
]

function renderPanel() {
  return render(<MemoryRouter><PanelProfesional /></MemoryRouter>)
}

describe('PanelProfesional', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    panelApi.listChildren.mockResolvedValue({ data: mockChildren })
  })

  it('muestra tarjetas de niños al cargar', async () => {
    renderPanel()
    await waitFor(() => {
      expect(screen.getByText('Juan')).toBeInTheDocument()
      expect(screen.getByText('10 años')).toBeInTheDocument()
    })
  })

  it('muestra mensaje si no hay niños', async () => {
    panelApi.listChildren.mockResolvedValueOnce({ data: [] })
    renderPanel()
    await waitFor(() => {
      expect(
        screen.getByText('Aún no hay niños registrados en la plataforma.')
      ).toBeInTheDocument()
    })
  })

  it('click en tarjeta navega a /panel/ninos/:id', async () => {
    renderPanel()
    await waitFor(() => screen.getByText('Juan'))
    await userEvent.click(screen.getByText('Juan').closest('button') || screen.getByText('Juan'))
    expect(mockNavigate).toHaveBeenCalledWith('/panel/ninos/1')
  })
})
```

- [ ] **Step 3: Correr tests — deben fallar**

```bash
cd frontend
npx vitest run src/test/PanelProfesional.test.jsx
```

Esperado: FAILED — `Cannot find module '../pages/PanelProfesional'`.

- [ ] **Step 4: Crear `frontend/src/pages/PanelProfesional.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { panelApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function PanelProfesional() {
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    panelApi.listChildren()
      .then((res) => setChildren(res.data))
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

        {children.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-10">
            Aún no hay niños registrados en la plataforma.
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
                      Hoy: {child.last_emotion_key}
                    </p>
                  )}
                  <p className="text-base text-text-muted">
                    {child.total_chats} chats · {child.total_calm_sessions} calma
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

- [ ] **Step 5: Agregar rutas en `frontend/src/router/index.jsx`**

```jsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Welcome }           from '../pages/Welcome'
import { Login }             from '../pages/Login'
import { Register }          from '../pages/Register'
import { Dashboard }         from '../pages/Dashboard'
import { EmotionSelector }   from '../pages/EmotionSelector'
import { ScenarioList }      from '../pages/ScenarioList'
import { ScenarioFlow }      from '../pages/ScenarioFlow'
import { ChatIA }            from '../pages/ChatIA'
import { ZonaCalma }         from '../pages/ZonaCalma'
import { PanelProfesional }  from '../pages/PanelProfesional'
import { ChildDetail }       from '../pages/ChildDetail'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

export const router = createBrowserRouter([
  { path: '/',         element: <Welcome /> },
  { path: '/login',    element: <Login /> },
  { path: '/registro', element: <Register /> },
  {
    path: '/inicio',
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
  },
  {
    path: '/emociones',
    element: <ProtectedRoute><EmotionSelector /></ProtectedRoute>,
  },
  {
    path: '/escenarios',
    element: <ProtectedRoute><ScenarioList /></ProtectedRoute>,
  },
  {
    path: '/escenarios/:scenarioId',
    element: <ProtectedRoute><ScenarioFlow /></ProtectedRoute>,
  },
  {
    path: '/chat',
    element: <ProtectedRoute><ChatIA /></ProtectedRoute>,
  },
  {
    path: '/calma',
    element: <ProtectedRoute><ZonaCalma /></ProtectedRoute>,
  },
  {
    path: '/panel',
    element: <ProtectedRoute><PanelProfesional /></ProtectedRoute>,
  },
  {
    path: '/panel/ninos/:childId',
    element: <ProtectedRoute><ChildDetail /></ProtectedRoute>,
  },
])
```

Nota: `ChildDetail` aún no existe — los tests fallarán hasta el Task 3. El router puede importarla igualmente; el error aparecerá solo al navegar a esa ruta.

- [ ] **Step 6: Modificar `frontend/src/pages/Dashboard.jsx`**

Reemplazar el contenido completo del archivo:

```jsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const ROLE_LABELS = {
  parent:     'Familia',
  specialist: 'Especialista',
  admin:      'Administrador',
}

const MODULE_CARDS = [
  {
    emoji: '😊',
    title: 'Selector emocional',
    desc: '¿Cómo te sientes hoy?',
    available: true,
    path: '/emociones',
  },
  {
    emoji: '🤝',
    title: 'Escenarios sociales',
    desc: 'Practica situaciones del día a día',
    available: true,
    path: '/escenarios',
  },
  {
    emoji: '🦉',
    title: 'Chat con Lumi',
    desc: 'Conversa sobre cómo te sentís',
    available: true,
    path: '/chat',
  },
  {
    emoji: '🧘',
    title: 'Zona de calma',
    desc: 'Respira, pausa y calmáte',
    available: true,
    path: '/calma',
  },
]

const SPECIALIST_CARD = {
  emoji: '📊',
  title: 'Panel Profesional',
  desc: 'Historial de los niños',
  available: true,
  path: '/panel',
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const firstName        = user?.full_name?.split(' ')[0] || 'Bienvenido'

  const cards = user?.role === 'specialist'
    ? [...MODULE_CARDS, SPECIALIST_CARD]
    : MODULE_CARDS

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-8">

        {/* Cabecera */}
        <div className="flex items-center gap-4">
          <LumiCharacter state="happy" size={80} />
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">
              ¡Hola, {firstName}!
            </h1>
            <p className="text-base text-text-secondary">
              {ROLE_LABELS[user?.role] || 'Usuario'}
            </p>
          </div>
        </div>

        {/* Módulos */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">Módulos</h2>
          {cards.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {mod.available ? (
                <button
                  onClick={() => navigate(mod.path)}
                  className="
                    w-full flex items-center gap-4 p-5 rounded-3xl
                    bg-calm-surface border-2 border-calm-border
                    hover:border-primary-500 hover:bg-primary-50
                    transition-colors text-left min-h-[72px]
                  "
                  aria-label={`Ir a ${mod.title}`}
                >
                  <span className="text-3xl">{mod.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-text-primary text-base">{mod.title}</p>
                    <p className="text-base text-text-secondary">{mod.desc}</p>
                  </div>
                  <span className="text-text-muted text-xl">›</span>
                </button>
              ) : (
                <Card className="flex items-center gap-4 opacity-50">
                  <span className="text-3xl">{mod.emoji}</span>
                  <div>
                    <p className="font-bold text-text-primary text-base">{mod.title}</p>
                    <p className="text-base text-text-muted">{mod.desc}</p>
                  </div>
                </Card>
              )}
            </motion.div>
          ))}
        </div>

        <Button variant="ghost" onClick={handleLogout} className="self-start">
          Cerrar sesión
        </Button>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 7: Correr tests frontend**

```bash
cd frontend
npx vitest run src/test/PanelProfesional.test.jsx
```

Esperado: 3 passed.

- [ ] **Step 8: Correr suite completa**

```bash
npx vitest run
```

Esperado: todos los tests anteriores siguen pasando (mínimo 24 passed).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/api.js \
        frontend/src/router/index.jsx \
        frontend/src/pages/Dashboard.jsx \
        frontend/src/pages/PanelProfesional.jsx \
        frontend/src/test/PanelProfesional.test.jsx
git commit -m "feat: PanelProfesional page, panelApi, rutas /panel, tarjeta Dashboard especialista"
```

---

## Task 3: Frontend — ChildDetail, tests

**Files:**
- Create: `frontend/src/pages/ChildDetail.jsx`
- Create: `frontend/src/test/ChildDetail.test.jsx`

**Interfaces:**
- Consumes: `panelApi.getChild(childId)` → detalle completo · `panelApi.saveNote(childId, content)` → nota guardada
- Consumes: `childId` de `useParams()`

- [ ] **Step 1: Escribir tests que fallan**

Crear `frontend/src/test/ChildDetail.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ChildDetail } from '../pages/ChildDetail'
import { panelApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ childId: '1' }),
  }
})

vi.mock('../services/api', () => ({
  panelApi: {
    listChildren: vi.fn(),
    getChild: vi.fn(),
    saveNote: vi.fn(),
  },
  authApi:      { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  emotionsApi:  { list: vi.fn(), log: vi.fn(), today: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi:      { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
  calmApi:      { saveSession: vi.fn(), getPhrase: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 2, full_name: 'Dra. García', role: 'specialist' },
    loading: false,
  }),
}))

const mockChild = {
  child_profile_id: 1,
  name: 'Juan',
  age: 10,
  avatar_emoji: '⭐',
  emotions: [
    { emotion_key: 'nervioso', logged_at: '2026-06-17T10:00:00Z' },
  ],
  calm_sessions: [
    {
      activity_type: 'respirar',
      duration_seconds: 40,
      emotion_key: 'nervioso',
      created_at: '2026-06-17T10:05:00Z',
    },
  ],
  conversations: [
    {
      conversation_id: 1,
      emotion_key: 'nervioso',
      started_at: '2026-06-17T10:10:00Z',
      ended_at: null,
      message_count: 2,
      messages: [
        { role: 'assistant', content: '¡Hola, Juan!', created_at: '2026-06-17T10:10:00Z' },
        { role: 'user', content: 'Bien', created_at: '2026-06-17T10:10:30Z' },
      ],
    },
  ],
  specialist_note: 'Nota preexistente.',
}

function renderDetail() {
  return render(<MemoryRouter><ChildDetail /></MemoryRouter>)
}

describe('ChildDetail', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    panelApi.getChild.mockResolvedValue({ data: mockChild })
    panelApi.saveNote.mockResolvedValue({
      data: { content: 'Nueva nota.', updated_at: '2026-06-17T11:00:00Z' },
    })
  })

  it('muestra nombre y emoji del niño', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Juan')).toBeInTheDocument()
      expect(screen.getByText('⭐')).toBeInTheDocument()
    })
  })

  it('muestra historial de emociones', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Emociones'))
    await userEvent.click(screen.getByText('Emociones'))
    await waitFor(() => {
      expect(screen.getByText('nervioso')).toBeInTheDocument()
    })
  })

  it('muestra sesiones de calma', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Calma'))
    await userEvent.click(screen.getByText('Calma'))
    await waitFor(() => {
      expect(screen.getByText('Respirar')).toBeInTheDocument()
    })
  })

  it('muestra conversaciones expandibles con mensajes', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Conversaciones'))
    await userEvent.click(screen.getByText('Conversaciones'))
    await waitFor(() => screen.getByText(/nervioso/i))
    // Expandir la conversación
    const expandBtn = screen.getByRole('button', { name: /expandir/i })
    await userEvent.click(expandBtn)
    await waitFor(() => {
      expect(screen.getByText('¡Hola, Juan!')).toBeInTheDocument()
      expect(screen.getByText('Bien')).toBeInTheDocument()
    })
  })

  it('guardar nota llama a panelApi.saveNote con el contenido correcto', async () => {
    renderDetail()
    await waitFor(() => screen.getByPlaceholderText(/observaciones/i))
    const textarea = screen.getByPlaceholderText(/observaciones/i)
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'Nueva nota.')
    await userEvent.click(screen.getByRole('button', { name: /guardar nota/i }))
    await waitFor(() => {
      expect(panelApi.saveNote).toHaveBeenCalledWith('1', 'Nueva nota.')
    })
  })

  it('error en carga muestra mensaje de error', async () => {
    panelApi.getChild.mockRejectedValueOnce(new Error('Network'))
    renderDetail()
    await waitFor(() => {
      expect(
        screen.getByText(/no se pudo cargar/i)
      ).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
cd frontend
npx vitest run src/test/ChildDetail.test.jsx
```

Esperado: FAILED — `Cannot find module '../pages/ChildDetail'`.

- [ ] **Step 3: Crear `frontend/src/pages/ChildDetail.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { panelApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const ACTIVITY_LABELS = {
  respirar: 'Respirar',
  pausa: 'Pausa',
  frase: 'Frase de Lumi',
}

function formatMmSs(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TABS = ['Emociones', 'Calma', 'Conversaciones']

export function ChildDetail() {
  const { childId }       = useParams()
  const navigate          = useNavigate()
  const [child, setChild] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [activeTab, setActiveTab] = useState('Emociones')
  const [expandedConv, setExpandedConv] = useState(null)
  const [note, setNote]         = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    panelApi.getChild(childId)
      .then((res) => {
        setChild(res.data)
        setNote(res.data.specialist_note ?? '')
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [childId])

  async function handleSaveNote() {
    setSaving(true)
    setNoteSaved(false)
    try {
      await panelApi.saveNote(childId, note)
      setNoteSaved(true)
    } catch {
      // error silencioso — el especialista puede reintentar
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageWrapper className="items-center justify-center">
        <LumiCharacter state="thinking" size={90} />
        <p className="text-base text-text-secondary mt-4">Cargando...</p>
      </PageWrapper>
    )
  }

  if (error || !child) {
    return (
      <PageWrapper>
        <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
          <button
            onClick={() => navigate('/panel')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2 self-start"
          >
            ← Volver
          </button>
          <p className="text-base text-text-secondary text-center py-10">
            No se pudo cargar el perfil del niño.
          </p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        {/* Encabezado */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/panel')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al panel"
          >
            ← Volver
          </button>
          <span className="text-3xl">{child.avatar_emoji}</span>
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">{child.name}</h1>
            <p className="text-base text-text-secondary">{child.age} años</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-calm-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-base font-bold px-4 py-2 min-h-[44px] border-b-2 transition-colors
                ${activeTab === tab
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-text-secondary hover:text-primary-600'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab: Emociones */}
        {activeTab === 'Emociones' && (
          <div className="flex flex-col gap-3">
            {child.emotions.length === 0 ? (
              <p className="text-base text-text-secondary text-center py-6">Sin registros de emociones.</p>
            ) : (
              child.emotions.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-calm-surface border border-calm-border">
                  <p className="text-base font-bold text-text-primary">{e.emotion_key}</p>
                  <p className="text-base text-text-secondary">{formatDate(e.logged_at)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Calma */}
        {activeTab === 'Calma' && (
          <div className="flex flex-col gap-3">
            {child.calm_sessions.length === 0 ? (
              <p className="text-base text-text-secondary text-center py-6">Sin sesiones de calma.</p>
            ) : (
              child.calm_sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-calm-surface border border-calm-border">
                  <div>
                    <p className="text-base font-bold text-text-primary">
                      {ACTIVITY_LABELS[s.activity_type] ?? s.activity_type}
                    </p>
                    <p className="text-base text-text-secondary">Emoción: {s.emotion_key}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base text-text-primary">{formatMmSs(s.duration_seconds)}</p>
                    <p className="text-base text-text-secondary">{formatDate(s.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Conversaciones */}
        {activeTab === 'Conversaciones' && (
          <div className="flex flex-col gap-3">
            {child.conversations.length === 0 ? (
              <p className="text-base text-text-secondary text-center py-6">Sin conversaciones registradas.</p>
            ) : (
              child.conversations.map((conv) => (
                <div key={conv.conversation_id} className="rounded-2xl bg-calm-surface border border-calm-border overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedConv(expandedConv === conv.conversation_id ? null : conv.conversation_id)
                    }
                    className="w-full flex items-center justify-between p-4 min-h-[44px] text-left"
                    aria-label={`Expandir conversación ${conv.conversation_id}`}
                  >
                    <div>
                      <p className="text-base font-bold text-text-primary">
                        Emoción: {conv.emotion_key}
                      </p>
                      <p className="text-base text-text-secondary">
                        {formatDate(conv.started_at)} · {conv.message_count} mensajes
                      </p>
                    </div>
                    <span className="text-text-muted text-xl">
                      {expandedConv === conv.conversation_id ? '▲' : '▼'}
                    </span>
                  </button>

                  {expandedConv === conv.conversation_id && (
                    <div className="flex flex-col gap-2 px-4 pb-4 border-t border-calm-border">
                      {conv.messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                        >
                          <p className={`text-base px-4 py-2 rounded-2xl max-w-[80%]
                            ${msg.role === 'assistant'
                              ? 'bg-primary-100 text-text-primary'
                              : 'bg-primary-500 text-white'
                            }`}
                          >
                            {msg.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Nota del especialista */}
        <div className="flex flex-col gap-3 pt-4 border-t border-calm-border">
          <h2 className="text-base font-bold text-text-primary">Nota del especialista</h2>
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteSaved(false) }}
            placeholder="Escribí tus observaciones sobre este niño..."
            className="
              w-full rounded-2xl border-2 border-calm-border p-4
              text-base text-text-primary bg-white
              focus:outline-none focus:border-primary-500
              min-h-[120px] resize-none
            "
            maxLength={2000}
          />
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveNote}
              disabled={saving || !note.trim()}
              className="
                bg-primary-500 text-white font-bold text-base
                px-6 rounded-2xl min-h-[44px]
                hover:bg-primary-600 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              aria-label="Guardar nota"
            >
              {saving ? 'Guardando...' : 'Guardar nota'}
            </button>
            {noteSaved && (
              <p className="text-base text-primary-600 font-bold">Nota guardada</p>
            )}
          </div>
        </div>

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 4: Correr tests ChildDetail**

```bash
cd frontend
npx vitest run src/test/ChildDetail.test.jsx
```

Esperado: 6 passed.

- [ ] **Step 5: Correr suite completa frontend**

```bash
npx vitest run
```

Esperado: mínimo 33 passed (24 anteriores + 3 PanelProfesional + 6 ChildDetail).

- [ ] **Step 6: Correr tests backend para confirmar que siguen pasando**

```bash
cd backend
python -m pytest tests/ -v
```

Esperado: 49 passed.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ChildDetail.jsx \
        frontend/src/test/ChildDetail.test.jsx
git commit -m "feat: ChildDetail page — emociones, calma, conversaciones, nota especialista"
```
