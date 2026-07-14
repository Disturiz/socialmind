# Panel Profesional — Escenarios Completados: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar escenarios completados al Panel Profesional — pestaña "Escenarios" en ChildDetail y contador en la lista de niños.

**Architecture:** Dos cambios independientes: (1) backend amplía schemas y service para exponer `scenarios_completed` y `total_scenarios_completed` consultando la tabla `scenario_completions` ya existente; (2) frontend agrega la pestaña Escenarios a `ChildDetail` y el contador a `PanelProfesional`. Sin endpoints nuevos — los existentes ya devuelven el response_model completo una vez actualizado el schema.

**Tech Stack:** FastAPI + SQLAlchemy + Pydantic (backend), React + Tailwind + Framer Motion (frontend), Vitest + @testing-library/react (frontend tests), pytest (backend tests).

## Global Constraints

- TDD estricto: escribir el test que falla ANTES de implementar.
- Sin endpoints nuevos — solo modificar schemas, service y pages existentes.
- `_SCENARIO_MAP` se importa desde `backend/app/services/scenario_service.py` (es `dict[int, ScenarioFull]`).
- Fallback si `scenario_id` no está en `_SCENARIO_MAP`: emoji `"🌟"`, title `f"Escenario {id}"`.
- `ScenarioCompletion.user_id` = `profile.parent_id` (el padre es el usuario logueado que juega con el niño).
- Español en todos los textos de UI. Sin comentarios innecesarios en código.
- Commit por tarea con mensaje `feat:`.

---

## File Map

| Archivo | Acción |
|---------|--------|
| `backend/app/schemas/panel.py` | Modificar — agregar `ScenarioCompletedOut`, actualizar `ChildSummaryOut` y `ChildDetailOut` |
| `backend/app/services/panel_service.py` | Modificar — agregar imports, actualizar `list_children` y `get_child_detail` |
| `backend/tests/test_panel.py` | Modificar — 2 tests nuevos |
| `frontend/src/pages/ChildDetail.jsx` | Modificar — agregar tab "Escenarios" |
| `frontend/src/pages/PanelProfesional.jsx` | Modificar — agregar `total_scenarios_completed` en tarjeta |
| `frontend/src/test/ChildDetail.test.jsx` | Modificar — `scenarios_completed` en mockChild + 1 test nuevo |
| `frontend/src/test/PanelProfesional.test.jsx` | Modificar — `total_scenarios_completed` en mockChildren + 1 test nuevo |

---

## Task 1: Backend — schemas + service + tests

**Files:**
- Modify: `backend/app/schemas/panel.py`
- Modify: `backend/app/services/panel_service.py`
- Test: `backend/tests/test_panel.py`

**Interfaces:**
- Produces: `ChildSummaryOut.total_scenarios_completed: int`, `ChildDetailOut.scenarios_completed: list[ScenarioCompletedOut]`
- `ScenarioCompletedOut` = `{ scenario_id: int, emoji: str, title: str, completed_at: datetime }`

- [ ] **Step 1: Escribir los tests que fallan**

Abrir `backend/tests/test_panel.py` y agregar al final del archivo:

```python
def test_child_detail_includes_scenarios_completed(client, db):
    from datetime import datetime, timezone
    from app.models.scenario_completion import ScenarioCompletion

    spec_token = _login(client, "spec_sc1@test.com", "specialist")
    parent_token = _login(client, "parent_sc1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="María", age=11)
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


def test_list_children_includes_total_scenarios_completed(client, db):
    from app.models.scenario_completion import ScenarioCompletion

    spec_token = _login(client, "spec_sc2@test.com", "specialist")
    parent_token = _login(client, "parent_sc2@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    _make_child(db, parent_id, name="Sofía", age=9)

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

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd backend && python -m pytest tests/test_panel.py::test_child_detail_includes_scenarios_completed tests/test_panel.py::test_list_children_includes_total_scenarios_completed -v
```

Expected: ambos FAIL — `KeyError: 'scenarios_completed'` o `ValidationError`.

- [ ] **Step 3: Actualizar `backend/app/schemas/panel.py`**

Reemplazar el contenido completo del archivo con:

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
    total_scenarios_completed: int


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


class GamificationProgressOut(BaseModel):
    total_stars: int
    current_streak: int
    level_key: str
    level_name: str
    progress_pct: int
    badges_earned: int


class ScenarioCompletedOut(BaseModel):
    scenario_id: int
    emoji: str
    title: str
    completed_at: datetime


class ChildDetailOut(BaseModel):
    child_profile_id: int
    name: str
    age: int
    avatar_emoji: str
    emotions: list[EmotionEntryOut]
    calm_sessions: list[CalmEntryOut]
    conversations: list[ConversationOut]
    scenarios_completed: list[ScenarioCompletedOut]
    specialist_note: str | None
    gamification_progress: GamificationProgressOut | None = None


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

- [ ] **Step 4: Actualizar `backend/app/services/panel_service.py`**

Reemplazar el contenido completo con:

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
from app.models.scenario_completion import ScenarioCompletion
from app.services.scenario_service import _SCENARIO_MAP
from app.gamification.service import get_progress as get_gamification_progress


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
    completions = (
        db.query(ScenarioCompletion)
        .filter(ScenarioCompletion.user_id == pid)
        .order_by(ScenarioCompletion.completed_at.desc())
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

    scenarios_completed = [
        {
            "scenario_id": c.scenario_id,
            "emoji": _SCENARIO_MAP[c.scenario_id].emoji
                     if c.scenario_id in _SCENARIO_MAP else "🌟",
            "title": _SCENARIO_MAP[c.scenario_id].title
                     if c.scenario_id in _SCENARIO_MAP else f"Escenario {c.scenario_id}",
            "completed_at": c.completed_at,
        }
        for c in completions
    ]

    note = (
        db.query(SpecialistNote)
        .filter(
            SpecialistNote.specialist_id == specialist_id,
            SpecialistNote.child_profile_id == child_id,
        )
        .first()
    )

    gamification = get_gamification_progress(db, pid)

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
        "scenarios_completed": scenarios_completed,
        "specialist_note": note.content if note else None,
        "gamification_progress": {
            "total_stars": gamification["total_stars"],
            "current_streak": gamification["current_streak"],
            "level_key": gamification["level"]["key"],
            "level_name": gamification["level"]["name"],
            "progress_pct": gamification["progress_pct"],
            "badges_earned": sum(1 for b in gamification["badges"] if b["earned"]),
        },
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

- [ ] **Step 5: Verificar que los nuevos tests pasan**

```bash
cd backend && python -m pytest tests/test_panel.py::test_child_detail_includes_scenarios_completed tests/test_panel.py::test_list_children_includes_total_scenarios_completed -v
```

Expected: ambos PASS.

- [ ] **Step 6: Verificar que toda la suite de panel pasa**

```bash
cd backend && python -m pytest tests/test_panel.py -v
```

Expected: todos los tests existentes + 2 nuevos PASS (actualmente hay 11 tests, ahora serán 13).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/panel.py backend/app/services/panel_service.py backend/tests/test_panel.py
git commit -m "feat: panel — exponer scenarios_completed y total_scenarios_completed"
```

---

## Task 2: Frontend — tab Escenarios en ChildDetail + contador en PanelProfesional

**Files:**
- Modify: `frontend/src/pages/ChildDetail.jsx`
- Modify: `frontend/src/pages/PanelProfesional.jsx`
- Test: `frontend/src/test/ChildDetail.test.jsx`
- Test: `frontend/src/test/PanelProfesional.test.jsx`

**Interfaces:**
- Consumes (de Task 1): `child.scenarios_completed: Array<{ scenario_id, emoji, title, completed_at }>`, `child.total_scenarios_completed: number`
- `formatDate(iso)` ya existe en `ChildDetail.jsx` — usarlo para `completed_at`

- [ ] **Step 1: Escribir los tests que fallan**

**En `frontend/src/test/ChildDetail.test.jsx`:**

Localizar el objeto `mockChild` (línea ~38) y agregar el campo `scenarios_completed` dentro del objeto (después de `gamification_progress`):

```js
  scenarios_completed: [
    {
      scenario_id: 1,
      emoji: '🤝',
      title: 'Saludar a alguien nuevo',
      completed_at: '2026-07-01T10:00:00Z',
    },
  ],
```

Agregar al final del bloque `describe('ChildDetail', () => { ... })`, antes del cierre `})`:

```js
  it('tab Escenarios muestra escenarios completados con emoji, título y fecha', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Escenarios'))
    await userEvent.click(screen.getByText('Escenarios'))
    await waitFor(() => {
      expect(screen.getByText(/Saludar a alguien nuevo/)).toBeInTheDocument()
      expect(screen.getByText(/01\/07\/2026/)).toBeInTheDocument()
    })
  })
```

**En `frontend/src/test/PanelProfesional.test.jsx`:**

Localizar `mockChildren` (línea ~34) y agregar `total_scenarios_completed: 2` al único objeto de la lista:

```js
const mockChildren = [
  {
    child_profile_id: 1,
    name: 'Juan',
    age: 10,
    avatar_emoji: '⭐',
    last_emotion_key: 'nervioso',
    total_calm_sessions: 3,
    total_chats: 2,
    total_scenarios_completed: 2,
  },
]
```

Agregar al final del bloque `describe('PanelProfesional', () => { ... })`, antes del cierre `})`:

```js
  it('muestra total de escenarios completados en la tarjeta del niño', async () => {
    renderPanel()
    await waitFor(() => {
      expect(screen.getByText(/2 escenarios/)).toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: Verificar que los nuevos tests fallan**

```bash
cd frontend && npx vitest run src/test/ChildDetail.test.jsx src/test/PanelProfesional.test.jsx
```

Expected: el test de "tab Escenarios" y el de "total_scenarios_completed" FAIL. Los tests existentes deben seguir pasando (el mockChild ya incluye el campo nuevo).

- [ ] **Step 3: Actualizar `frontend/src/pages/ChildDetail.jsx`**

**Cambio 1:** Localizar la línea con `const TABS` (línea ~27) y reemplazarla:

```js
const TABS = ['Emociones', 'Calma', 'Conversaciones', 'Escenarios']
```

**Cambio 2:** Localizar el bloque del tab Conversaciones (termina justo antes del bloque `/* Nota del especialista */`). Agregar el siguiente bloque JSX inmediatamente después del cierre del bloque de Conversaciones (`}`):

```jsx
        {/* Tab: Escenarios */}
        {activeTab === 'Escenarios' && (
          <div className="flex flex-col gap-3">
            {child.scenarios_completed.length === 0 ? (
              <p className="text-base text-text-secondary text-center py-6">Sin escenarios completados.</p>
            ) : (
              child.scenarios_completed.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-calm-surface border border-calm-border">
                  <p className="text-base font-bold text-text-primary">
                    {s.emoji} {s.title}
                  </p>
                  <p className="text-base text-text-secondary">{formatDate(s.completed_at)}</p>
                </div>
              ))
            )}
          </div>
        )}
```

- [ ] **Step 4: Actualizar `frontend/src/pages/PanelProfesional.jsx`**

Localizar la línea que muestra el contador de chats y calma (línea ~79):

```jsx
                  <p className="text-base text-text-muted">
                    {child.total_chats} chats · {child.total_calm_sessions} calma
                  </p>
```

Reemplazarla con:

```jsx
                  <p className="text-base text-text-muted">
                    {child.total_chats} chats · {child.total_calm_sessions} calma · {child.total_scenarios_completed} escenarios
                  </p>
```

- [ ] **Step 5: Verificar que los nuevos tests pasan**

```bash
cd frontend && npx vitest run src/test/ChildDetail.test.jsx src/test/PanelProfesional.test.jsx
```

Expected: todos los tests de ambos archivos PASS.

- [ ] **Step 6: Verificar suite completa frontend**

```bash
cd frontend && npx vitest run
```

Expected: 100% PASS — sin regresiones.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ChildDetail.jsx frontend/src/pages/PanelProfesional.jsx frontend/src/test/ChildDetail.test.jsx frontend/src/test/PanelProfesional.test.jsx
git commit -m "feat: panel — tab Escenarios en ChildDetail y contador en lista de niños"
```
