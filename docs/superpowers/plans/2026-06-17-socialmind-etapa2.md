# SocialMind Etapa 2 — Selector Emocional y Escenarios Sociales

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo de selector emocional (5 emociones con íconos grandes) y el flujo pedagógico completo de 5 escenarios sociales (objetivo → explicación → práctica → retroalimentación → cierre) con registro de actividad en base de datos.

**Architecture:** El backend agrega dos routers REST: `/api/v1/emotions` y `/api/v1/scenarios`. El contenido de los escenarios está hardcodeado en un servicio Python (no en DB) para simplicidad MVP; solo los registros de actividad (`emotion_logs`, `scenario_completions`) se persisten en PostgreSQL. El frontend añade 3 páginas nuevas (EmotionSelector, ScenarioList, ScenarioFlow) integradas al router y al Dashboard existente. El flujo completo: Dashboard → EmotionSelector → ScenarioList → ScenarioFlow.

**Tech Stack:** FastAPI 0.111, SQLAlchemy 2.0, Alembic, pytest + httpx (backend); React 18, Framer Motion 11, Axios, Vitest + Testing Library (frontend). Misma base que Etapa 1.

## Global Constraints

- Todo el texto visible al usuario: **solo en español** (labels, mensajes de error, contenido de escenarios)
- Sin lenguaje clínico, diagnóstico ni médico en ningún texto
- Paleta exclusiva SocialMind: `bg-primary-500` (#6B9FD4), `bg-secondary-500` (#8BC4A8), `bg-calm-bg` (#F8F6F0), `accent-yellow` (#F4C878) — sin colores Tailwind arbitrarios
- Fuente Nunito, mínimo 16px (`xs` en la escala Tailwind = 16px)
- Botones: mínimo 44×44px touch target (el Button component ya enforza `min-h-[56px]`)
- Personaje Lumi presente en todas las páginas nuevas
- API keys y secretos: solo en `.env`, nunca en código
- Los escenarios NO deben usar lenguaje que haga sentir "mal" al usuario por respuestas incorrectas — retroalimentación siempre positiva y alentadora
- Todos los comandos se ejecutan desde la raíz `C:\Users\distu\socialmind` salvo indicación contraria

---

## Mapa de archivos

```
backend/
├── app/
│   ├── main.py                          ← Modify: add 2 routers + 2 model imports
│   ├── models/
│   │   ├── emotion_log.py               ← Create
│   │   └── scenario_completion.py       ← Create
│   ├── schemas/
│   │   ├── emotions.py                  ← Create
│   │   └── scenarios.py                 ← Create
│   ├── services/
│   │   ├── emotion_service.py           ← Create (hardcoded emotion list)
│   │   └── scenario_service.py          ← Create (hardcoded scenario content)
│   └── routers/
│       ├── emotions.py                  ← Create
│       └── scenarios.py                 ← Create
├── alembic/versions/
│   └── xxxx_add_emotion_scenario_tables.py ← Create via autogenerate
└── tests/
    ├── test_emotions.py                 ← Create
    └── test_scenarios.py               ← Create

frontend/src/
├── pages/
│   ├── EmotionSelector.jsx              ← Create
│   ├── ScenarioList.jsx                 ← Create
│   └── ScenarioFlow.jsx                 ← Create
├── services/
│   └── api.js                          ← Modify: add emotionsApi + scenariosApi
├── pages/
│   └── Dashboard.jsx                   ← Modify: make 2 modules clickable
├── router/
│   └── index.jsx                       ← Modify: add 3 new routes
└── test/
    ├── EmotionSelector.test.jsx         ← Create
    └── ScenarioFlow.test.jsx            ← Create
```

---

### Task 1: Backend — Modelos, Migración y API de Emociones y Escenarios

**Files:**
- Create: `backend/app/models/emotion_log.py`
- Create: `backend/app/models/scenario_completion.py`
- Create: `backend/alembic/versions/xxxx_add_emotion_scenario_tables.py` (via autogenerate)
- Create: `backend/app/schemas/emotions.py`
- Create: `backend/app/schemas/scenarios.py`
- Create: `backend/app/services/emotion_service.py`
- Create: `backend/app/services/scenario_service.py`
- Create: `backend/app/routers/emotions.py`
- Create: `backend/app/routers/scenarios.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_emotions.py`
- Create: `backend/tests/test_scenarios.py`

**Interfaces:**
- Produce: `GET /api/v1/emotions` → `list[EmotionOut]`
- Produce: `POST /api/v1/emotions/log` (auth requerido) → `EmotionLogOut`
- Produce: `GET /api/v1/scenarios` → `list[ScenarioMeta]`
- Produce: `GET /api/v1/scenarios/{scenario_id}` → `ScenarioFull`
- Produce: `POST /api/v1/scenarios/{scenario_id}/complete` (auth requerido) → `ScenarioCompletionOut`

---

- [ ] **Step 1: Crear `backend/app/models/emotion_log.py`**

```python
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class EmotionLog(Base):
    __tablename__ = "emotion_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    emotion_key: Mapped[str] = mapped_column(String(50), nullable=False)
    logged_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user: Mapped["User"] = relationship("User")
```

- [ ] **Step 2: Crear `backend/app/models/scenario_completion.py`**

```python
from datetime import datetime, timezone
from sqlalchemy import Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ScenarioCompletion(Base):
    __tablename__ = "scenario_completions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    scenario_id: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user: Mapped["User"] = relationship("User")
```

- [ ] **Step 3: Actualizar `backend/app/main.py`**

Reemplazar el contenido completo:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios
import app.models.user          # noqa: ensure models registered for Alembic
import app.models.child_profile  # noqa: ensure models registered for Alembic
import app.models.emotion_log    # noqa: ensure models registered for Alembic
import app.models.scenario_completion  # noqa: ensure models registered for Alembic

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

- [ ] **Step 4: Generar migración Alembic**

```powershell
docker compose exec backend alembic revision --autogenerate -m "add_emotion_scenario_tables"
```

Expected output: `Generating /app/alembic/versions/XXXX_add_emotion_scenario_tables.py ... done`

Verificar el archivo generado — debe contener `create_table('emotion_logs', ...)` y `create_table('scenario_completions', ...)`. Si el autogenerate produce tablas vacías o no las detecta, revisar que los imports en `main.py` del Step 3 estén correctos.

- [ ] **Step 5: Aplicar la migración**

```powershell
docker compose exec backend alembic upgrade head
```

Expected output: `Running upgrade 996b01c63f7f -> XXXX, add_emotion_scenario_tables`

- [ ] **Step 6: Crear `backend/app/schemas/emotions.py`**

```python
from datetime import datetime
from pydantic import BaseModel


class EmotionOut(BaseModel):
    key: str
    label: str
    emoji: str


class EmotionLogRequest(BaseModel):
    emotion_key: str


class EmotionLogOut(BaseModel):
    id: int
    emotion_key: str
    logged_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 7: Crear `backend/app/schemas/scenarios.py`**

```python
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ScenarioOption(BaseModel):
    text: str
    correct: bool


class ScenarioStep(BaseModel):
    type: str   # "objective" | "explanation" | "practice" | "feedback" | "closing"
    lumi_state: str  # "idle" | "thinking" | "happy" | "encouraging"
    title: Optional[str] = None
    text: Optional[str] = None
    question: Optional[str] = None
    options: Optional[list[ScenarioOption]] = None
    badge_emoji: Optional[str] = None


class ScenarioMeta(BaseModel):
    id: int
    emoji: str
    title: str
    description: str


class ScenarioFull(ScenarioMeta):
    steps: list[ScenarioStep]


class ScenarioCompletionOut(BaseModel):
    id: int
    scenario_id: int
    completed_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 8: Crear `backend/app/services/emotion_service.py`**

```python
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.emotion_log import EmotionLog
from app.schemas.emotions import EmotionOut, EmotionLogRequest, EmotionLogOut

VALID_EMOTION_KEYS = {"feliz", "nervioso", "confundido", "frustrado", "cansado"}

EMOTIONS: list[EmotionOut] = [
    EmotionOut(key="feliz",      label="Feliz",      emoji="😊"),
    EmotionOut(key="nervioso",   label="Nervioso",   emoji="😰"),
    EmotionOut(key="confundido", label="Confundido", emoji="🤔"),
    EmotionOut(key="frustrado",  label="Frustrado",  emoji="😤"),
    EmotionOut(key="cansado",    label="Cansado",    emoji="😴"),
]


def list_emotions() -> list[EmotionOut]:
    return EMOTIONS


def log_emotion(db: Session, user_id: int, data: EmotionLogRequest) -> EmotionLog:
    if data.emotion_key not in VALID_EMOTION_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Emoción no reconocida: {data.emotion_key}",
        )
    entry = EmotionLog(user_id=user_id, emotion_key=data.emotion_key)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
```

- [ ] **Step 9: Crear `backend/app/services/scenario_service.py`**

```python
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.scenario_completion import ScenarioCompletion
from app.schemas.scenarios import ScenarioFull, ScenarioMeta, ScenarioStep, ScenarioOption

SCENARIOS_DATA: list[dict] = [
    {
        "id": 1,
        "emoji": "🙋",
        "title": "Saludar",
        "description": "Aprende a saludar a alguien nuevo",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Hoy aprenderemos cómo saludar a alguien. Saludar hace que las personas se sientan bienvenidas."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Cuando quieres saludar a alguien, puedes decir '¡Hola!' y decir tu nombre. Mira a la persona un momento y sonríe."},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Ves a un compañero en el pasillo. ¿Qué haces?",
             "options": [
                 {"text": "Digo ¡Hola! y mi nombre",         "correct": True},
                 {"text": "Paso sin decir nada",              "correct": False},
                 {"text": "Espero que él hable primero",      "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Muy bien!",
             "text": "Saludar primero demuestra que eres amable y amigable. ¡Las personas se sienten felices cuando las saludas!"},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Lo lograste!",
             "text": "Ya sabes cómo saludar. Practica con alguien hoy. ¡Cada saludo es una nueva amistad posible!", "badge_emoji": "🌟"},
        ],
    },
    {
        "id": 2,
        "emoji": "💬",
        "title": "Hablar con un compañero",
        "description": "Aprende a iniciar una conversación",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Aprenderemos cómo empezar a hablar con alguien. No siempre es fácil, ¡pero tú puedes lograrlo!"},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Para iniciar una conversación, puedes preguntar algo que le interese a la otra persona. Por ejemplo: '¿Qué te gusta hacer?' o '¿Viste alguna película buena últimamente?'"},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Quieres hablar con tu compañero. ¿Qué le dices?",
             "options": [
                 {"text": "¿Qué te gusta hacer en tu tiempo libre?",  "correct": True},
                 {"text": "No digo nada y espero que él hable",        "correct": False},
                 {"text": "Le hablo solo de lo que me gusta a mí",     "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Perfecto!",
             "text": "Preguntar por los intereses de alguien es una gran forma de hacer amigos. ¡A todos nos gusta que se interesen en nosotros!"},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Excelente trabajo!",
             "text": "Las conversaciones se vuelven más fáciles con la práctica. ¡Inténtalo hoy con alguien!", "badge_emoji": "💬"},
        ],
    },
    {
        "id": 3,
        "emoji": "🙏",
        "title": "Pedir ayuda",
        "description": "Aprende a pedir ayuda cuando la necesitas",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Pedir ayuda no es una debilidad. ¡Es algo muy inteligente! Todos necesitamos ayuda a veces."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Cuando no entiendes algo o necesitas apoyo, puedes decir: '¿Puedes ayudarme con esto?' o '¿Me explicas esta parte, por favor?'"},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "No entiendes una tarea en clase. ¿Qué haces?",
             "options": [
                 {"text": "Le digo al maestro que no entendí y pido explicación", "correct": True},
                 {"text": "Me quedo callado y no hago nada",                       "correct": False},
                 {"text": "Copio la tarea de un compañero",                        "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Muy bien!",
             "text": "Pedir ayuda es una habilidad importante. Muestra que quieres aprender y mejorar."},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Lo lograste!",
             "text": "Recuerda: siempre puedes pedir ayuda. Los maestros y amigos están para apoyarte.", "badge_emoji": "🙏"},
        ],
    },
    {
        "id": 4,
        "emoji": "⏳",
        "title": "Esperar turno",
        "description": "Aprende a esperar pacientemente tu turno",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Cuando esperamos nuestro turno, demostramos respeto por los demás. Hoy aprenderemos cómo hacerlo."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Si quieres decir algo pero alguien más está hablando, espera a que termine. Puedes respirar profundo mientras esperas y pensar en lo que quieres decir."},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Quieres decir algo pero tu amigo está hablando. ¿Qué haces?",
             "options": [
                 {"text": "Espero a que termine y luego hablo",  "correct": True},
                 {"text": "Lo interrumpo porque es urgente",      "correct": False},
                 {"text": "Me frustro y me voy",                  "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Excelente!",
             "text": "Esperar el turno muestra que respetas a los demás. ¡Eso es muy importante para hacer amigos!"},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Fantástico!",
             "text": "Practicar la paciencia se vuelve más fácil cada día. ¡Sigue adelante!", "badge_emoji": "⏳"},
        ],
    },
    {
        "id": 5,
        "emoji": "💪",
        "title": "Manejar la frustración",
        "description": "Aprende qué hacer cuando algo te molesta",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "A veces las cosas no salen como queremos y nos sentimos frustrados. Es normal. Hoy aprenderemos qué hacer."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Cuando te sientas frustrado, puedes: 1) Respirar profundo 3 veces. 2) Alejarte un momento. 3) Decir cómo te sientes con palabras calmadas."},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Un juego no funciona como quieres y sientes que te enojarás. ¿Qué haces?",
             "options": [
                 {"text": "Respiro profundo y me tomo un momento", "correct": True},
                 {"text": "Tiro o golpeo el juego",                 "correct": False},
                 {"text": "Grito de frustración",                   "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Muy bien!",
             "text": "Respirar es una herramienta poderosa. Calma el cuerpo y la mente para que puedas pensar mejor."},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Lo lograste!",
             "text": "Manejar la frustración es una habilidad que te ayudará toda la vida. ¡Eres muy valiente!", "badge_emoji": "💪"},
        ],
    },
]

_SCENARIO_MAP: dict[int, ScenarioFull] = {
    s["id"]: ScenarioFull(
        id=s["id"],
        emoji=s["emoji"],
        title=s["title"],
        description=s["description"],
        steps=[
            ScenarioStep(
                type=step["type"],
                lumi_state=step["lumi_state"],
                title=step.get("title"),
                text=step.get("text"),
                question=step.get("question"),
                options=[ScenarioOption(**o) for o in step["options"]] if "options" in step else None,
                badge_emoji=step.get("badge_emoji"),
            )
            for step in s["steps"]
        ],
    )
    for s in SCENARIOS_DATA
}


def list_scenarios() -> list[ScenarioMeta]:
    return [ScenarioMeta(id=s.id, emoji=s.emoji, title=s.title, description=s.description)
            for s in _SCENARIO_MAP.values()]


def get_scenario(scenario_id: int) -> ScenarioFull:
    scenario = _SCENARIO_MAP.get(scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escenario no encontrado.",
        )
    return scenario


def complete_scenario(db: Session, user_id: int, scenario_id: int) -> ScenarioCompletion:
    if scenario_id not in _SCENARIO_MAP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escenario no encontrado.",
        )
    entry = ScenarioCompletion(user_id=user_id, scenario_id=scenario_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
```

- [ ] **Step 10: Crear `backend/app/routers/emotions.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.emotions import EmotionOut, EmotionLogRequest, EmotionLogOut
from app.services.emotion_service import list_emotions, log_emotion

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
```

- [ ] **Step 11: Crear `backend/app/routers/scenarios.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.scenarios import ScenarioMeta, ScenarioFull, ScenarioCompletionOut
from app.services.scenario_service import list_scenarios, get_scenario, complete_scenario

router = APIRouter()


@router.get("", response_model=list[ScenarioMeta])
def get_scenarios():
    return list_scenarios()


@router.get("/{scenario_id}", response_model=ScenarioFull)
def get_scenario_by_id(scenario_id: int):
    return get_scenario(scenario_id)


@router.post("/{scenario_id}/complete", response_model=ScenarioCompletionOut, status_code=201)
def complete_scenario_endpoint(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return complete_scenario(db, current_user.id, scenario_id)
```

- [ ] **Step 12: Escribir los tests en `backend/tests/test_emotions.py`**

```python
def test_list_emotions(client):
    response = client.get("/api/v1/emotions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    keys = [e["key"] for e in data]
    assert "feliz" in keys
    assert "nervioso" in keys
    assert "confundido" in keys
    assert "frustrado" in keys
    assert "cansado" in keys


def test_log_emotion_authenticated(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@test.com", "password": "Password123!", "full_name": "Padre Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/emotions/log",
        json={"emotion_key": "feliz"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["emotion_key"] == "feliz"
    assert "logged_at" in data


def test_log_emotion_unauthenticated(client):
    response = client.post("/api/v1/emotions/log", json={"emotion_key": "feliz"})
    assert response.status_code == 401


def test_log_emotion_invalid_key(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre2@test.com", "password": "Password123!", "full_name": "Padre 2", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre2@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/emotions/log",
        json={"emotion_key": "enojado_invalido"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
```

- [ ] **Step 13: Escribir los tests en `backend/tests/test_scenarios.py`**

```python
def test_list_scenarios(client):
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    titles = [s["title"] for s in data]
    assert "Saludar" in titles
    assert "Hablar con un compañero" in titles
    assert "Pedir ayuda" in titles
    assert "Esperar turno" in titles
    assert "Manejar la frustración" in titles


def test_get_scenario_detail(client):
    response = client.get("/api/v1/scenarios/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["title"] == "Saludar"
    assert len(data["steps"]) == 5
    step_types = [s["type"] for s in data["steps"]]
    assert step_types == ["objective", "explanation", "practice", "feedback", "closing"]


def test_get_scenario_practice_step_has_options(client):
    response = client.get("/api/v1/scenarios/1")
    data = response.json()
    practice_step = next(s for s in data["steps"] if s["type"] == "practice")
    assert "options" in practice_step
    assert len(practice_step["options"]) == 3
    correct_options = [o for o in practice_step["options"] if o["correct"]]
    assert len(correct_options) == 1


def test_get_scenario_not_found(client):
    response = client.get("/api/v1/scenarios/99")
    assert response.status_code == 404


def test_complete_scenario_authenticated(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre3@test.com", "password": "Password123!", "full_name": "Padre 3", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre3@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/scenarios/1/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["scenario_id"] == 1
    assert "completed_at" in data


def test_complete_scenario_unauthenticated(client):
    response = client.post("/api/v1/scenarios/1/complete")
    assert response.status_code == 401


def test_complete_scenario_not_found(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre4@test.com", "password": "Password123!", "full_name": "Padre 4", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre4@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/scenarios/99/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
```

- [ ] **Step 14: Ejecutar todos los tests backend**

```powershell
docker compose exec backend pytest tests/ -v
```

Expected: todos los tests en verde. El total debe incluir los 12 tests de Etapa 1 más los nuevos:
```
tests/test_auth.py ............                    [12 passed]
tests/test_emotions.py ....                        [4 passed]
tests/test_scenarios.py .......                    [7 passed]
======================== 23 passed in X.XXs =========================
```

Si falla algún test relacionado con las nuevas tablas (e.g., `no such table`), verificar que la migración se aplicó correctamente en el Step 5.

- [ ] **Step 15: Commit**

```powershell
git add backend/
git commit -m "feat: API de emociones y escenarios con registro de actividad y 11 tests"
```

---

### Task 2: Frontend — Página Selector Emocional

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/pages/EmotionSelector.jsx`
- Create: `frontend/src/test/EmotionSelector.test.jsx`

**Interfaces:**
- Consumes: `GET /api/v1/emotions` via `emotionsApi.list()`
- Consumes: `POST /api/v1/emotions/log` via `emotionsApi.log(key)`
- Consumes: `Button`, `PageWrapper`, `LumiCharacter` de Etapa 1
- Produce: página `/emociones` que muestra 5 tarjetas de emociones y navega a `/escenarios` al seleccionar

---

- [ ] **Step 1: Escribir los tests de EmotionSelector primero**

Crear `frontend/src/test/EmotionSelector.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmotionSelector } from '../pages/EmotionSelector'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  emotionsApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { key: 'feliz',      label: 'Feliz',      emoji: '😊' },
        { key: 'nervioso',   label: 'Nervioso',   emoji: '😰' },
        { key: 'confundido', label: 'Confundido', emoji: '🤔' },
        { key: 'frustrado',  label: 'Frustrado',  emoji: '😤' },
        { key: 'cansado',    label: 'Cansado',    emoji: '😴' },
      ]
    }),
    log: vi.fn().mockResolvedValue({ data: { id: 1, emotion_key: 'feliz' } }),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

describe('EmotionSelector', () => {
  beforeEach(() => { mockNavigate.mockClear() })

  it('muestra el título y 5 tarjetas de emociones', async () => {
    render(<MemoryRouter><EmotionSelector /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument()
      expect(screen.getByText('Feliz')).toBeInTheDocument()
      expect(screen.getByText('Nervioso')).toBeInTheDocument()
      expect(screen.getByText('Confundido')).toBeInTheDocument()
      expect(screen.getByText('Frustrado')).toBeInTheDocument()
      expect(screen.getByText('Cansado')).toBeInTheDocument()
    })
  })

  it('navega a /escenarios al seleccionar una emoción', async () => {
    render(<MemoryRouter><EmotionSelector /></MemoryRouter>)
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/escenarios')
    })
  })
})
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: FAIL — "Cannot find module '../pages/EmotionSelector'"

- [ ] **Step 3: Agregar `emotionsApi` a `frontend/src/services/api.js`**

Agregar al final del archivo (después de `authApi`):

```js
export const emotionsApi = {
  list: ()         => api.get('/emotions'),
  log:  (key)      => api.post('/emotions/log', { emotion_key: key }),
}

export const scenariosApi = {
  list:     ()          => api.get('/scenarios'),
  get:      (id)        => api.get(`/scenarios/${id}`),
  complete: (id)        => api.post(`/scenarios/${id}/complete`),
}
```

- [ ] **Step 4: Crear `frontend/src/pages/EmotionSelector.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { emotionsApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

// Mapa estático: las clases Tailwind deben estar aquí para que JIT las incluya en el build
const EMOTION_COLORS = {
  feliz:      'bg-primary-100 border-primary-500',
  nervioso:   'bg-primary-50 border-accent-yellow',
  confundido: 'bg-secondary-100 border-secondary-500',
  frustrado:  'bg-primary-50 border-accent-coral',
  cansado:    'bg-calm-bg border-calm-border',
}

export function EmotionSelector() {
  const navigate = useNavigate()
  const [emotions, setEmotions] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    emotionsApi.list()
      .then(res => setEmotions(res.data))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = async (key) => {
    if (selected) return
    setSelected(key)
    try {
      await emotionsApi.log(key)
    } catch {
      // Si no está autenticado, continúa igual
    }
    setTimeout(() => navigate('/escenarios'), 600)
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-10">
      <div className="max-w-md w-full flex flex-col items-center gap-8">

        <div className="flex flex-col items-center gap-3 text-center">
          <LumiCharacter state="idle" size={90} />
          <h1 className="text-2xl font-extrabold text-primary-700">
            ¿Cómo te sientes hoy?
          </h1>
          <p className="text-sm text-text-secondary">
            Elige la emoción que más se parece a cómo te sientes ahora.
          </p>
        </div>

        {loading ? (
          <p className="text-text-muted text-base">Cargando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 w-full">
            {emotions.map((emotion, i) => (
              <motion.button
                key={emotion.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelect(emotion.key)}
                className={`
                  flex flex-col items-center gap-2 p-5 rounded-3xl border-2
                  min-h-[100px] cursor-pointer transition-all
                  ${EMOTION_COLORS[emotion.key] || 'bg-calm-surface border-calm-border'}
                  ${selected === emotion.key ? 'ring-4 ring-primary-500 ring-offset-2 scale-95' : ''}
                  ${selected && selected !== emotion.key ? 'opacity-40' : ''}
                `}
                aria-label={emotion.label}
                disabled={!!selected}
              >
                <span className="text-5xl leading-none" role="img" aria-hidden="true">
                  {emotion.emoji}
                </span>
                <span className="text-sm font-bold text-text-primary">
                  {emotion.label}
                </span>
              </motion.button>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 5: Ejecutar tests para verificar que pasan**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: `2 passed` para EmotionSelector + los `4 passed` de Button = **6 passed** total.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/pages/EmotionSelector.jsx frontend/src/services/api.js frontend/src/test/EmotionSelector.test.jsx
git commit -m "feat: pagina selector emocional con 5 emociones y registro"
```

---

### Task 3: Frontend — Página Lista de Escenarios

**Files:**
- Create: `frontend/src/pages/ScenarioList.jsx`

**Interfaces:**
- Consumes: `GET /api/v1/scenarios` via `scenariosApi.list()`
- Consumes: `Card`, `PageWrapper`, `LumiCharacter` de Etapa 1
- Produce: página `/escenarios` que muestra 5 tarjetas de escenarios y navega a `/escenarios/:id` al hacer clic

---

- [ ] **Step 1: Crear `frontend/src/pages/ScenarioList.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { scenariosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function ScenarioList() {
  const navigate  = useNavigate()
  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    scenariosApi.list()
      .then(res => setScenarios(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-md mx-auto w-full flex flex-col gap-6">

        <div className="flex items-center gap-4">
          <LumiCharacter state="encouraging" size={70} />
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">
              Escenarios sociales
            </h1>
            <p className="text-sm text-text-secondary">
              Elige uno para practicar
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-text-muted text-base text-center py-8">Cargando...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {scenarios.map((scenario, i) => (
              <motion.button
                key={scenario.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/escenarios/${scenario.id}`)}
                className="
                  flex items-center gap-4 p-5 rounded-3xl
                  bg-calm-surface border-2 border-calm-border
                  hover:border-primary-500 hover:bg-primary-50
                  transition-colors text-left w-full min-h-[72px]
                "
                aria-label={`Practicar: ${scenario.title}`}
              >
                <span className="text-4xl leading-none flex-shrink-0" role="img" aria-hidden="true">
                  {scenario.emoji}
                </span>
                <div>
                  <p className="font-bold text-text-primary text-sm">{scenario.title}</p>
                  <p className="text-xs text-text-muted">{scenario.description}</p>
                </div>
                <span className="ml-auto text-text-muted text-xl">›</span>
              </motion.button>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/inicio')}
          className="text-sm text-text-muted underline text-center mt-2"
        >
          Volver al inicio
        </button>

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Ejecutar tests (solo confirmar que no se rompió nada)**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: `6 passed` (sin cambios — ScenarioList no tiene tests propios, su comportamiento se verifica en Task 5 con la integración).

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/pages/ScenarioList.jsx
git commit -m "feat: pagina lista de escenarios sociales"
```

---

### Task 4: Frontend — Flujo Pedagógico ScenarioFlow

**Files:**
- Create: `frontend/src/pages/ScenarioFlow.jsx`
- Create: `frontend/src/test/ScenarioFlow.test.jsx`

**Interfaces:**
- Consumes: `GET /api/v1/scenarios/:id` via `scenariosApi.get(id)`
- Consumes: `POST /api/v1/scenarios/:id/complete` via `scenariosApi.complete(id)`
- Consumes: `Button`, `Card`, `PageWrapper`, `LumiCharacter`
- Produce: página `/escenarios/:id` que guía al usuario por los 5 pasos del escenario

---

- [ ] **Step 1: Escribir los tests de ScenarioFlow primero**

Crear `frontend/src/test/ScenarioFlow.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ScenarioFlow } from '../pages/ScenarioFlow'

const MOCK_SCENARIO = {
  id: 1,
  emoji: '🙋',
  title: 'Saludar',
  description: 'Aprende a saludar',
  steps: [
    { type: 'objective',   lumi_state: 'happy',       title: '¿Qué aprenderemos?', text: 'Hoy aprendemos a saludar.' },
    { type: 'explanation', lumi_state: 'thinking',    title: '¿Cómo se hace?',     text: 'Di Hola y tu nombre.' },
    { type: 'practice',    lumi_state: 'thinking',    question: '¿Qué haces?',
      options: [{ text: 'Digo Hola', correct: true }, { text: 'Paso sin decir nada', correct: false }] },
    { type: 'feedback',    lumi_state: 'happy',       title: '¡Muy bien!',         text: 'Saludar es genial.' },
    { type: 'closing',     lumi_state: 'encouraging', title: '¡Lo lograste!',      text: 'Practica hoy.', badge_emoji: '🌟' },
  ],
}

vi.mock('../services/api', () => ({
  scenariosApi: {
    get:      vi.fn().mockResolvedValue({ data: MOCK_SCENARIO }),
    complete: vi.fn().mockResolvedValue({ data: { id: 1, scenario_id: 1 } }),
    list:     vi.fn(),
  },
  emotionsApi: { list: vi.fn(), log: vi.fn() },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ scenarioId: '1' }) }
})

function renderScenario() {
  return render(
    <MemoryRouter initialEntries={['/escenarios/1']}>
      <Routes>
        <Route path="/escenarios/:scenarioId" element={<ScenarioFlow />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ScenarioFlow', () => {
  beforeEach(() => { mockNavigate.mockClear() })

  it('muestra el primer paso (objective) al cargar', async () => {
    renderScenario()
    await waitFor(() => {
      expect(screen.getByText('¿Qué aprenderemos?')).toBeInTheDocument()
      expect(screen.getByText('Hoy aprendemos a saludar.')).toBeInTheDocument()
    })
  })

  it('avanza al paso siguiente al pulsar Siguiente', async () => {
    renderScenario()
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText('¿Cómo se hace?')).toBeInTheDocument()
    })
  })

  it('muestra las opciones en el paso de práctica', async () => {
    renderScenario()
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => screen.getByText('¿Cómo se hace?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText('¿Qué haces?')).toBeInTheDocument()
      expect(screen.getByText('Digo Hola')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: FAIL — "Cannot find module '../pages/ScenarioFlow'"

- [ ] **Step 3: Crear `frontend/src/pages/ScenarioFlow.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { scenariosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

function StepProgress({ current, total }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i <= current ? 'bg-primary-500 w-6' : 'bg-calm-border w-2'
          }`}
        />
      ))}
    </div>
  )
}

function StepObjective({ step }) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-xs font-bold text-primary-500 uppercase tracking-wide">
        Objetivo
      </p>
      <h2 className="text-lg font-extrabold text-primary-700">{step.title}</h2>
      <p className="text-base text-text-secondary leading-relaxed">{step.text}</p>
    </div>
  )
}

function StepExplanation({ step }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-bold text-secondary-600 uppercase tracking-wide text-center">
        Explicación
      </p>
      <h2 className="text-lg font-extrabold text-primary-700 text-center">{step.title}</h2>
      <Card className="bg-secondary-50 border-secondary-100">
        <p className="text-base text-text-primary leading-relaxed">{step.text}</p>
      </Card>
    </div>
  )
}

function StepPractice({ step, onAnswer }) {
  const [selected, setSelected] = useState(null)

  const handleSelect = (option) => {
    if (selected !== null) return
    setSelected(option)
    setTimeout(() => onAnswer(option.correct), 1000)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-bold text-accent-yellow uppercase tracking-wide text-center">
        Practiquemos
      </p>
      <h2 className="text-base font-bold text-text-primary text-center">{step.question}</h2>
      <div className="flex flex-col gap-3">
        {step.options.map((option, i) => {
          const isSelected = selected?.text === option.text
          const showResult = selected !== null && isSelected
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(option)}
              disabled={selected !== null}
              className={`
                p-4 rounded-2xl border-2 text-left text-sm font-semibold
                transition-all min-h-[56px]
                ${!selected ? 'border-calm-border bg-calm-surface hover:border-primary-500 hover:bg-primary-50' : ''}
                ${showResult && option.correct  ? 'border-secondary-500 bg-secondary-50 text-secondary-600' : ''}
                ${showResult && !option.correct ? 'border-accent-coral   bg-accent-coral/10 text-accent-coral' : ''}
                ${selected && !isSelected       ? 'opacity-40 border-calm-border bg-calm-surface' : ''}
              `}
            >
              {option.text}
              {showResult && <span className="ml-2">{option.correct ? '✓' : '○'}</span>}
            </motion.button>
          )
        })}
      </div>
      {selected && !selected.correct && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-text-secondary text-center bg-primary-50 rounded-2xl p-3"
        >
          No pasa nada. ¡La respuesta ideal era otra! Sigue adelante. 💪
        </motion.p>
      )}
    </div>
  )
}

function StepFeedback({ step }) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-xs font-bold text-secondary-600 uppercase tracking-wide">
        Retroalimentación
      </p>
      <h2 className="text-xl font-extrabold text-primary-700">{step.title}</h2>
      <p className="text-base text-text-secondary leading-relaxed">{step.text}</p>
    </div>
  )
}

function StepClosing({ step }) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        className="text-6xl mx-auto"
        role="img"
        aria-label="Insignia de logro"
      >
        {step.badge_emoji}
      </motion.div>
      <h2 className="text-xl font-extrabold text-primary-700">{step.title}</h2>
      <p className="text-base text-text-secondary leading-relaxed">{step.text}</p>
    </div>
  )
}

export function ScenarioFlow() {
  const { scenarioId } = useParams()
  const navigate       = useNavigate()
  const [scenario, setScenario]   = useState(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [practiceAnswered, setPracticeAnswered] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    scenariosApi.get(Number(scenarioId))
      .then(res => setScenario(res.data))
      .catch(() => navigate('/escenarios'))
      .finally(() => setLoading(false))
  }, [scenarioId, navigate])

  if (loading || !scenario) {
    return (
      <PageWrapper className="items-center justify-center">
        <p className="text-text-muted text-base">Cargando...</p>
      </PageWrapper>
    )
  }

  const currentStep = scenario.steps[stepIndex]
  const isLast      = stepIndex === scenario.steps.length - 1
  const isPractice  = currentStep.type === 'practice'
  const canAdvance  = !isPractice || practiceAnswered

  const handleNext = async () => {
    if (isLast) {
      try { await scenariosApi.complete(scenario.id) } catch { /* continúa */ }
      navigate('/escenarios')
      return
    }
    setStepIndex(i => i + 1)
    setPracticeAnswered(false)
  }

  const handlePracticeAnswer = () => {
    setPracticeAnswered(true)
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-md mx-auto w-full flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/escenarios')}
            className="text-text-muted text-xl px-2 py-2 min-h-[44px] min-w-[44px] flex items-center"
            aria-label="Volver a escenarios"
          >
            ‹
          </button>
          <div className="flex-1">
            <p className="text-xs text-text-muted font-semibold">{scenario.emoji} {scenario.title}</p>
          </div>
        </div>

        <StepProgress current={stepIndex} total={scenario.steps.length} />

        {/* Lumi */}
        <div className="flex justify-center">
          <LumiCharacter state={currentStep.lumi_state} size={100} />
        </div>

        {/* Contenido del paso */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="min-h-[160px] flex flex-col justify-center">
              {currentStep.type === 'objective'   && <StepObjective   step={currentStep} />}
              {currentStep.type === 'explanation' && <StepExplanation step={currentStep} />}
              {currentStep.type === 'practice'    && <StepPractice    step={currentStep} onAnswer={handlePracticeAnswer} />}
              {currentStep.type === 'feedback'    && <StepFeedback    step={currentStep} />}
              {currentStep.type === 'closing'     && <StepClosing     step={currentStep} />}
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Botón siguiente */}
        {canAdvance && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button onClick={handleNext} className="w-full">
              {isLast ? '¡Terminar!' : 'Siguiente'}
            </Button>
          </motion.div>
        )}

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 4: Ejecutar tests para verificar que pasan**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: `3 passed` de ScenarioFlow + `2 passed` de EmotionSelector + `4 passed` de Button = **9 passed** total.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/ScenarioFlow.jsx frontend/src/test/ScenarioFlow.test.jsx
git commit -m "feat: flujo pedagogico ScenarioFlow con 5 pasos animados y practica interactiva"
```

---

### Task 5: Frontend — Integración: Dashboard, Router y Verificación Final

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/router/index.jsx`

**Interfaces:**
- Consumes: `EmotionSelector`, `ScenarioList`, `ScenarioFlow` (páginas creadas en Tasks 2-4)
- Produce: flujo completo navegable desde Dashboard → `/emociones` → `/escenarios` → `/escenarios/:id`

---

- [ ] **Step 1: Actualizar `frontend/src/router/index.jsx`**

Reemplazar el contenido completo:

```jsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Welcome }          from '../pages/Welcome'
import { Login }            from '../pages/Login'
import { Register }         from '../pages/Register'
import { Dashboard }        from '../pages/Dashboard'
import { EmotionSelector }  from '../pages/EmotionSelector'
import { ScenarioList }     from '../pages/ScenarioList'
import { ScenarioFlow }     from '../pages/ScenarioFlow'

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
])
```

- [ ] **Step 2: Actualizar `frontend/src/pages/Dashboard.jsx`**

Reemplazar el contenido completo:

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
    emoji: '🧘',
    title: 'Zona de calma',
    desc: 'Próximamente',
    available: false,
    path: null,
  },
]

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const firstName        = user?.full_name?.split(' ')[0] || 'Bienvenido'

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
            <p className="text-sm text-text-secondary">
              {ROLE_LABELS[user?.role] || 'Usuario'}
            </p>
          </div>
        </div>

        {/* Módulos */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">Módulos</h2>
          {MODULE_CARDS.map((mod, i) => (
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
                    <p className="font-bold text-text-primary text-sm">{mod.title}</p>
                    <p className="text-xs text-text-secondary">{mod.desc}</p>
                  </div>
                  <span className="text-text-muted text-xl">›</span>
                </button>
              ) : (
                <Card className="flex items-center gap-4 opacity-50">
                  <span className="text-3xl">{mod.emoji}</span>
                  <div>
                    <p className="font-bold text-text-primary text-sm">{mod.title}</p>
                    <p className="text-xs text-text-muted">{mod.desc}</p>
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

- [ ] **Step 3: Ejecutar todos los tests frontend**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: **9 passed** (Button ×4, EmotionSelector ×2, ScenarioFlow ×3).

- [ ] **Step 4: Verificar el flujo completo en el navegador**

Abrir `http://localhost:3000` y verificar:

1. Login → Dashboard muestra "Selector emocional" y "Escenarios sociales" como botones clicables (ya no dicen "Próximamente")
2. Click "Selector emocional" → página `/emociones` con 5 tarjetas grandes
3. Click en "Feliz" → animación de selección → navega a `/escenarios`
4. Lista de 5 escenarios → click en "Saludar"
5. Flujo pedagógico: paso 1 (Objetivo) → click Siguiente → paso 2 (Explicación) → click Siguiente → paso 3 (Práctica) → seleccionar una opción → ver retroalimentación → paso 4 → paso 5 (Cierre con badge) → click ¡Terminar! → regresa a `/escenarios`
6. Verificar logs: `docker compose logs backend --tail=20` — deben aparecer los `POST /api/v1/emotions/log` y `POST /api/v1/scenarios/1/complete`

- [ ] **Step 5: Commit final de Etapa 2**

```powershell
git add frontend/src/pages/Dashboard.jsx frontend/src/router/index.jsx
git commit -m "feat: integracion Etapa 2 — Dashboard con modulos activos, rutas nuevas"
```

---

## Resumen de Etapa 2

Al completar este plan, tendrás:

| Componente | Estado |
|---|---|
| API `GET /api/v1/emotions` (5 emociones) | ✓ |
| API `POST /api/v1/emotions/log` (registro en DB) | ✓ |
| API `GET /api/v1/scenarios` (5 escenarios) | ✓ |
| API `GET /api/v1/scenarios/:id` (detalle con pasos) | ✓ |
| API `POST /api/v1/scenarios/:id/complete` (registro) | ✓ |
| Migración Alembic `emotion_logs` + `scenario_completions` | ✓ |
| Tests backend: 23 passing (12 Etapa 1 + 11 Etapa 2) | ✓ |
| Página `/emociones` — Selector con 5 emociones | ✓ |
| Página `/escenarios` — Lista de 5 escenarios | ✓ |
| Página `/escenarios/:id` — Flujo pedagógico completo (5 pasos) | ✓ |
| Dashboard actualizado con módulos clicables | ✓ |
| Tests frontend: 9 passing (4 Etapa 1 + 5 Etapa 2) | ✓ |

**Siguiente etapa:** Etapa 3 — Integración IA (conversaciones guiadas con Claude Sonnet).
