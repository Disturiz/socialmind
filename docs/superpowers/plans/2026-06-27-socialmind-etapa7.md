# SocialMind Etapa 7 — Gamificación y Recompensas: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sistema de estrellas, insignias y niveles temáticos (aventura con Lumi) con pantalla "Mi aventura" para el niño y resumen visible en el panel del especialista.

**Architecture:** Los eventos de actividad (scenario_completed, calm_session, lumi_chat, daily_streak) se registran en `reward_events` (log inmutable). Un resumen cacheado vive en `user_rewards` (una fila por usuario). Las reglas de niveles e insignias están en `gamification/config.py` — sin tocar la DB para ajustarlas. La integración con los módulos existentes se hace en los **routers** (no en los servicios), llamando a `register_event` después del commit del servicio.

**Tech Stack:** Python/FastAPI/SQLAlchemy 2.x/SQLite (tests)/PostgreSQL (prod) · React 18/Vite/Tailwind/Framer Motion · pytest · Vitest/@testing-library

## Global Constraints

- IDs son `Integer`, nunca UUID (coherente con el resto del código)
- SQLAlchemy Mapped/mapped_column syntax (no Column/declarative_base clásico)
- Español latinoamericano en todos los textos de UI
- Sin clínica, sin diagnósticos, sin sarcasmo — solo acompañamiento positivo
- Animaciones: suaves, sin flashes, sin sonidos bruscos (sensorial-friendly)
- TDD: escribir test fallando → implementar → verificar verde → commit
- `down_revision` de la migración nueva: `'8c779fde6714'`

---

### Task 1: Modelos SQLAlchemy + migración Alembic

**Files:**
- Create: `backend/app/models/reward_event.py`
- Create: `backend/app/models/user_rewards.py`
- Modify: `backend/app/main.py` (agregar imports de modelos)
- Create: `backend/alembic/versions/f3a2c1b9d0e8_add_gamification.py`

**Interfaces:**
- Produces: `RewardEvent` y `UserRewards` disponibles vía `Base.metadata` para tests y migraciones

- [ ] **Step 1: Crear `backend/app/models/reward_event.py`**

```python
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class RewardEvent(Base):
    __tablename__ = "reward_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    stars_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    extra_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_reward_events_user_created", "user_id", "created_at"),
    )
```

- [ ] **Step 2: Crear `backend/app/models/user_rewards.py`**

```python
from datetime import datetime, date, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, JSON, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UserRewards(Base):
    __tablename__ = "user_rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    total_stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_level_key: Mapped[str] = mapped_column(String(30), nullable=False, default="explorador")
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    badges: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (UniqueConstraint("user_id"),)
```

- [ ] **Step 3: Agregar imports de modelos en `backend/app/main.py`**

Agregar estas dos líneas junto a los otros `import app.models.*`:
```python
import app.models.reward_event
import app.models.user_rewards
```

- [ ] **Step 4: Crear migración Alembic `backend/alembic/versions/f3a2c1b9d0e8_add_gamification.py`**

```python
"""add_gamification

Revision ID: f3a2c1b9d0e8
Revises: 8c779fde6714
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3a2c1b9d0e8'
down_revision: Union[str, None] = '8c779fde6714'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reward_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=30), nullable=False),
        sa.Column('stars_earned', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_reward_events_id'), 'reward_events', ['id'], unique=False)
    op.create_index('ix_reward_events_user_created', 'reward_events', ['user_id', 'created_at'], unique=False)

    op.create_table(
        'user_rewards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('total_stars', sa.Integer(), nullable=False),
        sa.Column('current_level_key', sa.String(length=30), nullable=False),
        sa.Column('current_streak', sa.Integer(), nullable=False),
        sa.Column('last_activity_date', sa.Date(), nullable=True),
        sa.Column('badges', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_user_rewards_id'), 'user_rewards', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_rewards_id'), table_name='user_rewards')
    op.drop_table('user_rewards')
    op.drop_index('ix_reward_events_user_created', table_name='reward_events')
    op.drop_index(op.f('ix_reward_events_id'), table_name='reward_events')
    op.drop_table('reward_events')
```

- [ ] **Step 5: Verificar que los modelos se importan correctamente**

```bash
cd backend && python -c "from app.models.reward_event import RewardEvent; from app.models.user_rewards import UserRewards; print('OK')"
```
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/reward_event.py backend/app/models/user_rewards.py backend/app/main.py backend/alembic/versions/f3a2c1b9d0e8_add_gamification.py
git commit -m "feat: modelos RewardEvent y UserRewards, migración Alembic gamificación"
```

---

### Task 2: Gamification config + service

**Files:**
- Create: `backend/app/gamification/__init__.py`
- Create: `backend/app/gamification/config.py`
- Create: `backend/app/gamification/service.py`
- Create: `backend/tests/test_gamification_service.py`

**Interfaces:**
- Consumes: `RewardEvent`, `UserRewards` (Task 1)
- Produces:
  - `register_event(db: Session, user_id: int, event_type: str, extra_data: dict | None = None) -> dict` — retorna `{"new_badges": list[str], "level_up": bool}`
  - `get_progress(db: Session, user_id: int) -> dict` — retorna estructura completa de progreso

- [ ] **Step 1: Escribir los tests que deben fallar**

Crear `backend/tests/test_gamification_service.py`:

```python
import pytest
from datetime import date, timedelta
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.user_rewards import UserRewards
from app.gamification.service import register_event, get_progress
from app.gamification.config import STARS_PER_EVENT


def _make_user(db, email="gami@test.com"):
    u = User(
        email=email,
        hashed_password=get_password_hash("Test123!"),
        full_name="Test",
        role=UserRole.parent,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_register_event_awards_correct_stars(db):
    user = _make_user(db, "stars@test.com")
    register_event(db, user.id, "lumi_chat")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    expected = STARS_PER_EVENT["lumi_chat"] + STARS_PER_EVENT["daily_streak"]
    assert rewards.total_stars == expected


def test_daily_streak_fires_once_per_day(db):
    user = _make_user(db, "once@test.com")
    register_event(db, user.id, "lumi_chat")
    register_event(db, user.id, "lumi_chat")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    expected = STARS_PER_EVENT["lumi_chat"] * 2 + STARS_PER_EVENT["daily_streak"]
    assert rewards.total_stars == expected
    assert rewards.current_streak == 1


def test_streak_increments_for_consecutive_days(db):
    user = _make_user(db, "consec@test.com")
    register_event(db, user.id, "calm_session")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    rewards.last_activity_date = date.today() - timedelta(days=1)
    db.commit()
    register_event(db, user.id, "calm_session")
    db.refresh(rewards)
    assert rewards.current_streak == 2


def test_streak_resets_after_gap(db):
    user = _make_user(db, "gap@test.com")
    register_event(db, user.id, "calm_session")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    rewards.last_activity_date = date.today() - timedelta(days=3)
    rewards.current_streak = 5
    db.commit()
    register_event(db, user.id, "calm_session")
    db.refresh(rewards)
    assert rewards.current_streak == 1


def test_level_up_when_crossing_threshold(db):
    user = _make_user(db, "level@test.com")
    rewards = UserRewards(
        user_id=user.id, total_stars=46, current_streak=0,
        current_level_key="explorador", badges=[], last_activity_date=None,
    )
    db.add(rewards)
    db.commit()
    result = register_event(db, user.id, "lumi_chat")  # +3 chat + 15 streak = 18 → total 64 ≥ 50
    db.refresh(rewards)
    assert rewards.current_level_key == "aventurero"
    assert result["level_up"] is True


def test_badge_primer_paso_awarded_on_first_scenario(db):
    user = _make_user(db, "badge1@test.com")
    result = register_event(db, user.id, "scenario_completed", {"scenario_id": 1})
    assert "primer_paso" in result["new_badges"]


def test_badge_not_duplicated_on_repeat(db):
    user = _make_user(db, "badge2@test.com")
    register_event(db, user.id, "scenario_completed", {"scenario_id": 1})
    result2 = register_event(db, user.id, "scenario_completed", {"scenario_id": 2})
    assert "primer_paso" not in result2["new_badges"]


def test_maestro_social_requires_all_five_unique_scenarios(db):
    user = _make_user(db, "maestro@test.com")
    for sid in [1, 2, 3, 4]:
        register_event(db, user.id, "scenario_completed", {"scenario_id": sid})
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    assert "maestro_social" not in rewards.badges
    result = register_event(db, user.id, "scenario_completed", {"scenario_id": 5})
    assert "maestro_social" in result["new_badges"]


def test_get_progress_returns_defaults_for_new_user(db):
    user = _make_user(db, "fresh@test.com")
    progress = get_progress(db, user.id)
    assert progress["total_stars"] == 0
    assert progress["current_streak"] == 0
    assert progress["level"]["key"] == "explorador"
    assert progress["progress_pct"] == 0
    assert len(progress["badges"]) == 13
    assert not any(b["earned"] for b in progress["badges"])


def test_get_progress_shows_earned_badges(db):
    user = _make_user(db, "earned@test.com")
    register_event(db, user.id, "scenario_completed", {"scenario_id": 1})
    progress = get_progress(db, user.id)
    earned = [b for b in progress["badges"] if b["earned"]]
    assert any(b["key"] == "primer_paso" for b in earned)
```

- [ ] **Step 2: Ejecutar tests — deben fallar por ImportError**

```bash
cd backend && python -m pytest tests/test_gamification_service.py -v 2>&1 | head -20
```
Expected: `ImportError: No module named 'app.gamification'`

- [ ] **Step 3: Crear `backend/app/gamification/__init__.py`** (vacío)

- [ ] **Step 4: Crear `backend/app/gamification/config.py`**

```python
STARS_PER_EVENT = {
    "scenario_completed": 10,
    "calm_session": 5,
    "lumi_chat": 3,
    "daily_streak": 15,
}

LEVELS = [
    {"key": "explorador",     "name": "Explorador",           "min_stars": 0},
    {"key": "aventurero",     "name": "Aventurero",           "min_stars": 50},
    {"key": "heroe_social",   "name": "Héroe Social",         "min_stars": 150},
    {"key": "guardian_calma", "name": "Guardián de la Calma", "min_stars": 300},
    {"key": "companero_lumi", "name": "Compañero de Lumi",    "min_stars": 500},
]

BADGES = [
    {"key": "primer_paso",       "name": "Primer Paso",          "condition": {"event_type": "scenario_completed", "count": 1}},
    {"key": "social_pro",        "name": "Social Pro",           "condition": {"event_type": "scenario_completed", "count": 5}},
    {"key": "maestro_social",    "name": "Maestro Social",       "condition": {"unique_scenarios": 5}},
    {"key": "momento_tranquilo", "name": "Momento Tranquilo",    "condition": {"event_type": "calm_session", "count": 1}},
    {"key": "zen",               "name": "Zen",                  "condition": {"event_type": "calm_session", "count": 10}},
    {"key": "buen_conversador",  "name": "Buen Conversador",     "condition": {"event_type": "lumi_chat", "count": 1}},
    {"key": "amigo_lumi",        "name": "Amigo de Lumi",        "condition": {"event_type": "lumi_chat", "count": 10}},
    {"key": "semana_completa",   "name": "Semana Completa",      "condition": {"streak": 7}},
    {"key": "mes_dedicado",      "name": "Mes Dedicado",         "condition": {"streak": 30}},
    {"key": "nivel_aventurero",  "name": "Aventurero",           "condition": {"level": "aventurero"}},
    {"key": "nivel_heroe",       "name": "Héroe Social",         "condition": {"level": "heroe_social"}},
    {"key": "nivel_guardian",    "name": "Guardián de la Calma", "condition": {"level": "guardian_calma"}},
    {"key": "nivel_companero",   "name": "Compañero de Lumi",    "condition": {"level": "companero_lumi"}},
]
```

- [ ] **Step 5: Crear `backend/app/gamification/service.py`**

```python
from datetime import datetime, date, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.reward_event import RewardEvent
from app.models.user_rewards import UserRewards
from app.gamification.config import STARS_PER_EVENT, LEVELS, BADGES


def _compute_level(total_stars: int) -> str:
    current = LEVELS[0]["key"]
    for level in LEVELS:
        if total_stars >= level["min_stars"]:
            current = level["key"]
    return current


def _level_index(key: str) -> int:
    for i, level in enumerate(LEVELS):
        if level["key"] == key:
            return i
    return 0


def _count_events(db: Session, user_id: int, event_type: str) -> int:
    return db.query(func.count(RewardEvent.id)).filter(
        RewardEvent.user_id == user_id,
        RewardEvent.event_type == event_type,
    ).scalar() or 0


def _count_unique_scenarios(db: Session, user_id: int) -> int:
    events = db.query(RewardEvent).filter(
        RewardEvent.user_id == user_id,
        RewardEvent.event_type == "scenario_completed",
    ).all()
    return len({
        e.extra_data.get("scenario_id")
        for e in events
        if e.extra_data and "scenario_id" in e.extra_data
    })


def _evaluate_new_badges(db: Session, user_id: int, rewards: UserRewards) -> list[str]:
    current = set(rewards.badges or [])
    new_badges = []
    for badge in BADGES:
        key = badge["key"]
        if key in current:
            continue
        cond = badge["condition"]
        if "unique_scenarios" in cond:
            earned = _count_unique_scenarios(db, user_id) >= cond["unique_scenarios"]
        elif "event_type" in cond:
            earned = _count_events(db, user_id, cond["event_type"]) >= cond["count"]
        elif "streak" in cond:
            earned = (rewards.current_streak or 0) >= cond["streak"]
        elif "level" in cond:
            earned = _level_index(rewards.current_level_key) >= _level_index(cond["level"])
        else:
            earned = False
        if earned:
            new_badges.append(key)
    return new_badges


def register_event(
    db: Session,
    user_id: int,
    event_type: str,
    extra_data: dict | None = None,
) -> dict:
    today = date.today()

    rewards = db.query(UserRewards).filter(UserRewards.user_id == user_id).first()
    if not rewards:
        rewards = UserRewards(
            user_id=user_id, total_stars=0, current_streak=0,
            current_level_key="explorador", badges=[], last_activity_date=None,
        )
        db.add(rewards)
        db.flush()

    # Daily streak bonus — once per day
    if rewards.last_activity_date != today:
        yesterday = today - timedelta(days=1)
        if rewards.last_activity_date == yesterday:
            rewards.current_streak = (rewards.current_streak or 0) + 1
        else:
            rewards.current_streak = 1
        rewards.last_activity_date = today
        db.add(RewardEvent(
            user_id=user_id,
            event_type="daily_streak",
            stars_earned=STARS_PER_EVENT["daily_streak"],
        ))
        rewards.total_stars = (rewards.total_stars or 0) + STARS_PER_EVENT["daily_streak"]

    # Main event
    stars = STARS_PER_EVENT.get(event_type, 0)
    db.add(RewardEvent(
        user_id=user_id,
        event_type=event_type,
        stars_earned=stars,
        extra_data=extra_data,
    ))
    rewards.total_stars = (rewards.total_stars or 0) + stars

    # Level
    old_level = rewards.current_level_key or "explorador"
    rewards.current_level_key = _compute_level(rewards.total_stars)
    level_up = rewards.current_level_key != old_level

    db.flush()

    new_badge_keys = _evaluate_new_badges(db, user_id, rewards)
    if new_badge_keys:
        rewards.badges = list(rewards.badges or []) + new_badge_keys

    rewards.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"new_badges": new_badge_keys, "level_up": level_up}


def get_progress(db: Session, user_id: int) -> dict:
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user_id).first()

    if not rewards:
        return {
            "total_stars": 0,
            "current_streak": 0,
            "level": {"key": "explorador", "name": "Explorador"},
            "next_level": {"key": "aventurero", "name": "Aventurero", "min_stars": 50},
            "progress_pct": 0,
            "badges": [{"key": b["key"], "name": b["name"], "earned": False} for b in BADGES],
        }

    current_level = next((l for l in LEVELS if l["key"] == rewards.current_level_key), LEVELS[0])
    current_idx = _level_index(rewards.current_level_key)
    next_level = LEVELS[current_idx + 1] if current_idx + 1 < len(LEVELS) else None

    if next_level:
        stars_in = (rewards.total_stars or 0) - current_level["min_stars"]
        stars_needed = next_level["min_stars"] - current_level["min_stars"]
        progress_pct = min(100, int(stars_in / stars_needed * 100))
    else:
        progress_pct = 100

    earned_set = set(rewards.badges or [])
    return {
        "total_stars": rewards.total_stars or 0,
        "current_streak": rewards.current_streak or 0,
        "level": {"key": current_level["key"], "name": current_level["name"]},
        "next_level": {
            "key": next_level["key"],
            "name": next_level["name"],
            "min_stars": next_level["min_stars"],
        } if next_level else None,
        "progress_pct": progress_pct,
        "badges": [
            {"key": b["key"], "name": b["name"], "earned": b["key"] in earned_set}
            for b in BADGES
        ],
    }
```

- [ ] **Step 6: Ejecutar tests — deben pasar todos**

```bash
cd backend && python -m pytest tests/test_gamification_service.py -v
```
Expected: `10 passed`

- [ ] **Step 7: Commit**

```bash
git add backend/app/gamification/ backend/tests/test_gamification_service.py
git commit -m "feat: gamification config y service — register_event, get_progress, 10 tests"
```

---

### Task 3: Gamification router + schemas + registro en main.py

**Files:**
- Create: `backend/app/gamification/schemas.py`
- Create: `backend/app/gamification/router.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_gamification.py`

**Interfaces:**
- Consumes: `get_progress(db, user_id)` (Task 2), `get_current_user` de dependencies
- Produces: `GET /api/v1/gamification/progreso` → `ProgressOut`

- [ ] **Step 1: Escribir tests que deben fallar**

Crear `backend/tests/test_gamification.py`:

```python
def _register_and_login(client, email="gami_ep@test.com"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Gami", "role": "parent",
    })
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return r.json()["access_token"]


def test_get_progress_authenticated_returns_structure(client):
    token = _register_and_login(client)
    r = client.get("/api/v1/gamification/progreso",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["total_stars"] == 0
    assert data["current_streak"] == 0
    assert data["level"]["key"] == "explorador"
    assert len(data["badges"]) == 13
    assert not any(b["earned"] for b in data["badges"])


def test_get_progress_unauthenticated_returns_401(client):
    r = client.get("/api/v1/gamification/progreso")
    assert r.status_code == 401


def test_complete_scenario_awards_stars_and_badge(client):
    token = _register_and_login(client, "integration@test.com")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/api/v1/scenarios/1/complete", headers=headers)
    r = client.get("/api/v1/gamification/progreso", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_stars"] > 0
    earned_keys = [b["key"] for b in data["badges"] if b["earned"]]
    assert "primer_paso" in earned_keys
```

- [ ] **Step 2: Ejecutar — deben fallar**

```bash
cd backend && python -m pytest tests/test_gamification.py -v 2>&1 | head -10
```
Expected: `404` o `ImportError`

- [ ] **Step 3: Crear `backend/app/gamification/schemas.py`**

```python
from pydantic import BaseModel


class LevelOut(BaseModel):
    key: str
    name: str


class NextLevelOut(BaseModel):
    key: str
    name: str
    min_stars: int


class BadgeOut(BaseModel):
    key: str
    name: str
    earned: bool


class ProgressOut(BaseModel):
    total_stars: int
    current_streak: int
    level: LevelOut
    next_level: NextLevelOut | None
    progress_pct: int
    badges: list[BadgeOut]
```

- [ ] **Step 4: Crear `backend/app/gamification/router.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.gamification.schemas import ProgressOut
from app.gamification import service as gamification_service

router = APIRouter()


@router.get("/progreso", response_model=ProgressOut)
def get_my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return gamification_service.get_progress(db, current_user.id)
```

- [ ] **Step 5: Registrar router en `backend/app/main.py`**

Agregar el import y la línea `include_router`:

```python
from app.gamification import router as gamification_router
```

Y junto a los otros `include_router`:
```python
app.include_router(gamification_router.router, prefix="/api/v1/gamification", tags=["gamificación"])
```

- [ ] **Step 6: Ejecutar tests — deben pasar (excepto el de integración que requiere Task 4)**

```bash
cd backend && python -m pytest tests/test_gamification.py::test_get_progress_authenticated_returns_structure tests/test_gamification.py::test_get_progress_unauthenticated_returns_401 -v
```
Expected: `2 passed`

- [ ] **Step 7: Commit**

```bash
git add backend/app/gamification/schemas.py backend/app/gamification/router.py backend/app/main.py backend/tests/test_gamification.py
git commit -m "feat: gamification router GET /progreso, schemas Pydantic"
```

---

### Task 4: Integrar register_event en routers existentes

**Files:**
- Modify: `backend/app/routers/scenarios.py`
- Modify: `backend/app/routers/calm.py`
- Modify: `backend/app/routers/chat.py`

**Interfaces:**
- Consumes: `register_event(db, user_id, event_type, extra_data)` (Task 2)
- Produces: actividades completan la DB de eventos; el test de integración de Task 3 pasa

- [ ] **Step 1: Modificar `backend/app/routers/scenarios.py`**

Reemplazar el contenido completo:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.scenarios import ScenarioMeta, ScenarioFull, ScenarioCompletionOut
from app.services.scenario_service import list_scenarios, get_scenario, complete_scenario
from app.gamification.service import register_event

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
    result = complete_scenario(db, current_user.id, scenario_id)
    register_event(db, current_user.id, "scenario_completed", {"scenario_id": scenario_id})
    return result
```

- [ ] **Step 2: Modificar `backend/app/routers/calm.py`**

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.calm import CalmSessionRequest, CalmSessionOut, CalmPhraseRequest, CalmPhraseOut
from app.services import calm_service
from app.gamification.service import register_event

router = APIRouter()


@router.post("/session", response_model=CalmSessionOut, status_code=status.HTTP_201_CREATED)
def save_calm_session(
    data: CalmSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = calm_service.save_session(
        db, current_user.id, data.activity_type, data.duration_seconds, data.emotion_key
    )
    register_event(db, current_user.id, "calm_session")
    return session


@router.post("/phrase", response_model=CalmPhraseOut)
def get_calm_phrase(
    data: CalmPhraseRequest,
    current_user: User = Depends(get_current_user),
):
    phrase = calm_service.generate_phrase(data.emotion_key)
    return {"phrase": phrase}
```

- [ ] **Step 3: Reemplazar contenido completo de `backend/app/routers/chat.py`**

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
from app.gamification.service import register_event

router = APIRouter()


@router.post("/start", response_model=ChatStartOut, status_code=status.HTTP_201_CREATED)
def start_chat(
    data: ChatStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = chat_service.start_conversation(db, current_user.id, data.emotion_key)
    register_event(db, current_user.id, "lumi_chat")
    return result


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

- [ ] **Step 4: Ejecutar el test de integración completo**

```bash
cd backend && python -m pytest tests/test_gamification.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Ejecutar suite completa para verificar no hay regresiones**

```bash
cd backend && python -m pytest tests/ -v --ignore=tests/test_chat.py
```
(test_chat.py requiere mock de Anthropic — ignorar si no está configurado)
Expected: todos los tests previos siguen pasando

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/scenarios.py backend/app/routers/calm.py backend/app/routers/chat.py
git commit -m "feat: integrar register_event en routers de escenarios, calma y chat"
```

---

### Task 5: Frontend — API + componentes + página MiAventura + Dashboard

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/components/gamification/StarCounter.jsx`
- Create: `frontend/src/components/gamification/LevelCard.jsx`
- Create: `frontend/src/components/gamification/BadgeItem.jsx`
- Create: `frontend/src/components/gamification/BadgeGrid.jsx`
- Create: `frontend/src/components/gamification/RewardCelebration.jsx`
- Create: `frontend/src/pages/MiAventura.jsx`
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Create: `frontend/src/test/MiAventura.test.jsx`

**Interfaces:**
- Consumes: `GET /api/v1/gamification/progreso` (Task 3)
- Produces: ruta `/mi-aventura` con página funcional; card "Mi aventura" en Dashboard

- [ ] **Step 1: Escribir tests que deben fallar**

Crear `frontend/src/test/MiAventura.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MiAventura } from '../pages/MiAventura'
import * as api from '../services/api'

vi.mock('../services/api', () => ({
  gamificationApi: { getProgress: vi.fn() },
}))

const MOCK_PROGRESS = {
  total_stars: 28,
  current_streak: 3,
  level: { key: 'explorador', name: 'Explorador' },
  next_level: { key: 'aventurero', name: 'Aventurero', min_stars: 50 },
  progress_pct: 56,
  badges: [
    { key: 'primer_paso', name: 'Primer Paso', earned: true },
    { key: 'social_pro',  name: 'Social Pro',  earned: false },
  ],
}

describe('MiAventura', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra spinner mientras carga', () => {
    api.gamificationApi.getProgress.mockReturnValue(new Promise(() => {}))
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    expect(screen.getByText('Cargando tu aventura...')).toBeInTheDocument()
  })

  it('muestra estrellas y nivel cuando carga', async () => {
    api.gamificationApi.getProgress.mockResolvedValue({ data: MOCK_PROGRESS })
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('28')).toBeInTheDocument()
      expect(screen.getByText('Explorador')).toBeInTheDocument()
    })
  })

  it('muestra racha correctamente', async () => {
    api.gamificationApi.getProgress.mockResolvedValue({ data: MOCK_PROGRESS })
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('muestra insignia ganada y bloqueada', async () => {
    api.gamificationApi.getProgress.mockResolvedValue({ data: MOCK_PROGRESS })
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Primer Paso')).toBeInTheDocument()
      expect(screen.getByText('Social Pro')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```bash
cd frontend && npx vitest run src/test/MiAventura.test.jsx 2>&1 | head -15
```
Expected: `Cannot find module '../pages/MiAventura'`

- [ ] **Step 3: Agregar `gamificationApi` a `frontend/src/services/api.js`**

Al final del archivo agregar:

```js
export const gamificationApi = {
  getProgress: () => api.get('/gamification/progreso'),
}
```

- [ ] **Step 4: Crear `frontend/src/components/gamification/StarCounter.jsx`**

```jsx
export function StarCounter({ totalStars, currentStreak }) {
  return (
    <div className="flex items-center justify-between bg-calm-surface rounded-3xl px-6 py-4 border-2 border-calm-border">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⭐</span>
        <span className="text-xl font-extrabold text-primary-700">{totalStars}</span>
        <span className="text-base text-text-secondary">estrellas</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <span className="text-xl font-extrabold text-primary-700">{currentStreak}</span>
        <span className="text-base text-text-secondary">días</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Crear `frontend/src/components/gamification/LevelCard.jsx`**

```jsx
import { LumiCharacter } from '../lumi/LumiCharacter'

export function LevelCard({ level, nextLevel, progressPct }) {
  return (
    <div className="bg-calm-surface rounded-3xl p-6 border-2 border-primary-200 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <LumiCharacter state="happy" size={64} />
        <div>
          <p className="text-sm text-text-secondary">Nivel actual</p>
          <p className="text-xl font-extrabold text-primary-700">{level.name}</p>
        </div>
      </div>
      {nextLevel ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>{level.name}</span>
            <span>{nextLevel.name}</span>
          </div>
          <div className="w-full bg-calm-border rounded-full h-4 overflow-hidden">
            <div
              className="bg-primary-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-sm text-text-secondary text-center">{progressPct}% hacia {nextLevel.name}</p>
        </div>
      ) : (
        <p className="text-center text-primary-700 font-bold">¡Nivel máximo alcanzado!</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Crear `frontend/src/components/gamification/BadgeItem.jsx`**

```jsx
const BADGE_EMOJIS = {
  primer_paso:       '👣',
  social_pro:        '🤝',
  maestro_social:    '🏆',
  momento_tranquilo: '🌿',
  zen:               '🧘',
  buen_conversador:  '💬',
  amigo_lumi:        '🦉',
  semana_completa:   '🔥',
  mes_dedicado:      '📅',
  nivel_aventurero:  '🗺️',
  nivel_heroe:       '⚡',
  nivel_guardian:    '🌊',
  nivel_companero:   '✨',
}

export function BadgeItem({ badge }) {
  const emoji = BADGE_EMOJIS[badge.key] || '🏅'
  return (
    <div
      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 ${
        badge.earned
          ? 'bg-primary-50 border-primary-300'
          : 'bg-calm-bg border-calm-border opacity-50'
      }`}
    >
      <span className="text-3xl">{emoji}</span>
      <p className="text-xs text-center font-semibold text-text-primary leading-tight">
        {badge.name}
      </p>
      {!badge.earned && <span className="text-xs">🔒</span>}
    </div>
  )
}
```

- [ ] **Step 7: Crear `frontend/src/components/gamification/BadgeGrid.jsx`**

```jsx
import { BadgeItem } from './BadgeItem'

export function BadgeGrid({ badges }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-text-primary mb-3">Insignias</h3>
      <div className="grid grid-cols-3 gap-3">
        {badges.map((badge) => (
          <BadgeItem key={badge.key} badge={badge} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Crear `frontend/src/components/gamification/RewardCelebration.jsx`**

```jsx
import { motion, AnimatePresence } from 'framer-motion'

export function RewardCelebration({ show, message, onDone }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
          onClick={onDone}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: 2, duration: 0.5 }}
            className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 shadow-lg mx-6"
          >
            <span className="text-6xl">⭐</span>
            <p className="text-xl font-extrabold text-primary-700 text-center">{message}</p>
            <p className="text-sm text-text-secondary">Toca para continuar</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 9: Crear `frontend/src/pages/MiAventura.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gamificationApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { StarCounter } from '../components/gamification/StarCounter'
import { LevelCard } from '../components/gamification/LevelCard'
import { BadgeGrid } from '../components/gamification/BadgeGrid'
import { Button } from '../components/ui/Button'

export function MiAventura() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    gamificationApi.getProgress()
      .then((res) => setProgress(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageWrapper className="px-6 py-10">
        <p className="text-text-secondary text-base text-center">Cargando tu aventura...</p>
      </PageWrapper>
    )
  }

  if (!progress) {
    return (
      <PageWrapper className="px-6 py-10">
        <div className="max-w-lg mx-auto flex flex-col gap-4 items-center">
          <p className="text-text-secondary text-base">No se pudo cargar el progreso.</p>
          <Button onClick={() => navigate('/inicio')}>Volver al inicio</Button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-extrabold text-primary-700">Mi aventura</h1>
          <p className="text-base text-text-secondary">Tu progreso con Lumi</p>
        </div>

        <StarCounter totalStars={progress.total_stars} currentStreak={progress.current_streak} />

        <LevelCard
          level={progress.level}
          nextLevel={progress.next_level}
          progressPct={progress.progress_pct}
        />

        <BadgeGrid badges={progress.badges} />

        <Button variant="ghost" onClick={() => navigate('/inicio')} className="self-start">
          Volver al inicio
        </Button>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 10: Agregar ruta `/mi-aventura` en `frontend/src/router/index.jsx`**

Agregar el import:
```jsx
import { MiAventura } from '../pages/MiAventura'
```

Agregar la ruta en el array del router (junto a las otras ProtectedRoute):
```jsx
{
  path: '/mi-aventura',
  element: <ProtectedRoute><MiAventura /></ProtectedRoute>,
},
```

- [ ] **Step 11: Agregar card "Mi aventura" en `frontend/src/pages/Dashboard.jsx`**

En `MODULE_CARDS`, agregar al final del array:
```js
{
  emoji: '⭐',
  title: 'Mi aventura',
  desc: 'Tu progreso y recompensas',
  available: true,
  path: '/mi-aventura',
},
```

- [ ] **Step 12: Ejecutar tests**

```bash
cd frontend && npx vitest run src/test/MiAventura.test.jsx
```
Expected: `4 passed`

- [ ] **Step 13: Commit**

```bash
git add frontend/src/services/api.js frontend/src/components/gamification/ frontend/src/pages/MiAventura.jsx frontend/src/router/index.jsx frontend/src/pages/Dashboard.jsx frontend/src/test/MiAventura.test.jsx
git commit -m "feat: página MiAventura, 5 componentes gamificación, card Dashboard"
```

---

### Task 6: Panel profesional — sección de progreso en ChildDetail

**Files:**
- Modify: `backend/app/schemas/panel.py`
- Modify: `backend/app/services/panel_service.py`
- Modify: `frontend/src/pages/ChildDetail.jsx`
- Modify: `frontend/src/test/ChildDetail.test.jsx`

**Interfaces:**
- Consumes: `get_progress(db, user_id)` (Task 2); `ChildDetailOut` schema
- Produces: `ChildDetailOut` incluye `gamification_progress`; `ChildDetail.jsx` muestra nueva sección

- [ ] **Step 1: Agregar `GamificationProgressOut` en `backend/app/schemas/panel.py`**

Agregar la clase antes de `ChildDetailOut`:

```python
class GamificationProgressOut(BaseModel):
    total_stars: int
    current_streak: int
    level_key: str
    level_name: str
    progress_pct: int
    badges_earned: int
```

Y en `ChildDetailOut` agregar el campo al final:
```python
gamification_progress: GamificationProgressOut | None = None
```

- [ ] **Step 2: Escribir test que debe fallar**

En `backend/tests/test_panel.py`, agregar este test al final del archivo. Usa el fixture `db` directamente para crear usuarios y child profile:

```python
def test_child_detail_includes_gamification(client, db):
    from app.core.security import get_password_hash
    from app.models.user import User, UserRole
    from app.models.child_profile import ChildProfile

    spec = User(
        email="spec_gami@test.com",
        hashed_password=get_password_hash("Password123!"),
        full_name="Spec", role=UserRole.specialist,
    )
    padre = User(
        email="padre_gami@test.com",
        hashed_password=get_password_hash("Password123!"),
        full_name="Padre", role=UserRole.parent,
    )
    db.add_all([spec, padre])
    db.commit()

    child = ChildProfile(parent_id=padre.id, name="Niño Test", age=10, avatar_emoji="🌟")
    db.add(child)
    db.commit()
    db.refresh(child)

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

- [ ] **Step 3: Ejecutar test — debe fallar**

```bash
cd backend && python -m pytest tests/test_panel.py::test_child_detail_includes_gamification -v
```
Expected: `AssertionError: 'gamification_progress' not in data`

- [ ] **Step 4: Modificar `backend/app/services/panel_service.py`**

Agregar el import al inicio:
```python
from app.gamification.service import get_progress as get_gamification_progress
```

En `get_child_detail`, después de obtener `note`, agregar:
```python
gamification = get_gamification_progress(db, pid)
```

Y en el `return` dict agregar:
```python
"gamification_progress": {
    "total_stars": gamification["total_stars"],
    "current_streak": gamification["current_streak"],
    "level_key": gamification["level"]["key"],
    "level_name": gamification["level"]["name"],
    "progress_pct": gamification["progress_pct"],
    "badges_earned": sum(1 for b in gamification["badges"] if b["earned"]),
},
```

- [ ] **Step 5: Ejecutar test del panel**

```bash
cd backend && python -m pytest tests/test_panel.py::test_child_detail_includes_gamification -v
```
Expected: `1 passed`

- [ ] **Step 6: Agregar sección de gamificación en `frontend/src/pages/ChildDetail.jsx`**

Agregar import en la parte superior:
```jsx
import { gamificationApi } from '../services/api'
```

Agregar estado:
```jsx
const [gamification, setGamification] = useState(null)
```

En el `useEffect` donde se carga el child, agregar después de `setChild(res.data)`:
```jsx
setGamification(res.data.gamification_progress ?? null)
```

Agregar la sección de gamificación en el JSX (después de la sección de notas o al final del contenido):

```jsx
{gamification && (
  <div className="mt-6 border-t border-calm-border pt-6">
    <h3 className="text-base font-bold text-text-primary mb-3">Progreso y recompensas</h3>
    <div className="flex gap-4 flex-wrap">
      <div className="flex items-center gap-1 bg-calm-surface rounded-2xl px-4 py-2">
        <span>⭐</span>
        <span className="font-extrabold text-primary-700">{gamification.total_stars}</span>
        <span className="text-text-secondary text-sm">estrellas</span>
      </div>
      <div className="flex items-center gap-1 bg-calm-surface rounded-2xl px-4 py-2">
        <span>🔥</span>
        <span className="font-extrabold text-primary-700">{gamification.current_streak}</span>
        <span className="text-text-secondary text-sm">días</span>
      </div>
      <div className="flex items-center gap-1 bg-calm-surface rounded-2xl px-4 py-2">
        <span>🏅</span>
        <span className="font-extrabold text-primary-700">{gamification.badges_earned}</span>
        <span className="text-text-secondary text-sm">insignias</span>
      </div>
    </div>
    <p className="text-sm text-text-secondary mt-2">
      Nivel: <strong className="text-primary-700">{gamification.level_name}</strong>
      {' '}· {gamification.progress_pct}% hacia el siguiente nivel
    </p>
  </div>
)}
```

- [ ] **Step 7: Actualizar `frontend/src/test/ChildDetail.test.jsx`**

Agregar `gamification_progress` al mock de respuesta existente en el test. Buscar el mock del `panelApi.getChild` y agregar el campo:

```js
gamification_progress: {
  total_stars: 15,
  current_streak: 2,
  level_key: 'explorador',
  level_name: 'Explorador',
  progress_pct: 30,
  badges_earned: 1,
},
```

Agregar un test nuevo que verifique que se muestra el progreso:

```jsx
it('muestra progreso de gamificación', async () => {
  // (usar el mismo mock con gamification_progress incluido)
  await waitFor(() => {
    expect(screen.getByText('Progreso y recompensas')).toBeInTheDocument()
    expect(screen.getByText('Explorador')).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Ejecutar suite frontend completa**

```bash
cd frontend && npx vitest run
```
Expected: todos los tests pasan (incluyendo ChildDetail y MiAventura)

- [ ] **Step 9: Commit final**

```bash
git add backend/app/schemas/panel.py backend/app/services/panel_service.py frontend/src/pages/ChildDetail.jsx frontend/src/test/ChildDetail.test.jsx
git commit -m "feat: gamification_progress en panel especialista, sección ChildDetail"
```
