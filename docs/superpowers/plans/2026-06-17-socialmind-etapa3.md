# SocialMind Etapa 3 — Chat IA Guiado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar Claude (claude-haiku-4-5-20251001) como motor conversacional del módulo "Chat con Lumi", donde el niño selecciona respuestas pre-generadas por IA en burbujas de chat, con historial persistido en PostgreSQL.

**Architecture:** El frontend llama a un endpoint propio en FastAPI (`/api/v1/chat`); el backend construye el contexto desde PostgreSQL, llama a Anthropic vía tool_use estructurado, y persiste cada mensaje. Cada conversación arranca conectada a la emoción del día del usuario. El niño nunca escribe texto libre.

**Tech Stack:** FastAPI 0.111, SQLAlchemy 2.0, Alembic, anthropic SDK, pytest + SQLite in-memory; React 18, Vite 5, Tailwind 3, Framer Motion 11, Vitest.

## Global Constraints

- Todo texto visible al usuario: mínimo `text-base` (nunca `text-sm` ni menor)
- Todos los elementos interactivos: `min-h-[44px]`
- Clases Tailwind de colores: solo estáticas en el código (JIT no incluye dinámicas)
- Idioma: solo español latinoamericano en toda la UI y en los mensajes de Lumi
- Sin lenguaje clínico, médico ni diagnóstico en ningún texto visible
- `ANTHROPIC_API_KEY`: solo en `.env` backend, nunca en frontend ni en código fuente
- Tests backend: pytest + SQLite in-memory (StaticPool) — sin llamadas reales a Anthropic (mock siempre)
- Tests frontend: Vitest + Testing Library — sin llamadas reales a la API (vi.mock siempre)
- Commits frecuentes: uno por tarea como mínimo

---

## File Map

```
CREAR:
  backend/app/models/chat_conversation.py
  backend/app/models/chat_message.py
  backend/app/schemas/chat.py
  backend/app/services/chat_service.py
  backend/app/routers/chat.py
  backend/alembic/versions/<auto>_add_chat_tables.py
  backend/tests/test_chat.py
  frontend/src/components/chat/ChatBubble.jsx
  frontend/src/components/chat/ChatOptions.jsx
  frontend/src/pages/ChatIA.jsx
  frontend/src/test/ChatIA.test.jsx

MODIFICAR:
  backend/requirements.txt           — agregar anthropic
  backend/app/config.py              — agregar anthropic_api_key
  backend/app/main.py                — registrar chat router y modelos
  backend/app/routers/emotions.py    — agregar GET /emotions/today
  backend/app/services/emotion_service.py — agregar get_today_emotion()
  backend/tests/test_emotions.py     — agregar 2 tests de /emotions/today
  frontend/src/services/api.js       — agregar chatApi
  frontend/src/router/index.jsx      — agregar ruta /chat
  frontend/src/pages/Dashboard.jsx   — agregar tarjeta Chat con Lumi
```

---

## Task 1: Backend — Modelos, Migración y endpoint `/emotions/today`

**Files:**
- Create: `backend/app/models/chat_conversation.py`
- Create: `backend/app/models/chat_message.py`
- Create: `backend/alembic/versions/<auto>_add_chat_tables.py`
- Modify: `backend/app/config.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services/emotion_service.py`
- Modify: `backend/app/routers/emotions.py`
- Modify: `backend/app/schemas/emotions.py`
- Test: `backend/tests/test_emotions.py`

**Interfaces:**
- Produces: `ChatConversation` model (campos: `id`, `user_id`, `emotion_key`, `started_at`, `ended_at`)
- Produces: `ChatMessage` model (campos: `id`, `conversation_id`, `role`, `content`, `created_at`)
- Produces: `GET /api/v1/emotions/today` → `{"emotion_key": str | null}`
- Produces: `get_today_emotion(db, user_id) -> str | None`

- [ ] **Step 1: Agregar `anthropic` a requirements.txt**

```text
fastapi==0.111.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==4.0.1
python-multipart==0.0.9
python-dotenv==1.0.1
pydantic==2.7.1
pydantic-settings==2.3.0
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
anthropic==0.28.0
```

- [ ] **Step 2: Agregar `anthropic_api_key` a Settings**

Reemplazar el contenido de `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"
    app_env: str = "development"
    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 3: Escribir los tests que deben fallar**

Agregar al final de `backend/tests/test_emotions.py`:

```python
def test_emotions_today_returns_latest_emotion(client):
    client.post("/api/v1/auth/register", json={
        "email": "today1@test.com", "password": "Password123!", "full_name": "Hoy Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "today1@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    client.post(
        "/api/v1/emotions/log",
        json={"emotion_key": "nervioso"},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        "/api/v1/emotions/today",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["emotion_key"] == "nervioso"


def test_emotions_today_returns_null_when_no_log_today(client):
    client.post("/api/v1/auth/register", json={
        "email": "today2@test.com", "password": "Password123!", "full_name": "Sin Log", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "today2@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.get(
        "/api/v1/emotions/today",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["emotion_key"] is None
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
cd backend
pytest tests/test_emotions.py::test_emotions_today_returns_latest_emotion tests/test_emotions.py::test_emotions_today_returns_null_when_no_log_today -v
```

Esperado: FAIL con `404 Not Found` (ruta no existe aún).

- [ ] **Step 5: Crear modelo `ChatConversation`**

Crear `backend/app/models/chat_conversation.py`:

```python
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    emotion_key: Mapped[str] = mapped_column(String(50), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User")
    messages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="conversation")
```

- [ ] **Step 6: Crear modelo `ChatMessage`**

Crear `backend/app/models/chat_message.py`:

```python
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chat_conversations.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    conversation: Mapped["ChatConversation"] = relationship(
        "ChatConversation", back_populates="messages"
    )

    __table_args__ = (
        Index("ix_chat_messages_conv_created", "conversation_id", "created_at"),
    )
```

- [ ] **Step 7: Registrar modelos en `main.py`**

Reemplazar `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message

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


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

(El router de chat se agrega en Task 2 una vez creado.)

- [ ] **Step 8: Agregar `get_today_emotion` al servicio de emociones**

Agregar al final de `backend/app/services/emotion_service.py`:

```python
from datetime import timedelta


def get_today_emotion(db: Session, user_id: int) -> str | None:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    log = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user_id, EmotionLog.logged_at >= since)
        .order_by(EmotionLog.logged_at.desc())
        .first()
    )
    return log.emotion_key if log else None
```

Asegurarse de agregar el import de `timezone` en el encabezado del archivo:

```python
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.emotion_log import EmotionLog
from app.schemas.emotions import EmotionOut, EmotionLogRequest
```

- [ ] **Step 9: Agregar schema `EmotionTodayOut`**

Agregar al final de `backend/app/schemas/emotions.py`:

```python
class EmotionTodayOut(BaseModel):
    emotion_key: str | None
```

- [ ] **Step 10: Agregar endpoint `GET /emotions/today` al router**

Reemplazar `backend/app/routers/emotions.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.emotions import EmotionOut, EmotionLogRequest, EmotionLogOut, EmotionTodayOut
from app.services.emotion_service import list_emotions, log_emotion, get_today_emotion

router = APIRouter()


@router.get("", response_model=list[EmotionOut])
def get_emotions():
    return list_emotions()


@router.post("/log", response_model=EmotionLogOut, status_code=201)
def log_emotion_endpoint(
    data: EmotionLogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return log_emotion(db, current_user.id, data)


@router.get("/today", response_model=EmotionTodayOut)
def get_today_emotion_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = get_today_emotion(db, current_user.id)
    return EmotionTodayOut(emotion_key=key)
```

- [ ] **Step 11: Ejecutar los tests y verificar que pasan**

```bash
cd backend
pytest tests/test_emotions.py -v
```

Esperado: 6/6 PASS (4 anteriores + 2 nuevos).

- [ ] **Step 12: Generar migración Alembic**

```bash
cd backend
alembic revision --autogenerate -m "add_chat_tables"
```

Esto genera un archivo en `backend/alembic/versions/`. Abrirlo y verificar que el contenido del `upgrade()` sea aproximadamente:

```python
def upgrade() -> None:
    op.create_table('chat_conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('emotion_key', sa.String(length=50), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_chat_conversations_id', 'id'),
    )
    op.create_table('chat_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['chat_conversations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_chat_messages_conv_created', 'conversation_id', 'created_at'),
        sa.Index('ix_chat_messages_id', 'id'),
    )
```

Si falta algo, agregarlo manualmente antes de continuar.

- [ ] **Step 13: Correr tests completos del backend para verificar que no rompimos nada**

```bash
cd backend
pytest tests/ -v
```

Esperado: 25/25 PASS (23 anteriores + 2 nuevos de emotions/today).

- [ ] **Step 14: Commit**

```bash
cd backend
git add app/models/chat_conversation.py app/models/chat_message.py \
        app/config.py app/main.py requirements.txt \
        app/services/emotion_service.py app/routers/emotions.py \
        app/schemas/emotions.py \
        alembic/versions/ \
        tests/test_emotions.py
git commit -m "feat: modelos ChatConversation/ChatMessage, migración, endpoint /emotions/today"
```

---

## Task 2: Backend — Servicio de Chat y Router

**Files:**
- Create: `backend/app/schemas/chat.py`
- Create: `backend/app/services/chat_service.py`
- Create: `backend/app/routers/chat.py`
- Create: `backend/tests/test_chat.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `ChatConversation`, `ChatMessage` (de Task 1)
- Consumes: `settings.anthropic_api_key` (de Task 1)
- Consumes: `get_current_user` dependency, `get_db` dependency
- Produces: `POST /api/v1/chat/start` → `ChatStartOut`
- Produces: `POST /api/v1/chat/{id}/message` → `ChatMessageOut`
- Produces: `GET /api/v1/chat/history` → `list[ChatHistoryItem]`
- Produces: `GET /api/v1/chat/{id}` → `ChatConversationOut`

- [ ] **Step 1: Crear schemas de chat**

Crear `backend/app/schemas/chat.py`:

```python
from datetime import datetime
from pydantic import BaseModel


class ChatStartRequest(BaseModel):
    emotion_key: str


class ChatStartOut(BaseModel):
    conversation_id: int
    message: str
    options: list[str]
    lumi_state: str


class ChatMessageRequest(BaseModel):
    content: str


class ChatMessageOut(BaseModel):
    message: str
    options: list[str]
    lumi_state: str
    ended: bool


class ChatHistoryItem(BaseModel):
    conversation_id: int
    emotion_key: str
    started_at: datetime
    ended_at: datetime | None
    message_count: int

    model_config = {"from_attributes": True}


class ChatMessageItem(BaseModel):
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatConversationOut(BaseModel):
    conversation_id: int
    emotion_key: str
    messages: list[ChatMessageItem]
```

- [ ] **Step 2: Escribir los tests que deben fallar**

Crear `backend/tests/test_chat.py`:

```python
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient


def _register_and_login(client, email="chat@test.com"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Chat Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return login.json()["access_token"]


def _make_anthropic_mock(message="Hola, ¿cómo estás?", options=None, lumi_state="happy"):
    if options is None:
        options = ["Bien", "Regular", "Quiero hablar", "Terminar"]
    mock_tool = MagicMock()
    mock_tool.type = "tool_use"
    mock_tool.input = {"message": message, "options": options, "lumi_state": lumi_state}
    mock_resp = MagicMock()
    mock_resp.content = [mock_tool]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_resp
    return mock_client


def test_chat_start_creates_conversation_and_returns_lumi_message(client):
    token = _register_and_login(client, "start1@test.com")
    mock_anthropic = _make_anthropic_mock("Hola, veo que hoy te sentiste nervioso.")

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        response = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "nervioso"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 201
    data = response.json()
    assert "conversation_id" in data
    assert data["message"] == "Hola, veo que hoy te sentiste nervioso."
    assert len(data["options"]) >= 3
    assert "Terminar" in data["options"]
    assert data["lumi_state"] in ("happy", "thinking", "encouraging", "idle")


def test_chat_start_passes_emotion_key_to_anthropic(client):
    token = _register_and_login(client, "start2@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "frustrado"},
            headers={"Authorization": f"Bearer {token}"},
        )

    call_kwargs = mock_anthropic.messages.create.call_args
    system_prompt = call_kwargs.kwargs.get("system") or call_kwargs.args[0] if call_kwargs.args else ""
    assert "frustrado" in system_prompt


def test_send_message_saves_both_messages_and_returns_response(client):
    token = _register_and_login(client, "msg1@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "feliz"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]

        mock_anthropic2 = _make_anthropic_mock("¡Qué bueno escuchar eso!", lumi_state="encouraging")
        with patch("app.services.chat_service.anthropic_client", mock_anthropic2):
            response = client.post(
                f"/api/v1/chat/{conv_id}/message",
                json={"content": "Bien"},
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "¡Qué bueno escuchar eso!"
    assert data["ended"] is False

    conv_response = client.get(
        f"/api/v1/chat/{conv_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    messages = conv_response.json()["messages"]
    roles = [m["role"] for m in messages]
    assert roles.count("assistant") >= 2
    assert roles.count("user") >= 1


def test_send_message_on_closed_conversation_returns_409(client):
    token = _register_and_login(client, "closed1@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "cansado"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]
        client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Terminar"},
            headers={"Authorization": f"Bearer {token}"},
        )
        response = client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Hola de nuevo"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 409


def test_send_message_on_other_users_conversation_returns_404(client):
    token1 = _register_and_login(client, "owner@test.com")
    token2 = _register_and_login(client, "other@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "confundido"},
            headers={"Authorization": f"Bearer {token1}"},
        )
        conv_id = start.json()["conversation_id"]

        response = client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Hola"},
            headers={"Authorization": f"Bearer {token2}"},
        )

    assert response.status_code == 404


def test_get_history_returns_last_10_conversations(client):
    token = _register_and_login(client, "history@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        for i in range(3):
            client.post(
                "/api/v1/chat/start",
                json={"emotion_key": "feliz"},
                headers={"Authorization": f"Bearer {token}"},
            )

    response = client.get(
        "/api/v1/chat/history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert "conversation_id" in data[0]
    assert "emotion_key" in data[0]
    assert "message_count" in data[0]


def test_get_conversation_returns_all_messages(client):
    token = _register_and_login(client, "getconv@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "nervioso"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]

    response = client.get(
        f"/api/v1/chat/{conv_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["conversation_id"] == conv_id
    assert data["emotion_key"] == "nervioso"
    assert len(data["messages"]) >= 1
    assert data["messages"][0]["role"] == "assistant"
```

- [ ] **Step 3: Verificar que los tests fallan**

```bash
cd backend
pytest tests/test_chat.py -v
```

Esperado: todos fallan con `404` (router no existe aún).

- [ ] **Step 4: Crear el servicio de chat**

Crear `backend/app/services/chat_service.py`:

```python
import anthropic
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.config import settings
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage

MAX_MESSAGES = 30

RESPOND_TOOL = {
    "name": "respond_to_child",
    "description": "Responde al niño con un mensaje y opciones de respuesta.",
    "input_schema": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "Mensaje de Lumi (máx. 3 oraciones cortas)",
            },
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 4,
                "description": "Opciones de respuesta. La última siempre es 'Terminar'.",
            },
            "lumi_state": {
                "type": "string",
                "enum": ["happy", "thinking", "encouraging", "idle"],
            },
        },
        "required": ["message", "options", "lumi_state"],
    },
}

SYSTEM_PROMPT_TEMPLATE = (
    "Eres Lumi, un búho amigable y paciente que acompaña a niños y adolescentes "
    "(8-17 años) en su aprendizaje social y emocional.\n\n"
    "PERSONALIDAD: cálida, calmada, alentadora. Nunca sarcástica, nunca clínica.\n\n"
    "REGLAS:\n"
    "- Responde siempre en español latinoamericano\n"
    "- Frases cortas y simples (máximo 3 oraciones por mensaje)\n"
    "- Jamás uses términos médicos, diagnósticos ni clínicos\n"
    "- Mantén el tema relacionado a la emoción inicial o lo que el niño elija\n"
    "- Si el niño expresa angustia severa o peligro, responde: "
    "'Eso suena muy importante. ¿Podés contarle a un adulto de confianza cómo te sentís?'\n"
    "- La última opción de respuesta SIEMPRE es 'Terminar'\n"
    "- Usa la herramienta respond_to_child para cada respuesta\n\n"
    "CONTEXTO DE HOY: El niño se siente {emotion_key}."
)

# Singleton — se parchea en tests con unittest.mock.patch
anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _build_messages(emotion_key: str, db_messages: list[ChatMessage]) -> list[dict]:
    # Anthropic requires conversations to start with 'user'.
    # The kickoff message is synthetic and never stored in the DB.
    msgs: list[dict] = [
        {"role": "user", "content": f"Hola Lumi, hoy me siento {emotion_key}."}
    ]
    for m in db_messages:
        msgs.append({"role": m.role, "content": m.content})
    return msgs


def _call_anthropic(emotion_key: str, db_messages: list[ChatMessage]) -> dict:
    system = SYSTEM_PROMPT_TEMPLATE.format(emotion_key=emotion_key)
    messages = _build_messages(emotion_key, db_messages)
    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=system,
        tools=[RESPOND_TOOL],
        tool_choice={"type": "tool", "name": "respond_to_child"},
        messages=messages,
    )
    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


def start_conversation(db: Session, user_id: int, emotion_key: str) -> dict:
    conv = ChatConversation(user_id=user_id, emotion_key=emotion_key)
    db.add(conv)
    db.flush()

    lumi_resp = _call_anthropic(emotion_key, [])

    db.add(ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=lumi_resp["message"],
    ))
    db.commit()
    db.refresh(conv)

    return {
        "conversation_id": conv.id,
        "message": lumi_resp["message"],
        "options": lumi_resp["options"],
        "lumi_state": lumi_resp["lumi_state"],
    }


def send_message(db: Session, user_id: int, conversation_id: int, content: str) -> dict:
    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")
    if conv.ended_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La conversación ya terminó.")

    db.add(ChatMessage(conversation_id=conv.id, role="user", content=content))
    db.flush()

    ended = content.strip().lower() == "terminar"

    if ended:
        conv.ended_at = datetime.now(timezone.utc)
        lumi_resp = {
            "message": "¡Fue un gusto conversar con vos! Espero que te haya ayudado. ¡Hasta la próxima!",
            "options": ["Terminar"],
            "lumi_state": "happy",
        }
    else:
        msg_count = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conv.id)
            .count()
        )
        if msg_count >= MAX_MESSAGES:
            conv.ended_at = datetime.now(timezone.utc)
            ended = True
            lumi_resp = {
                "message": "Hemos tenido una charla muy buena. ¡Fue genial hablar con vos hoy!",
                "options": ["Terminar"],
                "lumi_state": "happy",
            }
        else:
            history = (
                db.query(ChatMessage)
                .filter(ChatMessage.conversation_id == conv.id)
                .order_by(ChatMessage.created_at)
                .all()
            )
            lumi_resp = _call_anthropic(conv.emotion_key, history)

    db.add(ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=lumi_resp["message"],
    ))
    db.commit()

    return {
        "message": lumi_resp["message"],
        "options": lumi_resp["options"],
        "lumi_state": lumi_resp["lumi_state"],
        "ended": ended,
    }


def get_history(db: Session, user_id: int) -> list[dict]:
    conversations = (
        db.query(ChatConversation)
        .filter(ChatConversation.user_id == user_id)
        .order_by(ChatConversation.started_at.desc())
        .limit(10)
        .all()
    )
    result = []
    for conv in conversations:
        count = db.query(ChatMessage).filter(ChatMessage.conversation_id == conv.id).count()
        result.append({
            "conversation_id": conv.id,
            "emotion_key": conv.emotion_key,
            "started_at": conv.started_at,
            "ended_at": conv.ended_at,
            "message_count": count,
        })
    return result


def get_conversation(db: Session, user_id: int, conversation_id: int) -> dict:
    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return {
        "conversation_id": conv.id,
        "emotion_key": conv.emotion_key,
        "messages": [
            {"role": m.role, "content": m.content, "created_at": m.created_at}
            for m in messages
        ],
    }
```

- [ ] **Step 5: Crear el router de chat**

Crear `backend/app/routers/chat.py`:

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.chat import (
    ChatStartRequest, ChatStartOut,
    ChatMessageRequest, ChatMessageOut,
    ChatHistoryItem, ChatConversationOut,
)
from app.services import chat_service

router = APIRouter()


@router.post("/start", response_model=ChatStartOut, status_code=status.HTTP_201_CREATED)
def start_chat(
    data: ChatStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chat_service.start_conversation(db, current_user.id, data.emotion_key)


@router.post("/{conversation_id}/message", response_model=ChatMessageOut)
def send_chat_message(
    conversation_id: int,
    data: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chat_service.send_message(db, current_user.id, conversation_id, data.content)


@router.get("/history", response_model=list[ChatHistoryItem])
def get_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chat_service.get_history(db, current_user.id)


@router.get("/{conversation_id}", response_model=ChatConversationOut)
def get_chat_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chat_service.get_conversation(db, current_user.id, conversation_id)
```

- [ ] **Step 6: Registrar el router de chat en `main.py`**

Agregar al final de los imports y del include en `backend/app/main.py`:

```python
# Al inicio, agregar:
from app.routers import auth, emotions, scenarios, chat

# Al final de los include_router, agregar:
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
```

El archivo completo queda:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios, chat
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message

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


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

- [ ] **Step 7: Ejecutar los tests de chat y verificar que pasan**

```bash
cd backend
pytest tests/test_chat.py -v
```

Esperado: 7/7 PASS.

- [ ] **Step 8: Ejecutar todos los tests del backend**

```bash
cd backend
pytest tests/ -v
```

Esperado: 32/32 PASS (25 anteriores + 7 nuevos de chat).

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/chat.py \
        backend/app/services/chat_service.py \
        backend/app/routers/chat.py \
        backend/app/main.py \
        backend/tests/test_chat.py
git commit -m "feat: servicio y router de chat IA con integración Anthropic (tool_use)"
```

---

## Task 3: Frontend — Componentes ChatBubble y ChatOptions

**Files:**
- Create: `frontend/src/components/chat/ChatBubble.jsx`
- Create: `frontend/src/components/chat/ChatOptions.jsx`

**Interfaces:**
- Produces: `<ChatBubble role="assistant|user" content="..." />` — burbuja de mensaje
- Produces: `<ChatOptions options={[...]} onSelect={fn} disabled={bool} />` — grid de botones de respuesta

Nota: estos componentes son presentacionales puros — no tienen tests propios. Sus tests vienen integrados en `ChatIA.test.jsx` (Task 4).

- [ ] **Step 1: Crear `ChatBubble.jsx`**

Crear `frontend/src/components/chat/ChatBubble.jsx`:

```jsx
import { motion } from 'framer-motion'

export function ChatBubble({ role, content }) {
  const isLumi = role === 'assistant'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isLumi ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`
          max-w-[80%] px-5 py-4 rounded-3xl text-base leading-relaxed
          ${isLumi
            ? 'bg-primary-50 border-2 border-primary-200 text-text-primary rounded-tl-sm'
            : 'bg-secondary-50 border-2 border-secondary-200 text-text-primary rounded-tr-sm'
          }
        `}
      >
        {content}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Crear `ChatOptions.jsx`**

Crear `frontend/src/components/chat/ChatOptions.jsx`:

```jsx
import { motion } from 'framer-motion'

export function ChatOptions({ options, onSelect, disabled }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option, i) => (
        <motion.button
          key={option}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          whileTap={disabled ? {} : { scale: 0.96 }}
          onClick={() => !disabled && onSelect(option)}
          disabled={disabled}
          className={`
            px-4 py-3 rounded-2xl border-2 text-base font-semibold
            min-h-[44px] text-left transition-colors
            ${disabled
              ? 'opacity-50 cursor-not-allowed border-calm-border bg-calm-surface text-text-muted'
              : 'border-primary-300 bg-white text-text-primary hover:bg-primary-50 hover:border-primary-500 cursor-pointer'
            }
          `}
        >
          {option}
        </motion.button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/chat/ChatBubble.jsx \
        frontend/src/components/chat/ChatOptions.jsx
git commit -m "feat: componentes ChatBubble y ChatOptions"
```

---

## Task 4: Frontend — Página ChatIA, api.js, Router y Dashboard

**Files:**
- Create: `frontend/src/pages/ChatIA.jsx`
- Create: `frontend/src/test/ChatIA.test.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `ChatBubble`, `ChatOptions` (de Task 3)
- Consumes: `LumiCharacter` — `state` prop: `"idle" | "happy" | "thinking" | "encouraging"`
- Consumes: `PageWrapper`, `Button` — componentes existentes
- Consumes: `chatApi.start(emotion_key)`, `chatApi.sendMessage(id, content)` — de `api.js` actualizado
- Consumes: `emotionsApi` — ya existe en `api.js` (sin cambios)
- Ruta: `/chat` → `ProtectedRoute` → `ChatIA`

- [ ] **Step 1: Agregar `chatApi` y `emotionsTodayApi` a `api.js`**

Reemplazar `frontend/src/services/api.js`:

```js
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sm_token')
      localStorage.removeItem('sm_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  getMe:    ()     => api.get('/auth/me'),
}

export const emotionsApi = {
  list:  ()    => api.get('/emotions'),
  log:   (key) => api.post('/emotions/log', { emotion_key: key }),
  today: ()    => api.get('/emotions/today'),
}

export const scenariosApi = {
  list:     ()   => api.get('/scenarios'),
  get:      (id) => api.get(`/scenarios/${id}`),
  complete: (id) => api.post(`/scenarios/${id}/complete`),
}

export const chatApi = {
  start:           (emotion_key)  => api.post('/chat/start', { emotion_key }),
  sendMessage:     (id, content)  => api.post(`/chat/${id}/message`, { content }),
  getHistory:      ()             => api.get('/chat/history'),
  getConversation: (id)           => api.get(`/chat/${id}`),
}
```

- [ ] **Step 2: Escribir los tests que deben fallar**

Crear `frontend/src/test/ChatIA.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ChatIA } from '../pages/ChatIA'
import { chatApi, emotionsApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  emotionsApi: {
    today: vi.fn().mockResolvedValue({ data: { emotion_key: 'nervioso' } }),
    list: vi.fn(),
    log: vi.fn(),
  },
  chatApi: {
    start: vi.fn().mockResolvedValue({
      data: {
        conversation_id: 1,
        message: 'Hola, veo que hoy te sentiste nervioso.',
        options: ['Sí, quiero hablar', 'No mucho', 'Otro tema', 'Terminar'],
        lumi_state: 'happy',
      },
    }),
    sendMessage: vi.fn().mockResolvedValue({
      data: {
        message: '¡Gracias por contarme!',
        options: ['Cuéntame más', 'Está bien', 'Terminar'],
        lumi_state: 'encouraging',
        ended: false,
      },
    }),
    getHistory: vi.fn(),
    getConversation: vi.fn(),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

function renderChat() {
  return render(<MemoryRouter><ChatIA /></MemoryRouter>)
}

describe('ChatIA', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    chatApi.start.mockClear()
    chatApi.sendMessage.mockClear()
    emotionsApi.today.mockClear()
  })

  it('muestra el primer mensaje de Lumi al cargar', async () => {
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('Hola, veo que hoy te sentiste nervioso.')).toBeInTheDocument()
    })
  })

  it('muestra los botones de opciones iniciales', async () => {
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('Sí, quiero hablar')).toBeInTheDocument()
      expect(screen.getByText('Terminar')).toBeInTheDocument()
    })
  })

  it('al tocar una opción llama a chatApi.sendMessage con el texto del botón', async () => {
    renderChat()
    await waitFor(() => screen.getByText('Sí, quiero hablar'))
    await userEvent.click(screen.getByText('Sí, quiero hablar'))
    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith(1, 'Sí, quiero hablar')
    })
  })

  it('muestra la respuesta de Lumi después de seleccionar una opción', async () => {
    renderChat()
    await waitFor(() => screen.getByText('Sí, quiero hablar'))
    await userEvent.click(screen.getByText('Sí, quiero hablar'))
    await waitFor(() => {
      expect(screen.getByText('¡Gracias por contarme!')).toBeInTheDocument()
    })
  })

  it('al recibir ended:true navega a /inicio', async () => {
    chatApi.sendMessage.mockResolvedValueOnce({
      data: {
        message: '¡Hasta la próxima!',
        options: ['Terminar'],
        lumi_state: 'happy',
        ended: true,
      },
    })
    renderChat()
    await waitFor(() => screen.getByText('Terminar'))
    await userEvent.click(screen.getByText('Terminar'))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/inicio')
    }, { timeout: 3000 })
  })

  it('error de red muestra mensaje de reintento en español', async () => {
    chatApi.start.mockRejectedValueOnce(new Error('Network Error'))
    renderChat()
    await waitFor(() => {
      expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3: Verificar que los tests fallan**

```bash
cd frontend
npx vitest run src/test/ChatIA.test.jsx
```

Esperado: todos fallan (módulo no existe aún).

- [ ] **Step 4: Crear `ChatIA.jsx`**

Crear `frontend/src/pages/ChatIA.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { emotionsApi, chatApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { ChatBubble } from '../components/chat/ChatBubble'
import { ChatOptions } from '../components/chat/ChatOptions'

export function ChatIA() {
  const navigate = useNavigate()
  const bottomRef = useRef(null)

  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [options, setOptions] = useState([])
  const [lumiState, setLumiState] = useState('happy')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function initChat() {
    setLoading(true)
    setError(null)
    try {
      const todayRes = await emotionsApi.today()
      const emotionKey = todayRes.data.emotion_key ?? 'feliz'
      const startRes = await chatApi.start(emotionKey)
      const { conversation_id, message, options: opts, lumi_state } = startRes.data
      setConversationId(conversation_id)
      setMessages([{ role: 'assistant', content: message }])
      setOptions(opts)
      setLumiState(lumi_state)
    } catch {
      setError('Algo salió mal al iniciar el chat.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(content) {
    setOptions([])
    setSending(true)
    setMessages((prev) => [...prev, { role: 'user', content }])
    setLumiState('thinking')
    try {
      const res = await chatApi.sendMessage(conversationId, content)
      const { message, options: newOpts, lumi_state, ended } = res.data
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])
      setLumiState(lumi_state)
      if (ended) {
        setTimeout(() => navigate('/inicio'), 1500)
      } else {
        setOptions(newOpts)
      }
    } catch {
      setError('Algo salió mal. ¿Intentamos de nuevo?')
      setLumiState('idle')
    } finally {
      setSending(false)
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

  if (error && messages.length === 0) {
    return (
      <PageWrapper className="items-center justify-center px-6">
        <LumiCharacter state="idle" size={90} />
        <p className="text-base text-accent-coral mt-4 text-center">{error}</p>
        <Button onClick={initChat} className="mt-6">
          Reintentar
        </Button>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper className="px-0 py-0">
      <div className="flex flex-col h-screen max-w-lg mx-auto w-full">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 bg-calm-bg border-b border-calm-border shrink-0">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <div className="flex items-center gap-3 flex-1">
            <LumiCharacter state={lumiState} size={48} />
            <h1 className="text-lg font-extrabold text-primary-700">Chat con Lumi</h1>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-primary-50 border-2 border-primary-200 rounded-3xl rounded-tl-sm px-5 py-4">
                <p className="text-base text-text-muted">Lumi está escribiendo...</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Opciones */}
        <div className="px-6 py-4 bg-calm-bg border-t border-calm-border shrink-0">
          {error && messages.length > 0 && (
            <p className="text-base text-accent-coral mb-3 text-center">{error}</p>
          )}
          {options.length > 0 && (
            <ChatOptions
              options={options}
              onSelect={handleSelect}
              disabled={sending}
            />
          )}
        </div>

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 5: Agregar ruta `/chat` al router**

Reemplazar `frontend/src/router/index.jsx`:

```jsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Welcome }         from '../pages/Welcome'
import { Login }           from '../pages/Login'
import { Register }        from '../pages/Register'
import { Dashboard }       from '../pages/Dashboard'
import { EmotionSelector } from '../pages/EmotionSelector'
import { ScenarioList }    from '../pages/ScenarioList'
import { ScenarioFlow }    from '../pages/ScenarioFlow'
import { ChatIA }          from '../pages/ChatIA'

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
])
```

- [ ] **Step 6: Agregar tarjeta "Chat con Lumi" al Dashboard**

Reemplazar la constante `MODULE_CARDS` en `frontend/src/pages/Dashboard.jsx`:

```jsx
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
    desc: 'Próximamente',
    available: false,
    path: null,
  },
]
```

- [ ] **Step 7: Ejecutar los tests de ChatIA**

```bash
cd frontend
npx vitest run src/test/ChatIA.test.jsx
```

Esperado: 6/6 PASS.

- [ ] **Step 8: Ejecutar todos los tests del frontend**

```bash
cd frontend
npx vitest run
```

Esperado: 18/18 PASS (12 anteriores + 6 nuevos de ChatIA).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ChatIA.jsx \
        frontend/src/test/ChatIA.test.jsx \
        frontend/src/services/api.js \
        frontend/src/router/index.jsx \
        frontend/src/pages/Dashboard.jsx \
        frontend/src/components/chat/
git commit -m "feat: ChatIA page completa — burbujas, opciones, api, router, Dashboard"
```

---

## Verificación final

Después de completar las 4 tareas, correr la suite completa:

```bash
# Backend
cd backend && pytest tests/ -v
# Esperado: 32/32 PASS

# Frontend
cd frontend && npx vitest run
# Esperado: 18/18 PASS
```

Verificar también que `ANTHROPIC_API_KEY=sk-ant-...` está en `backend/.env` (sin comillas) antes de levantar el stack con Docker.
