# SocialMind Etapa 4 — Zona de Calma: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo "Zona de Calma" con tres actividades de regulación emocional (respiración guiada, temporizador visual y frase de Lumi), persistencia de sesiones en backend y activación de la tarjeta en el Dashboard.

**Architecture:** Una sola ruta `/calma` → `ZonaCalma.jsx` maneja `activeActivity` como estado local; cuando `null` muestra las tres tarjetas con sugerencia de Lumi, cuando está seteado renderiza el componente de actividad correspondiente. Al completar (o salir antes), el frontend guarda la sesión en backend y vuelve a las tarjetas. Lumi genera la frase calmante vía `POST /calma/phrase` → Anthropic (texto libre, sin tool_use).

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Alembic + Anthropic SDK (`anthropic==0.28.0`) / React + Framer Motion + Vitest + Testing Library

## Global Constraints

- Texto visible al usuario: mínimo `text-base` — nunca `text-sm` ni menor
- Elementos interactivos: `min-h-[44px]`
- Clases Tailwind: siempre estáticas en el código fuente — sin concatenación con variables en runtime (Tailwind JIT)
- Idioma: español latinoamericano en todo texto visible
- Sin lenguaje clínico, médico ni diagnóstico
- API keys: solo en `.env` backend — nunca en código ni frontend
- Modelo Anthropic: exactamente `claude-haiku-4-5-20251001`
- Tests backend: pytest + SQLite in-memory (StaticPool, vía conftest.py existente)
- Tests frontend: Vitest + Testing Library + `vi.mock` para todas las llamadas API
- Animaciones: suaves, sin flashes ni movimientos bruscos

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| CREAR | `backend/app/models/calm_session.py` | Modelo ORM CalmSession |
| CREAR | `backend/alembic/versions/xxxx_add_calm_sessions.py` | Migración tabla calm_sessions |
| CREAR | `backend/app/schemas/calm.py` | Schemas Pydantic request/response |
| CREAR | `backend/app/services/calm_service.py` | Lógica de negocio + Anthropic |
| CREAR | `backend/app/routers/calm.py` | Endpoints REST /calma |
| MODIFICAR | `backend/app/main.py` | Registrar router + import modelo |
| MODIFICAR | `backend/app/models/__init__.py` | Exportar CalmSession para Alembic |
| CREAR | `backend/tests/test_calm.py` | Tests backend (6 tests) |
| CREAR | `frontend/src/components/calma/BreathingExercise.jsx` | Círculo animado respiración |
| CREAR | `frontend/src/components/calma/VisualTimer.jsx` | Temporizador SVG 3 min |
| CREAR | `frontend/src/components/calma/LumiPhrase.jsx` | Frase IA de Lumi |
| CREAR | `frontend/src/pages/ZonaCalma.jsx` | Página principal + orquestación |
| MODIFICAR | `frontend/src/services/api.js` | Agregar calmApi |
| MODIFICAR | `frontend/src/router/index.jsx` | Agregar ruta /calma |
| MODIFICAR | `frontend/src/pages/Dashboard.jsx` | Activar tarjeta Zona de calma |
| CREAR | `frontend/src/test/ZonaCalma.test.jsx` | Tests frontend (6 tests) |

---

## Task 1: Backend — CalmSession, migración y endpoints /calma

**Files:**
- Create: `backend/app/models/calm_session.py`
- Create: `backend/alembic/versions/xxxx_add_calm_sessions.py` (via autogenerate)
- Create: `backend/app/schemas/calm.py`
- Create: `backend/app/services/calm_service.py`
- Create: `backend/app/routers/calm.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_calm.py`

**Interfaces:**
- Produces: `calm_service.save_session(db, user_id, activity_type, duration_seconds, emotion_key) -> CalmSession`
- Produces: `calm_service.generate_phrase(emotion_key) -> str`
- Produces: `POST /api/v1/calma/session` → 201 `CalmSessionOut`
- Produces: `POST /api/v1/calma/phrase` → 200 `CalmPhraseOut`
- Produces: `anthropic_calm_client` — singleton en `calm_service.py` (parcheable en tests)

- [ ] **Step 1: Escribir tests que fallan**

Crear `backend/tests/test_calm.py`:

```python
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient


def _register_and_login(client, email="calm@test.com"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Calm Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return login.json()["access_token"]


def _make_phrase_mock(phrase="Todo va a estar bien."):
    mock_content = MagicMock()
    mock_content.text = phrase
    mock_resp = MagicMock()
    mock_resp.content = [mock_content]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_resp
    return mock_client


def test_save_session_creates_record(client):
    token = _register_and_login(client, "calm1@test.com")
    response = client.post(
        "/api/v1/calma/session",
        json={"activity_type": "respirar", "duration_seconds": 40, "emotion_key": "nervioso"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["activity_type"] == "respirar"
    assert data["duration_seconds"] == 40
    assert data["emotion_key"] == "nervioso"
    assert "id" in data
    assert "created_at" in data


def test_save_session_invalid_activity_type_returns_422(client):
    token = _register_and_login(client, "calm2@test.com")
    response = client.post(
        "/api/v1/calma/session",
        json={"activity_type": "descanso", "duration_seconds": 10, "emotion_key": "feliz"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_save_session_unauthenticated_returns_401(client):
    response = client.post(
        "/api/v1/calma/session",
        json={"activity_type": "pausa", "duration_seconds": 60, "emotion_key": "cansado"},
    )
    assert response.status_code == 401


def test_get_phrase_returns_lumi_phrase(client):
    token = _register_and_login(client, "calm3@test.com")
    mock_anthropic = _make_phrase_mock("Respira despacio y todo mejora.")

    with patch("app.services.calm_service.anthropic_calm_client", mock_anthropic):
        response = client.post(
            "/api/v1/calma/phrase",
            json={"emotion_key": "nervioso"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["phrase"] == "Respira despacio y todo mejora."


def test_get_phrase_anthropic_failure_returns_fallback(client):
    token = _register_and_login(client, "calm4@test.com")
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API error")

    with patch("app.services.calm_service.anthropic_calm_client", mock_client):
        response = client.post(
            "/api/v1/calma/phrase",
            json={"emotion_key": "triste"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["phrase"] == "Estás bien. Respira. Todo va a estar bien."


def test_get_phrase_unauthenticated_returns_401(client):
    response = client.post(
        "/api/v1/calma/phrase",
        json={"emotion_key": "feliz"},
    )
    assert response.status_code == 401
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd backend
python -m pytest tests/test_calm.py -v
```

Esperado: 6 FAILED (ImportError o 404/422)

- [ ] **Step 3: Crear modelo CalmSession**

Crear `backend/app/models/calm_session.py`:

```python
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CalmSession(Base):
    __tablename__ = "calm_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    emotion_key: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user: Mapped["User"] = relationship("User")

    __table_args__ = (Index("ix_calm_sessions_user_created", "user_id", "created_at"),)
```

- [ ] **Step 4: Actualizar `backend/app/models/__init__.py`**

Reemplazar contenido completo:

```python
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.scenario_completion import ScenarioCompletion
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.calm_session import CalmSession

__all__ = [
    "User", "UserRole", "ChildProfile",
    "EmotionLog", "ScenarioCompletion",
    "ChatConversation", "ChatMessage",
    "CalmSession",
]
```

- [ ] **Step 5: Actualizar `backend/app/main.py`**

Reemplazar contenido completo:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios, chat, calm
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message
import app.models.calm_session

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


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

- [ ] **Step 6: Crear schemas**

Crear `backend/app/schemas/calm.py`:

```python
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, field_validator


class CalmSessionRequest(BaseModel):
    activity_type: Literal['respirar', 'pausa', 'frase']
    duration_seconds: int
    emotion_key: str

    @field_validator('duration_seconds')
    @classmethod
    def duration_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError('duration_seconds must be >= 0')
        return v

    @field_validator('emotion_key')
    @classmethod
    def emotion_key_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('emotion_key cannot be empty')
        return v


class CalmSessionOut(BaseModel):
    id: int
    activity_type: str
    duration_seconds: int
    emotion_key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CalmPhraseRequest(BaseModel):
    emotion_key: str


class CalmPhraseOut(BaseModel):
    phrase: str
```

- [ ] **Step 7: Crear servicio**

Crear `backend/app/services/calm_service.py`:

```python
import anthropic
from sqlalchemy.orm import Session
from app.config import settings
from app.models.calm_session import CalmSession

anthropic_calm_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

PHRASE_SYSTEM = (
    "Eres Lumi, un búho amigable y calmado. "
    "Genera UNA sola frase corta y calmante (máximo 15 palabras) "
    "para un niño de 8-17 años. "
    "Solo la frase, sin comillas, sin saludo, en español latinoamericano."
)

FALLBACK_PHRASE = "Estás bien. Respira. Todo va a estar bien."


def save_session(
    db: Session,
    user_id: int,
    activity_type: str,
    duration_seconds: int,
    emotion_key: str,
) -> CalmSession:
    session = CalmSession(
        user_id=user_id,
        activity_type=activity_type,
        duration_seconds=duration_seconds,
        emotion_key=emotion_key,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def generate_phrase(emotion_key: str) -> str:
    try:
        response = anthropic_calm_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
            system=PHRASE_SYSTEM,
            messages=[{"role": "user", "content": f"Me siento {emotion_key}."}],
        )
        if response.content:
            return response.content[0].text.strip()
        return FALLBACK_PHRASE
    except Exception:
        return FALLBACK_PHRASE
```

- [ ] **Step 8: Crear router**

Crear `backend/app/routers/calm.py`:

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.calm import CalmSessionRequest, CalmSessionOut, CalmPhraseRequest, CalmPhraseOut
from app.services import calm_service

router = APIRouter()


@router.post("/session", response_model=CalmSessionOut, status_code=status.HTTP_201_CREATED)
def save_calm_session(
    data: CalmSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return calm_service.save_session(
        db, current_user.id, data.activity_type, data.duration_seconds, data.emotion_key
    )


@router.post("/phrase", response_model=CalmPhraseOut)
def get_calm_phrase(
    data: CalmPhraseRequest,
    current_user: User = Depends(get_current_user),
):
    phrase = calm_service.generate_phrase(data.emotion_key)
    return {"phrase": phrase}
```

- [ ] **Step 9: Generar migración Alembic**

```bash
cd backend
alembic revision --autogenerate -m "add_calm_sessions"
```

Verificar que el archivo generado en `alembic/versions/` contiene:
- `down_revision = '7f80cb65752d'`
- `op.create_table('calm_sessions', ...)` con las columnas `id`, `user_id`, `activity_type`, `duration_seconds`, `emotion_key`, `created_at`
- `op.create_index('ix_calm_sessions_user_created', 'calm_sessions', ['user_id', 'created_at'])`

Si `alembic revision --autogenerate` falla por la migración SQLite existente, correr primero:
```bash
alembic stamp 7f80cb65752d
alembic revision --autogenerate -m "add_calm_sessions"
```

- [ ] **Step 10: Correr tests — verificar que pasan**

```bash
cd backend
python -m pytest tests/ -v
```

Esperado: 40 passed (34 anteriores + 6 nuevos)

- [ ] **Step 11: Commit**

```bash
git add backend/app/models/calm_session.py \
        backend/app/models/__init__.py \
        backend/app/main.py \
        backend/app/schemas/calm.py \
        backend/app/services/calm_service.py \
        backend/app/routers/calm.py \
        backend/alembic/versions/ \
        backend/tests/test_calm.py
git commit -m "feat: modelo CalmSession, migración, endpoints /calma (session + phrase)"
```

---

## Task 2: Frontend — Componentes BreathingExercise, VisualTimer, LumiPhrase

**Files:**
- Create: `frontend/src/components/calma/BreathingExercise.jsx`
- Create: `frontend/src/components/calma/VisualTimer.jsx`
- Create: `frontend/src/components/calma/LumiPhrase.jsx`

**Interfaces:**
- Consumes: `LumiCharacter` de `../lumi/LumiCharacter` (estado `'happy'`, `'thinking'`)
- Consumes: `calmApi.getPhrase(emotionKey)` de `../../services/api` — solo en `LumiPhrase`
- Produces: `<BreathingExercise onComplete={fn} />` — llama `fn(durationSeconds: number)` al terminar o salir
- Produces: `<VisualTimer onComplete={fn} />` — llama `fn(durationSeconds: number)` al terminar o salir
- Produces: `<LumiPhrase emotionKey={string} onComplete={fn} />` — llama `fn(0)` al tocar "Listo"

**Nota sobre tests:** Los tres componentes son consumidos y testeados a través de `ZonaCalma.jsx` en Task 3. No requieren tests unitarios propios — la interacción se verifica en integración.

- [ ] **Step 1: Crear BreathingExercise**

Crear `frontend/src/components/calma/BreathingExercise.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const TOTAL_CYCLES = 5
const HALF_CYCLE_MS = 4000
const TOTAL_SECONDS = TOTAL_CYCLES * 8

export function BreathingExercise({ onComplete }) {
  const [phase, setPhase] = useState('inhala')
  const [cycleNum, setCycleNum] = useState(1)
  const startTimeRef = useRef(Date.now())
  const completedRef = useRef(false)
  const phaseRef = useRef('inhala')
  const cycleRef = useRef(1)

  useEffect(() => {
    const interval = setInterval(() => {
      const nextPhase = phaseRef.current === 'inhala' ? 'exhala' : 'inhala'
      phaseRef.current = nextPhase
      setPhase(nextPhase)
      if (nextPhase === 'inhala' && cycleRef.current < TOTAL_CYCLES) {
        cycleRef.current += 1
        setCycleNum(cycleRef.current)
      }
    }, HALF_CYCLE_MS)
    return () => clearInterval(interval)
  }, [])

  function handleDone(seconds) {
    if (completedRef.current) return
    completedRef.current = true
    onComplete(seconds)
  }

  function handleExit() {
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    handleDone(elapsed)
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-8 px-6">
      <p className="text-base text-text-secondary">
        Ciclo {cycleNum} de {TOTAL_CYCLES}
      </p>

      <div className="relative flex items-center justify-center">
        <motion.div
          className="rounded-full"
          animate={{
            scale: [1, 1.4, 1.4, 1],
            backgroundColor: ['#bfdbfe', '#93c5fd', '#93c5fd', '#bfdbfe'],
          }}
          transition={{
            duration: 8,
            times: [0, 0.5, 0.5, 1],
            ease: 'easeInOut',
            repeat: TOTAL_CYCLES - 1,
            repeatType: 'loop',
          }}
          onAnimationComplete={() => handleDone(TOTAL_SECONDS)}
          style={{ width: 180, height: 180 }}
        />
        <div className="absolute flex items-center justify-center">
          <p className="text-xl font-bold text-primary-800">
            {phase === 'inhala' ? 'Inhala...' : 'Exhala...'}
          </p>
        </div>
      </div>

      <p className="text-base text-text-secondary text-center max-w-xs">
        Seguí el círculo con tu respiración.
      </p>

      <button
        onClick={handleExit}
        className="text-base text-primary-600 font-semibold min-h-[44px] px-6 py-2 rounded-2xl border-2 border-primary-300 hover:bg-primary-50"
      >
        Salir
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Crear VisualTimer**

Crear `frontend/src/components/calma/VisualTimer.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'

const TOTAL = 180
const RADIUS = 45
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ≈ 282.74

export function VisualTimer({ onComplete }) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL)
  const startTimeRef = useRef(Date.now())
  const completedRef = useRef(false)

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete(TOTAL)
      }
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, onComplete])

  function handleExit() {
    if (completedRef.current) return
    completedRef.current = true
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    onComplete(elapsed)
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')
  const offset = CIRCUMFERENCE * (1 - secondsLeft / TOTAL)

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-8 px-6">
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        <svg
          width="200"
          height="200"
          viewBox="0 0 100 100"
          className="rotate-[-90deg]"
        >
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="#e0f2fe"
            strokeWidth="8"
          />
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute flex items-center justify-center">
          <span className="text-4xl font-bold text-primary-800">
            {minutes}:{seconds}
          </span>
        </div>
      </div>

      <p className="text-base text-text-secondary text-center">
        Tómate este momento para vos.
      </p>

      <button
        onClick={handleExit}
        className="text-base text-primary-600 font-semibold min-h-[44px] px-6 py-2 rounded-2xl border-2 border-primary-300 hover:bg-primary-50"
      >
        Salir antes
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Crear LumiPhrase**

Crear `frontend/src/components/calma/LumiPhrase.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LumiCharacter } from '../lumi/LumiCharacter'
import { calmApi } from '../../services/api'

const FALLBACK_PHRASE = 'Estás bien. Respira. Todo va a estar bien.'

export function LumiPhrase({ emotionKey, onComplete }) {
  const [phrase, setPhrase] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPhrase() {
      try {
        const res = await calmApi.getPhrase(emotionKey)
        setPhrase(res.data.phrase)
      } catch {
        setPhrase(FALLBACK_PHRASE)
      } finally {
        setLoading(false)
      }
    }
    loadPhrase()
  }, [emotionKey])

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-8 px-6">
      <LumiCharacter state="happy" size={90} />

      {loading ? (
        <p className="text-base text-text-secondary">Lumi está pensando...</p>
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-2xl font-semibold text-text-primary text-center leading-relaxed max-w-sm"
        >
          {phrase}
        </motion.p>
      )}

      {!loading && (
        <button
          onClick={() => onComplete(0)}
          className="text-base font-semibold text-white bg-primary-500 hover:bg-primary-600 min-h-[44px] px-8 py-2 rounded-2xl"
        >
          Listo
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar que no hay errores de lint**

```bash
cd frontend
npx eslint src/components/calma/ --max-warnings 0
```

Esperado: sin errores (0 warnings, 0 errors). Si falla por reglas de linting menores (unused vars, etc.), corregirlas.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/calma/
git commit -m "feat: componentes BreathingExercise, VisualTimer y LumiPhrase"
```

---

## Task 3: Frontend — ZonaCalma page, api, router, Dashboard y tests

**Files:**
- Create: `frontend/src/pages/ZonaCalma.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Test: `frontend/src/test/ZonaCalma.test.jsx`

**Interfaces:**
- Consumes (Task 2): `<BreathingExercise onComplete={fn} />`, `<VisualTimer onComplete={fn} />`, `<LumiPhrase emotionKey={str} onComplete={fn} />`
- Consumes: `emotionsApi.today()` → `{ data: { emotion_key: string | null } }`
- Consumes: `calmApi.saveSession(activityType, durationSeconds, emotionKey)` → Promise
- Consumes: `calmApi.getPhrase(emotionKey)` → `{ data: { phrase: string } }` — lo consume LumiPhrase internamente
- La tarjeta del Dashboard usa `available: true, path: '/calma'`

- [ ] **Step 1: Escribir tests que fallan**

Crear `frontend/src/test/ZonaCalma.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ZonaCalma } from '../pages/ZonaCalma'
import { calmApi, emotionsApi } from '../services/api'

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
  calmApi: {
    saveSession: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    getPhrase: vi.fn().mockResolvedValue({ data: { phrase: 'Respira y todo mejora.' } }),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi: { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

function renderCalma() {
  return render(<MemoryRouter><ZonaCalma /></MemoryRouter>)
}

describe('ZonaCalma', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    calmApi.saveSession.mockClear()
    calmApi.getPhrase.mockClear()
    emotionsApi.today.mockClear()
  })

  it('muestra 3 tarjetas de actividad al cargar', async () => {
    renderCalma()
    await waitFor(() => {
      expect(screen.getByText('Respirar')).toBeInTheDocument()
      expect(screen.getByText('Pausar')).toBeInTheDocument()
      expect(screen.getByText('Frase de Lumi')).toBeInTheDocument()
    })
  })

  it('tarjeta sugerida tiene clase border-primary-500 cuando emocion es nervioso', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Respirar'))
    const respirarBtn = screen.getByText('Respirar').closest('button')
    expect(respirarBtn).toHaveClass('border-primary-500')
  })

  it('click en Pausar muestra el temporizador visual', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => {
      expect(screen.getByText('Salir antes')).toBeInTheDocument()
    })
  })

  it('al salir del timer llama a calmApi.saveSession con activity pausa', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => {
      expect(calmApi.saveSession).toHaveBeenCalledWith('pausa', expect.any(Number), 'nervioso')
    })
  })

  it('click en Frase de Lumi llama a calmApi.getPhrase con emotion_key correcto', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Frase de Lumi'))
    await userEvent.click(screen.getByText('Frase de Lumi'))
    await waitFor(() => {
      expect(calmApi.getPhrase).toHaveBeenCalledWith('nervioso')
    })
  })

  it('error en getPhrase muestra frase de fallback', async () => {
    calmApi.getPhrase.mockRejectedValueOnce(new Error('Network'))
    renderCalma()
    await waitFor(() => screen.getByText('Frase de Lumi'))
    await userEvent.click(screen.getByText('Frase de Lumi'))
    await waitFor(() => {
      expect(
        screen.getByText('Estás bien. Respira. Todo va a estar bien.')
      ).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd frontend
npx vitest run src/test/ZonaCalma.test.jsx
```

Esperado: 6 FAILED (ZonaCalma not found o imports que no existen)

- [ ] **Step 3: Agregar `calmApi` a `api.js`**

En `frontend/src/services/api.js`, al final del archivo (después de `chatApi`), agregar:

```js
export const calmApi = {
  saveSession: (activity_type, duration_seconds, emotion_key) =>
    api.post('/calma/session', { activity_type, duration_seconds, emotion_key }),
  getPhrase: (emotion_key) =>
    api.post('/calma/phrase', { emotion_key }),
}
```

- [ ] **Step 4: Crear ZonaCalma.jsx**

Crear `frontend/src/pages/ZonaCalma.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { emotionsApi, calmApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { BreathingExercise } from '../components/calma/BreathingExercise'
import { VisualTimer } from '../components/calma/VisualTimer'
import { LumiPhrase } from '../components/calma/LumiPhrase'

function getSuggestion(emotionKey) {
  if (['nervioso', 'frustrado', 'enojado'].includes(emotionKey)) return 'respirar'
  if (['cansado', 'confundido', 'triste'].includes(emotionKey)) return 'pausa'
  return 'frase'
}

const ACTIVITIES = [
  { id: 'respirar', emoji: '🌬️', label: 'Respirar',      desc: 'Respiración guiada suave' },
  { id: 'pausa',    emoji: '⏸️', label: 'Pausar',         desc: '3 minutos de descanso' },
  { id: 'frase',    emoji: '🦉', label: 'Frase de Lumi',  desc: 'Una frase para vos' },
]

export function ZonaCalma() {
  const navigate = useNavigate()
  const [emotionKey, setEmotionKey]         = useState('feliz')
  const [activeActivity, setActiveActivity] = useState(null)
  const [loading, setLoading]               = useState(true)

  useEffect(() => {
    async function loadEmotion() {
      try {
        const res = await emotionsApi.today()
        setEmotionKey(res.data.emotion_key ?? 'feliz')
      } catch {
        // fallback 'feliz' already set
      } finally {
        setLoading(false)
      }
    }
    loadEmotion()
  }, [])

  async function handleComplete(durationSeconds) {
    try {
      await calmApi.saveSession(activeActivity, durationSeconds, emotionKey)
    } catch {
      // session loss is acceptable — don't block the child
    }
    setActiveActivity(null)
  }

  const suggestion = getSuggestion(emotionKey)

  if (loading) {
    return (
      <PageWrapper className="items-center justify-center">
        <LumiCharacter state="thinking" size={90} />
        <p className="text-base text-text-secondary mt-4">Cargando...</p>
      </PageWrapper>
    )
  }

  if (activeActivity) {
    return (
      <PageWrapper className="px-0 py-0">
        <div className="flex flex-col min-h-screen max-w-lg mx-auto w-full">
          <div className="flex items-center gap-4 px-6 py-4 bg-calm-bg border-b border-calm-border shrink-0">
            <button
              onClick={() => setActiveActivity(null)}
              className="text-primary-600 text-base font-bold min-h-[44px] px-2"
              aria-label="Volver a las actividades"
            >
              ← Volver
            </button>
            <LumiCharacter state="happy" size={48} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            {activeActivity === 'respirar' && (
              <BreathingExercise onComplete={handleComplete} />
            )}
            {activeActivity === 'pausa' && (
              <VisualTimer onComplete={handleComplete} />
            )}
            {activeActivity === 'frase' && (
              <LumiPhrase emotionKey={emotionKey} onComplete={handleComplete} />
            )}
          </div>
        </div>
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
          <h1 className="text-xl font-extrabold text-primary-700">Zona de calma</h1>
        </div>

        <div className="flex items-start gap-4 bg-primary-50 border-2 border-primary-200 rounded-3xl p-5">
          <LumiCharacter state="happy" size={64} />
          <p className="text-base text-text-primary leading-relaxed">
            Hoy te sentiste <strong>{emotionKey}</strong>. Te sugiero que pruebes{' '}
            <strong>{ACTIVITIES.find((a) => a.id === suggestion)?.label}</strong>.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {ACTIVITIES.map((activity, i) => (
            <motion.button
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setActiveActivity(activity.id)}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left min-h-[44px] transition-colors
                ${activity.id === suggestion
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-calm-border bg-white hover:border-primary-300 hover:bg-primary-50'
                }`}
            >
              <span className="text-3xl">{activity.emoji}</span>
              <div>
                <p className="text-base font-bold text-text-primary">{activity.label}</p>
                <p className="text-base text-text-secondary">{activity.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 5: Agregar ruta `/calma` al router**

En `frontend/src/router/index.jsx`:

1. Agregar import al bloque de imports de páginas:
```jsx
import { ZonaCalma } from '../pages/ZonaCalma'
```

2. Agregar ruta después de la ruta `/chat`:
```jsx
{
  path: '/calma',
  element: <ProtectedRoute><ZonaCalma /></ProtectedRoute>,
},
```

- [ ] **Step 6: Activar tarjeta en Dashboard**

En `frontend/src/pages/Dashboard.jsx`, localizar la entrada de `MODULE_CARDS` con `title: 'Zona de calma'` y reemplazarla:

```js
// ANTES:
{
  emoji: '🧘',
  title: 'Zona de calma',
  desc: 'Próximamente',
  available: false,
  path: null,
},

// DESPUÉS:
{
  emoji: '🧘',
  title: 'Zona de calma',
  desc: 'Respira, pausa y calmáte',
  available: true,
  path: '/calma',
},
```

- [ ] **Step 7: Correr tests — verificar que pasan**

```bash
cd frontend
npx vitest run
```

Esperado: 24 passed (18 anteriores + 6 nuevos). Si algún test falla por scrollIntoView, verificar que `frontend/src/test/setup.js` tiene:
```js
window.HTMLElement.prototype.scrollIntoView = function () {}
```

- [ ] **Step 8: Correr suite completa backend para detectar regresiones**

```bash
cd backend
python -m pytest tests/ -v
```

Esperado: 40 passed

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ZonaCalma.jsx \
        frontend/src/services/api.js \
        frontend/src/router/index.jsx \
        frontend/src/pages/Dashboard.jsx \
        frontend/src/test/ZonaCalma.test.jsx
git commit -m "feat: ZonaCalma page — respiración, timer, frase Lumi, integración Dashboard"
```
