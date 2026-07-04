# Panel Profesional — Escenarios Completados: Design Spec

**Fecha:** 2026-07-04  
**Autor:** Douglas Isturiz

---

## Contexto

El Panel Profesional ya muestra historial emocional, sesiones de calma, conversaciones de chat, nota del especialista y gamification. El único gap es que no expone los escenarios sociales completados por el niño. Esta spec cubre exactamente ese gap.

La tabla `scenario_completions` ya existe en la base de datos con los campos `user_id`, `scenario_id` y `completed_at`. Los metadatos de escenarios (emoji, título) viven en `_SCENARIO_MAP` dentro de `backend/app/services/scenario_service.py`.

---

## Cambios backend

### 1. `backend/app/schemas/panel.py`

Agregar nuevo schema:

```python
class ScenarioCompletedOut(BaseModel):
    scenario_id: int
    emoji: str
    title: str
    completed_at: datetime
```

Modificar `ChildSummaryOut` (agrega campo):

```python
class ChildSummaryOut(BaseModel):
    child_profile_id: int
    name: str
    age: int
    avatar_emoji: str
    last_emotion_key: str | None
    total_calm_sessions: int
    total_chats: int
    total_scenarios_completed: int   # nuevo
```

Modificar `ChildDetailOut` (agrega campo):

```python
class ChildDetailOut(BaseModel):
    child_profile_id: int
    name: str
    age: int
    avatar_emoji: str
    emotions: list[EmotionEntryOut]
    calm_sessions: list[CalmEntryOut]
    conversations: list[ConversationOut]
    scenarios_completed: list[ScenarioCompletedOut]   # nuevo
    specialist_note: str | None
    gamification_progress: GamificationProgressOut | None = None
```

### 2. `backend/app/services/panel_service.py`

En `list_children`: contar `ScenarioCompletion` por `user_id` del padre.

```python
from app.models.scenario_completion import ScenarioCompletion
from app.services.scenario_service import _SCENARIO_MAP

# dentro del loop por profile:
total_scenarios = db.query(ScenarioCompletion)\
    .filter(ScenarioCompletion.user_id == pid).count()

result.append({
    ...
    "total_scenarios_completed": total_scenarios,
})
```

En `get_child_detail`: obtener completions del niño ordenadas por fecha descendente, cruzar con `_SCENARIO_MAP` para emoji y título.

```python
completions = (
    db.query(ScenarioCompletion)
    .filter(ScenarioCompletion.user_id == pid)
    .order_by(ScenarioCompletion.completed_at.desc())
    .all()
)

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

return {
    ...
    "scenarios_completed": scenarios_completed,
}
```

### 3. `backend/tests/test_panel.py`

Nuevo test `test_child_detail_includes_scenarios_completed`:
- Crear parent + child + completar escenario 1 (`ScenarioCompletion`)
- `GET /api/v1/panel/children/{child_id}` → verificar `scenarios_completed` tiene 1 ítem con `scenario_id=1`, `emoji`, `title`, `completed_at`

Nuevo test `test_list_children_includes_total_scenarios_completed`:
- Crear parent + child + 2 completions
- `GET /api/v1/panel/children` → verificar `total_scenarios_completed == 2`

---

## Cambios frontend

### 1. `frontend/src/pages/ChildDetail.jsx`

**Agregar tab "Escenarios":**

```js
const TABS = ['Emociones', 'Calma', 'Conversaciones', 'Escenarios']
```

**Contenido del tab Escenarios:**

```jsx
{activeTab === 'Escenarios' && (
  <div className="flex flex-col gap-3">
    {child.scenarios_completed.length === 0 ? (
      <p className="text-base text-text-secondary text-center py-6">
        Sin escenarios completados.
      </p>
    ) : (
      child.scenarios_completed.map((s, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-2xl bg-calm-surface border border-calm-border"
        >
          <p className="text-base font-bold text-text-primary">
            {s.emoji} {s.title}
          </p>
          <p className="text-base text-text-secondary">
            {formatDate(s.completed_at)}
          </p>
        </div>
      ))
    )}
  </div>
)}
```

**Agregar `scenarios_completed` al mock data local** (campo en `setChild`): ya viene del API, no requiere estado separado.

### 2. `frontend/src/pages/PanelProfesional.jsx`

En la tarjeta resumen de cada niño, agregar `total_scenarios_completed` junto a los otros contadores:

```jsx
<p className="text-base text-text-muted">
  {child.total_chats} chats · {child.total_calm_sessions} calma · {child.total_scenarios_completed} escenarios
</p>
```

### 3. Tests frontend

**`frontend/src/test/ChildDetail.test.jsx`**

Agregar `scenarios_completed` al `mockChild`:

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

Nuevo test:

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

**`frontend/src/test/PanelProfesional.test.jsx`**

Actualizar `mockChildren` para incluir `total_scenarios_completed: 2`.

Nuevo test:

```js
it('muestra total de escenarios completados en la tarjeta del niño', async () => {
  renderPanel()
  await waitFor(() => {
    expect(screen.getByText(/2 escenarios/)).toBeInTheDocument()
  })
})
```

---

## Restricciones

- Sin cambios al router (`panel.py`) — los endpoints existentes ya devuelven el response_model completo.
- Sin nuevas rutas ni endpoints.
- `_SCENARIO_MAP` se importa directamente desde `scenario_service`; si un `scenario_id` no existe en el mapa (escenario eliminado/deprecado), se usa fallback `"🌟"` / `"Escenario {id}"`.
- No limitar cantidad de scenarios_completed devueltos (los escenarios son 5 en V1, no hay riesgo de payload excesivo).
- Seguir TDD: tests fallan primero, luego implementar.
