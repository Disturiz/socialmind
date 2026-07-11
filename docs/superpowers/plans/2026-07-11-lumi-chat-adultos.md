# Lumi Chat Adultos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat multi-turno con Lumi para padres y especialistas, con voz, RAG automático de la Biblioteca y prompts diferenciados por rol.

**Architecture:** Nuevos modelos `AdultConversation` / `AdultMessage` siguen el patrón de `ChatConversation` / `ChatMessage` ya existentes. El servicio reutiliza `biblioteca_service.search()` para el contexto RAG y llama a Claude Haiku con el historial completo de la conversación. La página React monta una nueva conversación en cada visita y gestiona los mensajes localmente hasta que llegan del backend.

**Tech Stack:** FastAPI 0.110+, SQLAlchemy 2.x, Alembic, Anthropic SDK (`claude-haiku-4-5-20251001`), React 18, Vite, Tailwind CSS, Web Speech API (STT + TTS).

## Global Constraints

- SQLAlchemy 2.x: usar `Mapped[T]` / `mapped_column()` — nunca `Column()` ni `declarative_base()` clásico.
- Migración: `revision = 'd9e0f1a2b3c4'`, `down_revision = 'c8d9e0f1a2b3'`.
- Claude model: `claude-haiku-4-5-20251001`, `max_tokens=1024`.
- Endpoints bajo `/api/v1/lumi-chat/` — `get_current_user` en todos (ningún rol excluido).
- Verificar `conv.user_id == current_user.id` en los 3 endpoints; retornar 404 si no coincide.
- `MessageIn.content`: `min_length=1`, `max_length=2000`.
- `lumiChatApi` en `api.js`: claves exactas `createConversation`, `sendMessage`, `getConversation`.
- Ruta frontend: `/lumi-chat` bajo `ProtectedRoute` (sin `ParentOnboardingGuard`).
- Micrófono: ocultar botón si `window.SpeechRecognition` y `window.webkitSpeechRecognition` son ambos falsy.
- `.env` con valores reales NUNCA commiteado — solo `.env.prod.example` con placeholders.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| CREATE | `backend/app/models/adult_conversation.py` |
| CREATE | `backend/app/models/adult_message.py` |
| CREATE | `backend/alembic/versions/d9e0f1a2b3c4_add_adult_conversations.py` |
| MODIFY | `backend/app/main.py` (modelo imports + router) |
| CREATE | `backend/app/schemas/lumi_chat.py` |
| CREATE | `backend/app/services/lumi_chat_service.py` |
| CREATE | `backend/app/routers/lumi_chat.py` |
| CREATE | `backend/tests/test_lumi_chat.py` |
| MODIFY | `frontend/src/services/api.js` |
| CREATE | `frontend/src/pages/LumiChatAdultosPage.jsx` |
| MODIFY | `frontend/src/router/index.jsx` |
| MODIFY | `frontend/src/pages/Dashboard.jsx` |
| MODIFY | `frontend/src/pages/PanelProfesional.jsx` |

---

### Task 1: Modelos + Migración Alembic

**Files:**
- Create: `backend/app/models/adult_conversation.py`
- Create: `backend/app/models/adult_message.py`
- Create: `backend/alembic/versions/d9e0f1a2b3c4_add_adult_conversations.py`
- Modify: `backend/app/main.py` (solo imports de modelos)

**Interfaces:**
- Produces: `AdultConversation`, `AdultMessage` — disponibles en `app.models.adult_conversation` y `app.models.adult_message`.

- [ ] **Step 1: Escribir los modelos**

Crear `backend/app/models/adult_conversation.py`:

```python
from datetime import datetime, timezone
from sqlalchemy import Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AdultConversation(Base):
    __tablename__ = "adult_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    messages: Mapped[list["AdultMessage"]] = relationship(
        "AdultMessage", back_populates="conversation", order_by="AdultMessage.created_at"
    )
```

Crear `backend/app/models/adult_message.py`:

```python
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AdultMessage(Base):
    __tablename__ = "adult_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("adult_conversations.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)   # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    conversation: Mapped["AdultConversation"] = relationship(
        "AdultConversation", back_populates="messages"
    )

    __table_args__ = (
        Index("ix_adult_messages_conv_created", "conversation_id", "created_at"),
    )
```

- [ ] **Step 2: Crear la migración Alembic**

Crear `backend/alembic/versions/d9e0f1a2b3c4_add_adult_conversations.py`:

```python
"""add_adult_conversations

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-07-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd9e0f1a2b3c4'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'adult_conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_adult_conversations_id'), 'adult_conversations', ['id'], unique=False
    )

    op.create_table(
        'adult_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['adult_conversations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_adult_messages_id'), 'adult_messages', ['id'], unique=False
    )
    op.create_index(
        'ix_adult_messages_conv_created', 'adult_messages',
        ['conversation_id', 'created_at'], unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_adult_messages_conv_created', table_name='adult_messages')
    op.drop_index(op.f('ix_adult_messages_id'), table_name='adult_messages')
    op.drop_table('adult_messages')
    op.drop_index(op.f('ix_adult_conversations_id'), table_name='adult_conversations')
    op.drop_table('adult_conversations')
```

- [ ] **Step 3: Registrar los modelos en main.py**

En `backend/app/main.py`, agregar estas dos líneas de import junto a los demás imports de modelos (después de `import app.models.user_rewards`):

```python
import app.models.adult_conversation
import app.models.adult_message
```

El bloque de imports de modelos completo queda así:

```python
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message
import app.models.calm_session
import app.models.specialist_note
import app.models.specialist_assignment
import app.models.document
import app.models.document_chunk
import app.models.reward_event
import app.models.user_rewards
import app.models.adult_conversation
import app.models.adult_message
```

- [ ] **Step 4: Verificar que los modelos importan y los tests del proyecto pasan**

```bash
cd backend
python -c "from app.models.adult_conversation import AdultConversation; from app.models.adult_message import AdultMessage; print('OK')"
```

Expected output: `OK`

```bash
python -m pytest tests/ --tb=short -q
```

Expected: todos los tests existentes pasan (110 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/adult_conversation.py \
        backend/app/models/adult_message.py \
        backend/alembic/versions/d9e0f1a2b3c4_add_adult_conversations.py \
        backend/app/main.py
git commit -m "feat: modelos AdultConversation/AdultMessage y migración Alembic"
```

---

### Task 2: Schemas + Servicio

**Files:**
- Create: `backend/app/schemas/lumi_chat.py`
- Create: `backend/app/services/lumi_chat_service.py`
- Test: service unit tests inline en `backend/tests/test_lumi_chat_service.py`

**Interfaces:**
- Consumes: `AdultConversation` de `app.models.adult_conversation`, `AdultMessage` de `app.models.adult_message`, `biblioteca_service.search(db, query, top_k)` de `app.services.biblioteca_service`.
- Produces:
  - `lumi_chat_service.create_conversation(db, user_id) -> AdultConversation`
  - `lumi_chat_service.get_conversation(db, conv_id, user_id) -> AdultConversation` — HTTPException 404 si no existe o no pertenece al usuario
  - `lumi_chat_service.send_message(db, conv_id, user_id, content, role) -> AdultMessage` — HTTPException 503 si Claude falla
  - Schemas: `ConversationOut`, `MessageIn`, `MessageOut`, `ConversationDetailOut`

- [ ] **Step 1: Escribir los tests que fallarán**

Crear `backend/tests/test_lumi_chat_service.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.models.user import User, UserRole
from app.models.adult_conversation import AdultConversation
from app.models.adult_message import AdultMessage
from app.core.security import hash_password
from app.services import lumi_chat_service


def _make_user(db, email="u@test.com", role=UserRole.parent):
    user = User(
        email=email,
        hashed_password=hash_password("pass"),
        full_name="Test User",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_mock_claude(text="Respuesta de Lumi."):
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    client = MagicMock()
    client.messages.create.return_value = resp
    return client


def test_create_conversation_returns_adult_conversation(db):
    user = _make_user(db)
    conv = lumi_chat_service.create_conversation(db, user.id)
    assert isinstance(conv, AdultConversation)
    assert conv.id is not None
    assert conv.user_id == user.id
    assert conv.started_at is not None


def test_get_conversation_returns_correct_conversation(db):
    user = _make_user(db, "gc1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    found = lumi_chat_service.get_conversation(db, conv.id, user.id)
    assert found.id == conv.id


def test_get_conversation_wrong_user_raises_404(db):
    user1 = _make_user(db, "wu1@test.com")
    user2 = _make_user(db, "wu2@test.com")
    conv = lumi_chat_service.create_conversation(db, user1.id)
    with pytest.raises(HTTPException) as exc:
        lumi_chat_service.get_conversation(db, conv.id, user2.id)
    assert exc.value.status_code == 404


def test_get_nonexistent_conversation_raises_404(db):
    user = _make_user(db, "ne1@test.com")
    with pytest.raises(HTTPException) as exc:
        lumi_chat_service.get_conversation(db, 99999, user.id)
    assert exc.value.status_code == 404


def test_send_message_saves_user_and_assistant_messages(db):
    user = _make_user(db, "sm1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = _make_mock_claude("Claro, puedo ayudarte.")

    with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
        reply = lumi_chat_service.send_message(db, conv.id, user.id, "Hola Lumi", "parent")

    assert isinstance(reply, AdultMessage)
    assert reply.role == "assistant"
    assert reply.content == "Claro, puedo ayudarte."

    msgs = db.query(AdultMessage).filter(
        AdultMessage.conversation_id == conv.id
    ).order_by(AdultMessage.created_at).all()
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[0].content == "Hola Lumi"
    assert msgs[1].role == "assistant"


def test_send_message_uses_specialist_system_prompt(db):
    user = _make_user(db, "sp1@test.com", role=UserRole.specialist)
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = _make_mock_claude()

    with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
        lumi_chat_service.send_message(db, conv.id, user.id, "¿Qué es el TEA?", "specialist")

    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert "terminología profesional" in call_kwargs["system"].lower() or \
           "clínico" in call_kwargs["system"].lower()


def test_send_message_passes_history_to_claude(db):
    user = _make_user(db, "hist1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = _make_mock_claude("Primera respuesta.")

    with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
        lumi_chat_service.send_message(db, conv.id, user.id, "Primera pregunta", "parent")

    mock_client2 = _make_mock_claude("Segunda respuesta.")
    with patch("app.services.lumi_chat_service.anthropic_client", mock_client2):
        lumi_chat_service.send_message(db, conv.id, user.id, "Segunda pregunta", "parent")

    call_messages = mock_client2.messages.create.call_args.kwargs["messages"]
    roles = [m["role"] for m in call_messages]
    assert roles == ["user", "assistant", "user"]


def test_send_message_claude_error_raises_503(db):
    user = _make_user(db, "err1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API down")

    with pytest.raises(HTTPException) as exc:
        with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
            lumi_chat_service.send_message(db, conv.id, user.id, "Hola", "parent")
    assert exc.value.status_code == 503
```

- [ ] **Step 2: Ejecutar los tests — deben fallar**

```bash
cd backend
python -m pytest tests/test_lumi_chat_service.py -v
```

Expected: `ImportError` o `ModuleNotFoundError` porque `lumi_chat_service` no existe aún.

- [ ] **Step 3: Escribir los schemas**

Crear `backend/app/schemas/lumi_chat.py`:

```python
from datetime import datetime
from pydantic import BaseModel, Field


class ConversationOut(BaseModel):
    id: int
    started_at: datetime
    model_config = {"from_attributes": True}


class MessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: int
    started_at: datetime
    messages: list[MessageOut]
    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Escribir el servicio**

Crear `backend/app/services/lumi_chat_service.py`:

```python
import anthropic
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.adult_conversation import AdultConversation
from app.models.adult_message import AdultMessage
from app.services import biblioteca_service

SYSTEM_SPECIALIST = (
    "Eres Lumi, un asistente clínico especializado en autismo y desarrollo infantil. "
    "Conversas con especialistas ofreciendo orientación basada en evidencia. "
    "Cuando dispongas de fragmentos de documentos relevantes, úsalos para fundamentar tus respuestas. "
    "Si no hay fragmentos aplicables, responde desde tu conocimiento general del espectro autista. "
    "Usa terminología profesional. Sé preciso y conciso."
)

SYSTEM_PARENT = (
    "Eres Lumi, un búho amigable y comprensivo que acompaña a padres de niños con autismo. "
    "Ofreces orientación cálida, práctica y sin tecnicismos. "
    "Cuando dispongas de fragmentos de documentos relevantes, úsalos para fundamentar tus respuestas. "
    "Si no hay fragmentos aplicables, responde desde tu conocimiento general del espectro autista. "
    "Habla siempre con empatía y esperanza."
)

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


def create_conversation(db: Session, user_id: int) -> AdultConversation:
    conv = AdultConversation(
        user_id=user_id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, conv_id: int, user_id: int) -> AdultConversation:
    conv = db.query(AdultConversation).filter(
        AdultConversation.id == conv_id,
        AdultConversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada.",
        )
    return conv


def send_message(
    db: Session, conv_id: int, user_id: int, content: str, role: str
) -> AdultMessage:
    get_conversation(db, conv_id, user_id)   # 404 if not owned

    user_msg = AdultMessage(
        conversation_id=conv_id,
        role="user",
        content=content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    history = (
        db.query(AdultMessage)
        .filter(AdultMessage.conversation_id == conv_id)
        .order_by(AdultMessage.created_at)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in history]

    context = biblioteca_service.search(db, content, top_k=3)
    system = SYSTEM_SPECIALIST if role == "specialist" else SYSTEM_PARENT
    if context:
        system += f"\n\nFragmentos de documentos relevantes:\n\n{context}"

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        answer = response.content[0].text
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Servicio de IA no disponible. Intenta de nuevo.",
        )

    assistant_msg = AdultMessage(
        conversation_id=conv_id,
        role="assistant",
        content=answer,
        created_at=datetime.now(timezone.utc),
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    return assistant_msg
```

- [ ] **Step 5: Ejecutar los tests del servicio — deben pasar**

```bash
python -m pytest tests/test_lumi_chat_service.py -v
```

Expected: `8 passed`.

- [ ] **Step 6: Verificar que los tests existentes siguen pasando**

```bash
python -m pytest tests/ --tb=short -q
```

Expected: todos pasan (118 passed aprox.).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/lumi_chat.py \
        backend/app/services/lumi_chat_service.py \
        backend/tests/test_lumi_chat_service.py
git commit -m "feat: schemas y servicio lumi_chat con RAG y prompts por rol"
```

---

### Task 3: Router + Tests HTTP + wiring en main.py

**Files:**
- Create: `backend/app/routers/lumi_chat.py`
- Create: `backend/tests/test_lumi_chat.py`
- Modify: `backend/app/main.py` (agregar router)

**Interfaces:**
- Consumes: `lumi_chat_service.create_conversation`, `get_conversation`, `send_message`; schemas `ConversationOut`, `MessageIn`, `MessageOut`, `ConversationDetailOut`.
- Produces: endpoints `POST /api/v1/lumi-chat/conversations`, `POST /api/v1/lumi-chat/conversations/{conv_id}/messages`, `GET /api/v1/lumi-chat/conversations/{conv_id}`.

- [ ] **Step 1: Escribir los tests HTTP que fallarán**

Crear `backend/tests/test_lumi_chat.py`:

```python
from unittest.mock import MagicMock, patch


def _login(client, email, role="parent"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test", "role": role,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _mock_claude(text="Hola, soy Lumi."):
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    client = MagicMock()
    client.messages.create.return_value = resp
    return client


def test_create_conversation_returns_201_and_id(client):
    token = _login(client, "cc1@test.com")
    resp = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token))
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert "started_at" in data


def test_create_conversation_unauthenticated_returns_401(client):
    resp = client.post("/api/v1/lumi-chat/conversations")
    assert resp.status_code == 401


def test_send_message_returns_201_with_assistant_reply(client):
    token = _login(client, "sm2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude("¡Claro!")):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Hola Lumi"},
            headers=_auth(token),
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "assistant"
    assert data["content"] == "¡Claro!"
    assert "id" in data
    assert "created_at" in data


def test_send_message_to_foreign_conversation_returns_404(client):
    token1 = _login(client, "fgn1@test.com")
    token2 = _login(client, "fgn2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token1)).json()

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude()):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Hola"},
            headers=_auth(token2),
        )
    assert resp.status_code == 404


def test_send_empty_message_returns_422(client):
    token = _login(client, "emp1@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    resp = client.post(
        f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
        json={"content": ""},
        headers=_auth(token),
    )
    assert resp.status_code == 422


def test_send_message_over_2000_chars_returns_422(client):
    token = _login(client, "long1@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    resp = client.post(
        f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
        json={"content": "x" * 2001},
        headers=_auth(token),
    )
    assert resp.status_code == 422


def test_send_message_when_claude_fails_returns_503(client):
    token = _login(client, "err2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    bad_client = MagicMock()
    bad_client.messages.create.side_effect = Exception("timeout")

    with patch("app.services.lumi_chat_service.anthropic_client", bad_client):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Hola"},
            headers=_auth(token),
        )
    assert resp.status_code == 503


def test_get_conversation_returns_messages(client):
    token = _login(client, "gc2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude("Respuesta.")):
        client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Pregunta"},
            headers=_auth(token),
        )

    resp = client.get(
        f"/api/v1/lumi-chat/conversations/{conv['id']}",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == conv["id"]
    assert len(data["messages"]) == 2
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"


def test_get_foreign_conversation_returns_404(client):
    token1 = _login(client, "fg2a@test.com")
    token2 = _login(client, "fg2b@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token1)).json()
    resp = client.get(
        f"/api/v1/lumi-chat/conversations/{conv['id']}",
        headers=_auth(token2),
    )
    assert resp.status_code == 404


def test_specialist_can_create_and_send(client):
    token = _login(client, "spec2@test.com", role="specialist")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    assert conv["id"] is not None

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude("Datos clínicos.")):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "¿Qué es el TEA?"},
            headers=_auth(token),
        )
    assert resp.status_code == 201
    assert resp.json()["content"] == "Datos clínicos."
```

- [ ] **Step 2: Ejecutar los tests — deben fallar con 404 (ruta no existe)**

```bash
python -m pytest tests/test_lumi_chat.py -v
```

Expected: todos fallan con `assert 404 == 201` o similar (la ruta no existe).

- [ ] **Step 3: Escribir el router**

Crear `backend/app/routers/lumi_chat.py`:

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.lumi_chat import (
    ConversationOut,
    MessageIn,
    MessageOut,
    ConversationDetailOut,
)
from app.services import lumi_chat_service

router = APIRouter()


@router.post(
    "/conversations",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lumi_chat_service.create_conversation(db, current_user.id)


@router.post(
    "/conversations/{conv_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conv_id: int,
    body: MessageIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lumi_chat_service.send_message(
        db, conv_id, current_user.id, body.content, current_user.role.value
    )


@router.get(
    "/conversations/{conv_id}",
    response_model=ConversationDetailOut,
)
def get_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lumi_chat_service.get_conversation(db, conv_id, current_user.id)
```

- [ ] **Step 4: Registrar el router en main.py**

En `backend/app/main.py`:

1. Agregar `lumi_chat` al import de routers en la línea 4:
```python
from app.routers import auth, emotions, scenarios, chat, calm, panel, biblioteca, profiles, assignments, lumi_chat
```

2. Agregar `include_router` al final de los routers existentes:
```python
app.include_router(lumi_chat.router, prefix="/api/v1/lumi-chat", tags=["lumi-chat-adultos"])
```

- [ ] **Step 5: Ejecutar los tests HTTP — deben pasar**

```bash
python -m pytest tests/test_lumi_chat.py -v
```

Expected: `10 passed`.

- [ ] **Step 6: Ejecutar toda la suite**

```bash
python -m pytest tests/ --tb=short -q
```

Expected: todos pasan (128 passed aprox.).

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/lumi_chat.py \
        backend/tests/test_lumi_chat.py \
        backend/app/main.py
git commit -m "feat: router lumi-chat y 10 tests HTTP"
```

---

### Task 4: Frontend — API client + Página

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/pages/LumiChatAdultosPage.jsx`

**Interfaces:**
- Consumes: `POST /api/v1/lumi-chat/conversations`, `POST /api/v1/lumi-chat/conversations/{id}/messages`, `GET /api/v1/lumi-chat/conversations/{id}`.
- Produces: `lumiChatApi` exportado desde `api.js`; componente `LumiChatAdultosPage` exportado named desde `LumiChatAdultosPage.jsx`.

- [ ] **Step 1: Agregar lumiChatApi a api.js**

En `frontend/src/services/api.js`, agregar al final del archivo (después de `assignmentsApi`):

```js
export const lumiChatApi = {
  createConversation: () => api.post('/lumi-chat/conversations'),
  sendMessage: (convId, content) =>
    api.post(`/lumi-chat/conversations/${convId}/messages`, { content }),
  getConversation: (convId) => api.get(`/lumi-chat/conversations/${convId}`),
}
```

- [ ] **Step 2: Crear la página LumiChatAdultosPage**

Crear `frontend/src/pages/LumiChatAdultosPage.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { lumiChatApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function LumiChatAdultosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [convId, setConvId]     = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking]   = useState(null)   // id del mensaje siendo leído
  const bottomRef      = useRef(null)
  const recognitionRef = useRef(null)

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
  const hasSpeech = Boolean(SpeechRec)

  useEffect(() => {
    lumiChatApi.createConversation()
      .then(res => setConvId(res.data.id))
      .catch(() => setError('No se pudo iniciar la conversación. Intenta recargar la página.'))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    if (!input.trim() || !convId || loading) return
    if (speaking !== null) {
      window.speechSynthesis.cancel()
      setSpeaking(null)
    }
    const userContent = input.trim()
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: userContent }])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await lumiChatApi.sendMessage(convId, userContent)
      setMessages(prev => [...prev, res.data])
    } catch {
      setError('No se pudo enviar el mensaje. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMic = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const recognition = new SpeechRec()
    recognition.lang = 'es-419'
    recognition.interimResults = false
    recognition.onresult = (e) => setInput(e.results[0][0].transcript)
    recognition.onend  = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const handleSpeak = (msgId, text) => {
    if (speaking === msgId) {
      window.speechSynthesis.cancel()
      setSpeaking(null)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-419'
    utterance.onend  = () => setSpeaking(null)
    utterance.onerror = () => setSpeaking(null)
    setSpeaking(msgId)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <PageWrapper className="px-4 py-6">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-4" style={{ minHeight: '80vh' }}>

        {/* Cabecera */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inicio')}
            className="text-primary-600 font-bold text-base min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <LumiCharacter state="happy" size={48} />
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">Chat con Lumi</h1>
            <p className="text-sm text-text-secondary">
              {user?.role === 'specialist'
                ? 'Consultas clínicas sobre el espectro autista'
                : 'Conversa sobre el autismo con Lumi'}
            </p>
          </div>
        </div>

        {/* Lista de mensajes */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-2">
          {messages.length === 0 && !loading && !error && (
            <p className="text-center text-text-secondary text-sm mt-10">
              ¡Hola! Puedes preguntarme cualquier cosa sobre el espectro autista.
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`
                  max-w-[82%] px-4 py-3 rounded-2xl text-base leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-calm-surface border-2 border-calm-border text-text-primary rounded-bl-sm'}
                `}
              >
                {msg.content}
              </div>
              {msg.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => handleSpeak(msg.id, msg.content)}
                  className="text-xs text-primary-600 hover:underline px-1"
                >
                  {speaking === msg.id ? '⏹ Detener' : '🔊 Escuchar'}
                </button>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <div className="px-4 py-3 rounded-2xl bg-calm-surface border-2 border-calm-border text-text-secondary text-sm italic">
                Lumi está pensando...
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div ref={bottomRef} />
        </div>

        {/* Área de entrada */}
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              user?.role === 'specialist'
                ? 'Escribe tu consulta clínica...'
                : '¿Qué quieres preguntarle a Lumi?'
            }
            rows={2}
            disabled={loading || !convId}
            className="
              flex-1 rounded-2xl border-2 border-calm-border p-3
              text-base text-text-primary bg-calm-surface resize-none
              focus:outline-none focus:border-primary-500
              disabled:opacity-50
            "
          />
          {hasSpeech && (
            <button
              type="button"
              onClick={handleMic}
              disabled={loading || !convId}
              className="
                p-3 rounded-2xl border-2 border-calm-border bg-calm-surface
                hover:border-primary-500 disabled:opacity-50 transition-colors
                text-xl min-w-[48px] min-h-[48px]
              "
              aria-label={listening ? 'Detener grabación' : 'Grabar voz'}
            >
              {listening ? '🔴' : '🎤'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim() || !convId}
            className="
              px-4 py-3 rounded-2xl bg-primary-600 text-white font-bold text-xl
              hover:bg-primary-700 disabled:opacity-50 transition-colors
              min-w-[48px] min-h-[48px]
            "
            aria-label="Enviar mensaje"
          >
            ›
          </button>
        </div>

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 3: Verificar que el frontend compila sin errores**

```bash
cd frontend
npm run build 2>&1 | tail -20
```

Expected: termina sin errores (`✓ built in Xs`). Si hay errores de compilación, corregirlos antes de continuar.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/services/api.js \
        frontend/src/pages/LumiChatAdultosPage.jsx
git commit -m "feat: lumiChatApi y página LumiChatAdultosPage"
```

---

### Task 5: Frontend — Puntos de entrada + Router

**Files:**
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/PanelProfesional.jsx`

**Interfaces:**
- Consumes: `LumiChatAdultosPage` de `../pages/LumiChatAdultosPage`.
- Produces: ruta `/lumi-chat` accesible para ambos roles; tarjetas en Dashboard; botón en Panel.

- [ ] **Step 1: Agregar la ruta en el router**

En `frontend/src/router/index.jsx`:

1. Agregar import después de los existentes:
```js
import { LumiChatAdultosPage } from '../pages/LumiChatAdultosPage'
```

2. Agregar ruta dentro del array de `createBrowserRouter`. La ruta `/lumi-chat` debe estar entre las rutas protegidas (sin `ParentOnboardingGuard`, ya que especialistas también acceden):

```js
{
  path: '/lumi-chat',
  element: <ProtectedRoute><LumiChatAdultosPage /></ProtectedRoute>,
},
```

Agregar esta entrada después de la ruta `/biblioteca/consultar`:
```js
{
  path: '/biblioteca/consultar',
  element: <ProtectedRoute><BibliotecaChatPage /></ProtectedRoute>,
},
{
  path: '/lumi-chat',
  element: <ProtectedRoute><LumiChatAdultosPage /></ProtectedRoute>,
},
```

- [ ] **Step 2: Agregar tarjetas en Dashboard**

En `frontend/src/pages/Dashboard.jsx`:

En `MODULE_CARDS` (padres), agregar al final del array:
```js
{
  emoji: '🦉',
  title: 'Chat adultos con Lumi',
  desc: 'Consultas sobre el espectro autista',
  available: true,
  path: '/lumi-chat',
},
```

El array `MODULE_CARDS` completo queda:
```js
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
  {
    emoji: '⭐',
    title: 'Mi aventura',
    desc: 'Tu progreso y recompensas',
    available: true,
    path: '/mi-aventura',
  },
  {
    emoji: '📖',
    title: 'Consultar Biblioteca',
    desc: 'Pregunta sobre el autismo a la IA',
    available: true,
    path: '/biblioteca/consultar',
  },
  {
    emoji: '🦉',
    title: 'Chat adultos con Lumi',
    desc: 'Consultas sobre el espectro autista',
    available: true,
    path: '/lumi-chat',
  },
]
```

En `SPECIALIST_CARDS`, agregar al final del array:
```js
{
  emoji: '🦉',
  title: 'Chat con Lumi',
  desc: 'Consultas sobre el espectro autista',
  available: true,
  path: '/lumi-chat',
},
```

El array `SPECIALIST_CARDS` completo queda:
```js
const SPECIALIST_CARDS = [
  {
    emoji: '📊',
    title: 'Panel Profesional',
    desc: 'Historial de los niños',
    available: true,
    path: '/panel',
  },
  {
    emoji: '📚',
    title: 'Biblioteca',
    desc: 'Documentos educativos para Lumi',
    available: true,
    path: '/biblioteca',
  },
  {
    emoji: '📖',
    title: 'Consultar Biblioteca',
    desc: 'Consulta los documentos educativos',
    available: true,
    path: '/biblioteca/consultar',
  },
  {
    emoji: '🦉',
    title: 'Chat con Lumi',
    desc: 'Consultas sobre el espectro autista',
    available: true,
    path: '/lumi-chat',
  },
]
```

- [ ] **Step 3: Agregar botón en PanelProfesional**

En `frontend/src/pages/PanelProfesional.jsx`, agregar el import de `useNavigate` ya está presente. Agregar el botón de "Chat con Lumi" justo después del botón existente de "Consultar Biblioteca" (después del `</button>` de la línea ~66):

```jsx
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

<button
  onClick={() => navigate('/lumi-chat')}
  className="
    w-full flex items-center gap-4 p-5 rounded-3xl text-left
    bg-calm-surface border-2 border-calm-border
    hover:border-primary-500 hover:bg-primary-50
    transition-all font-semibold text-base text-text-primary
  "
>
  <span className="text-3xl">🦉</span>
  <div>
    <div className="font-bold text-text-primary">Chat con Lumi</div>
    <div className="text-sm text-text-secondary">Consultas sobre el espectro autista</div>
  </div>
</button>
```

- [ ] **Step 4: Verificar compilación**

```bash
cd frontend
npm run build 2>&1 | tail -20
```

Expected: termina sin errores.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/router/index.jsx \
        frontend/src/pages/Dashboard.jsx \
        frontend/src/pages/PanelProfesional.jsx
git commit -m "feat: puntos de entrada Lumi Chat Adultos — Dashboard, Panel y router"
```

---

## Self-Review

**Cobertura del spec:**

| Requisito spec | Tarea |
|---|---|
| Modelos `AdultConversation`, `AdultMessage` | Task 1 |
| Migración `d9e0f1a2b3c4`, `down_revision='c8d9e0f1a2b3'` | Task 1 |
| Registrar modelos en `main.py` | Task 1 |
| Schemas `ConversationOut`, `MessageIn`, `MessageOut`, `ConversationDetailOut` | Task 2 |
| `create_conversation`, `get_conversation`, `send_message` | Task 2 |
| Prompts `SYSTEM_SPECIALIST` / `SYSTEM_PARENT` | Task 2 |
| RAG con `biblioteca_service.search()` | Task 2 |
| Claude `haiku-4-5-20251001`, `max_tokens=1024` | Task 2 |
| 503 cuando Claude falla | Task 2 |
| `POST /conversations`, `POST /{id}/messages`, `GET /{id}` | Task 3 |
| 404 en conv ajena, 422 en content inválido | Task 3 |
| `lumiChatApi` en `api.js` | Task 4 |
| `LumiChatAdultosPage` — burbujas, loading, error, TTS | Task 4 |
| Mic oculto si no hay SpeechRecognition | Task 4 |
| Ruta `/lumi-chat` bajo `ProtectedRoute` | Task 5 |
| Tarjeta en `MODULE_CARDS` (padres) | Task 5 |
| Tarjeta en `SPECIALIST_CARDS` (especialistas) | Task 5 |
| Botón en `PanelProfesional` | Task 5 |

Todos los requisitos del spec están cubiertos. No hay placeholders.
