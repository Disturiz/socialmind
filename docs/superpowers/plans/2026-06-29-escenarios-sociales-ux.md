# Escenarios Sociales — Progreso y Check-in Post-Escenario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar progreso de escenarios completados en ScenarioList y añadir check-in emocional post-escenario en lugar de navegación directa a `/escenarios`.

**Architecture:** El backend agrega `completed: bool` a `GET /scenarios` (requiere auth, consulta `scenario_completions`). En frontend: nuevo componente `PostScenarioCheckin` (análogo a `PostActivityCheckin`), indicador visual en `ScenarioList`, y fase `checkin` en `ScenarioFlow` que muestra el componente antes de navegar.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React 18 + Framer Motion + Tailwind CSS + Vitest + @testing-library/react (frontend)

## Global Constraints

- Sin cambios en modelos SQLAlchemy ni migraciones de alembic — `scenario_completions` ya existe
- Sin cambios en `api.js`, `router/index.jsx`, `PostActivityCheckin.jsx`, gamificación
- Mensaje exacto del check-in: `"¡Completaste «{scenarioTitle}»! ¿Cómo te sientes ahora?"`
- Indicador de completado: borde `border-secondary-500`, checkmark `✓` con `aria-label="Completado"`
- `aria-label` del card completado: `"Repetir: {scenario.title}"` — incompleto: `"Practicar: {scenario.title}"`
- `badgeEmoji` se obtiene de `scenario.steps.find(s => s.type === 'closing')?.badge_emoji ?? '🌟'`
- Fase nueva en ScenarioFlow: `phase: 'flow' | 'checkin'` — al terminar: `setPhase('checkin')` (no `navigate`)
- Comando tests backend: `cd backend && python -m pytest tests/test_scenarios.py -v`
- Comando tests frontend (archivo): `cd frontend && npm test -- --run src/test/<archivo>.test.jsx`
- Comando suite completa frontend: `cd frontend && npm test -- --run`

---

### Task 1: Backend — campo `completed` en `GET /scenarios`

**Files:**
- Modify: `backend/app/schemas/scenarios.py`
- Modify: `backend/app/services/scenario_service.py`
- Modify: `backend/app/routers/scenarios.py`
- Modify: `backend/tests/test_scenarios.py`

**Interfaces:**
- Consumes: `ScenarioCompletion` model (ya existe en `app/models/scenario_completion.py`)
- Produces:
  - `ScenarioMeta` con campo `completed: bool = False`
  - `list_scenarios(db: Session, user_id: int) -> list[ScenarioMeta]`
  - `GET /api/v1/scenarios` requiere Bearer token, devuelve `completed` por usuario

- [ ] **Step 1: Modificar `test_scenarios.py` — ajustar y agregar tests**

Abrir `backend/tests/test_scenarios.py`.

**Reemplazar** `test_list_scenarios` (buscar el bloque exacto):

```python
# ANTES:
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

# DESPUÉS:
def test_list_scenarios(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre_list@test.com", "password": "Password123!",
        "full_name": "Padre List", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "padre_list@test.com", "password": "Password123!",
    })
    token = login.json()["access_token"]
    response = client.get("/api/v1/scenarios", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    titles = [s["title"] for s in data]
    assert "Saludar" in titles
    assert "Hablar con un compañero" in titles
    assert "Pedir ayuda" in titles
    assert "Esperar turno" in titles
    assert "Manejar la frustración" in titles
    assert all("completed" in s for s in data)
    assert all(s["completed"] is False for s in data)
```

**Agregar al final del archivo** (después del último test existente):

```python
def test_list_scenarios_unauthenticated(client):
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 401


def test_list_scenarios_shows_completed(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre_comp@test.com", "password": "Password123!",
        "full_name": "Padre Comp", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "padre_comp@test.com", "password": "Password123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/scenarios/1/complete", headers=headers)

    response = client.get("/api/v1/scenarios", headers=headers)
    data = response.json()
    scenario_1 = next(s for s in data if s["id"] == 1)
    scenario_2 = next(s for s in data if s["id"] == 2)
    assert scenario_1["completed"] is True
    assert scenario_2["completed"] is False
```

- [ ] **Step 2: Verificar que los tests nuevos/ajustados fallan**

```bash
cd backend && python -m pytest tests/test_scenarios.py -v
```

Expected: `test_list_scenarios` FAIL (401), `test_list_scenarios_unauthenticated` FAIL (200 en lugar de 401), `test_list_scenarios_shows_completed` FAIL. Los demás tests existentes pueden pasar o fallar — no importa.

- [ ] **Step 3: Modificar `ScenarioMeta` en `schemas/scenarios.py`**

Abrir `backend/app/schemas/scenarios.py`.

Reemplazar:
```python
class ScenarioMeta(BaseModel):
    id: int
    emoji: str
    title: str
    description: str
```

Con:
```python
class ScenarioMeta(BaseModel):
    id: int
    emoji: str
    title: str
    description: str
    completed: bool = False
```

- [ ] **Step 4: Modificar `list_scenarios` en `scenario_service.py`**

Abrir `backend/app/services/scenario_service.py`.

Agregar imports al inicio (después de los imports existentes, si no están):
```python
from sqlalchemy.orm import Session
from app.models.scenario_completion import ScenarioCompletion
```

Reemplazar la función `list_scenarios`:
```python
# ANTES:
def list_scenarios() -> list[ScenarioMeta]:
    sorted_scenarios = sorted(_SCENARIO_MAP.values(), key=lambda s: s.id)
    return [ScenarioMeta(id=s.id, emoji=s.emoji, title=s.title, description=s.description)
            for s in sorted_scenarios]

# DESPUÉS:
def list_scenarios(db: Session, user_id: int) -> list[ScenarioMeta]:
    sorted_scenarios = sorted(_SCENARIO_MAP.values(), key=lambda s: s.id)
    completed_ids = {
        row.scenario_id
        for row in db.query(ScenarioCompletion.scenario_id)
            .filter(ScenarioCompletion.user_id == user_id)
            .all()
    }
    return [
        ScenarioMeta(
            id=s.id, emoji=s.emoji, title=s.title, description=s.description,
            completed=s.id in completed_ids,
        )
        for s in sorted_scenarios
    ]
```

- [ ] **Step 5: Modificar el endpoint `GET /scenarios` en `routers/scenarios.py`**

Abrir `backend/app/routers/scenarios.py`.

El archivo ya importa `get_current_user`, `User`, `get_db`, `Session` (los usan otros endpoints). Si falta alguno, agregar.

Reemplazar:
```python
@router.get("", response_model=list[ScenarioMeta])
def get_scenarios():
    return list_scenarios()
```

Con:
```python
@router.get("", response_model=list[ScenarioMeta])
def get_scenarios(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_scenarios(db, current_user.id)
```

- [ ] **Step 6: Verificar que los 3 tests nuevos pasan y la suite completa de scenarios pasa**

```bash
cd backend && python -m pytest tests/test_scenarios.py -v
```

Expected: todos los tests de `test_scenarios.py` PASS (los originales + los 3 nuevos/ajustados).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/scenarios.py \
        backend/app/services/scenario_service.py \
        backend/app/routers/scenarios.py \
        backend/tests/test_scenarios.py
git commit -m "feat: GET /scenarios requiere auth y devuelve completed por usuario"
```

---

### Task 2: Componente `PostScenarioCheckin`

**Files:**
- Create: `frontend/src/components/scenarios/PostScenarioCheckin.jsx`
- Create: `frontend/src/test/PostScenarioCheckin.test.jsx`

**Interfaces:**
- Consumes: `emotionsApi.log(key: string)` de `'../../services/api'` (ya existe)
- Produces:
  - `export function PostScenarioCheckin({ badgeEmoji, scenarioTitle, onDone })`
  - `badgeEmoji: string` — emoji del cierre del escenario
  - `scenarioTitle: string` — título del escenario para el mensaje
  - `onDone: () => void` — callback al seleccionar emoción o saltar

- [ ] **Step 1: Crear el archivo de test**

Crear `frontend/src/test/PostScenarioCheckin.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PostScenarioCheckin } from '../components/scenarios/PostScenarioCheckin'

vi.mock('../services/api', () => ({
  emotionsApi: { log: vi.fn().mockResolvedValue({}) },
}))

import { emotionsApi } from '../services/api'

const onDone = vi.fn()

beforeEach(() => {
  onDone.mockClear()
  emotionsApi.log.mockClear()
})

function renderCheckin(props = {}) {
  return render(
    <PostScenarioCheckin
      badgeEmoji="🌟"
      scenarioTitle="Saludar"
      onDone={onDone}
      {...props}
    />
  )
}

describe('PostScenarioCheckin', () => {
  it('muestra el badge y el mensaje con el título del escenario', () => {
    renderCheckin()
    expect(screen.getByRole('img', { name: /insignia/i })).toBeInTheDocument()
    expect(screen.getByText(/Completaste «Saludar»/)).toBeInTheDocument()
  })

  it('seleccionar emoción llama emotionsApi.log y onDone', async () => {
    renderCheckin()
    await userEvent.click(screen.getByLabelText('Feliz'))
    await waitFor(() => {
      expect(emotionsApi.log).toHaveBeenCalledWith('feliz')
      expect(onDone).toHaveBeenCalled()
    })
  })

  it('saltar por ahora llama onDone sin registrar emoción', async () => {
    renderCheckin()
    await userEvent.click(screen.getByLabelText('Saltar por ahora'))
    expect(onDone).toHaveBeenCalled()
    expect(emotionsApi.log).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd frontend && npm test -- --run src/test/PostScenarioCheckin.test.jsx
```

Expected: FAIL con `Cannot find module '../components/scenarios/PostScenarioCheckin'`

- [ ] **Step 3: Crear el componente**

Crear `frontend/src/components/scenarios/PostScenarioCheckin.jsx`:

```jsx
import { motion } from 'framer-motion'
import { emotionsApi } from '../../services/api'
import { LumiCharacter } from '../lumi/LumiCharacter'
import { Button } from '../ui/Button'

const EMOTIONS = [
  { key: 'feliz',      label: 'Feliz',      emoji: '😊' },
  { key: 'nervioso',   label: 'Nervioso',   emoji: '😰' },
  { key: 'confundido', label: 'Confundido', emoji: '🤔' },
  { key: 'frustrado',  label: 'Frustrado',  emoji: '😤' },
  { key: 'cansado',    label: 'Cansado',    emoji: '😴' },
]

const EMOTION_COLORS = {
  feliz:      'bg-primary-100 border-primary-500',
  nervioso:   'bg-primary-50 border-accent-yellow',
  confundido: 'bg-secondary-100 border-secondary-500',
  frustrado:  'bg-primary-50 border-accent-coral',
  cansado:    'bg-calm-bg border-calm-border',
}

export function PostScenarioCheckin({ badgeEmoji, scenarioTitle, onDone }) {
  async function handleEmotionSelect(key) {
    try { await emotionsApi.log(key) } catch { /* fire-and-forget */ }
    onDone()
  }

  return (
    <div className="max-w-md w-full flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="text-6xl"
          role="img"
          aria-label="Insignia de logro"
        >
          {badgeEmoji}
        </motion.div>
        <LumiCharacter state="happy" size={90} />
        <div className="bg-calm-surface rounded-2xl p-4 text-base text-text-primary">
          ¡Completaste «{scenarioTitle}»! ¿Cómo te sientes ahora?
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        {EMOTIONS.map((emotion, i) => (
          <motion.button
            key={emotion.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleEmotionSelect(emotion.key)}
            className={`
              flex flex-col items-center gap-2 p-5 rounded-3xl border-2
              min-h-[100px] cursor-pointer transition-all
              focus:outline-none focus:ring-4 focus:ring-primary-100
              ${EMOTION_COLORS[emotion.key]}
            `}
            aria-label={emotion.label}
          >
            <span className="text-5xl leading-none" role="img" aria-hidden="true">
              {emotion.emoji}
            </span>
            <span className="text-base font-bold text-text-primary">{emotion.label}</span>
          </motion.button>
        ))}
      </div>

      <Button
        variant="ghost"
        className="w-full mt-2"
        aria-label="Saltar por ahora"
        onClick={onDone}
      >
        Saltar por ahora
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Verificar que los 3 tests pasan**

```bash
cd frontend && npm test -- --run src/test/PostScenarioCheckin.test.jsx
```

Expected: `3 passed`

- [ ] **Step 5: Verificar suite frontend completa sin regresiones**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests pasan (66 + 3 nuevos = 69)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/scenarios/PostScenarioCheckin.jsx \
        frontend/src/test/PostScenarioCheckin.test.jsx
git commit -m "feat: PostScenarioCheckin — badge, Lumi y check-in emocional post-escenario"
```

---

### Task 3: ScenarioList — indicador de progreso

**Files:**
- Modify: `frontend/src/pages/ScenarioList.jsx`
- Modify: `frontend/src/test/ScenarioList.test.jsx`

**Interfaces:**
- Consumes (de Task 1): `scenariosApi.list()` devuelve `{ id, emoji, title, description, completed: bool }`
- Produces: cards con `border-secondary-500` y `✓` cuando `completed: true`; `aria-label` diferencia "Repetir"/"Practicar"

- [ ] **Step 1: Modificar `ScenarioList.test.jsx`**

Reemplazar el contenido completo de `frontend/src/test/ScenarioList.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it } from 'vitest'
import { ScenarioList } from '../pages/ScenarioList'

vi.mock('../services/api', () => ({
  scenariosApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: 1, emoji: '🙋', title: 'Saludar',              description: 'Aprende a saludar',   completed: false },
        { id: 2, emoji: '💬', title: 'Hablar con compañero', description: 'Inicia conversación', completed: true  },
      ],
    }),
  },
}))

import { scenariosApi } from '../services/api'

describe('ScenarioList', () => {
  it('muestra error cuando falla la carga de escenarios', async () => {
    scenariosApi.list.mockRejectedValueOnce(new Error('Network error'))
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('No pudimos cargar los escenarios. Intenta de nuevo.')).toBeInTheDocument()
    })
  })

  it('muestra checkmark y aria-label "Repetir" en escenario completado', async () => {
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByLabelText('Repetir: Hablar con compañero')).toBeInTheDocument()
    })
  })

  it('muestra aria-label "Practicar" en escenario no completado', async () => {
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByLabelText('Practicar: Saludar')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Verificar que los tests nuevos fallan**

```bash
cd frontend && npm test -- --run src/test/ScenarioList.test.jsx
```

Expected: "muestra checkmark" y "aria-label Practicar" FAIL; el test de error puede pasar o fallar.

- [ ] **Step 3: Modificar `ScenarioList.jsx`**

Abrir `frontend/src/pages/ScenarioList.jsx`.

Reemplazar el bloque del `motion.button` (buscar desde `<motion.button` hasta el `</motion.button>` dentro del `.map`):

```jsx
// ANTES:
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
                  <p className="font-bold text-text-primary text-base">{scenario.title}</p>
                  <p className="text-base text-text-muted">{scenario.description}</p>
                </div>
                <span className="ml-auto text-text-muted text-xl">›</span>
              </motion.button>

// DESPUÉS:
              <motion.button
                key={scenario.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/escenarios/${scenario.id}`)}
                className={`
                  flex items-center gap-4 p-5 rounded-3xl
                  bg-calm-surface border-2
                  ${scenario.completed
                    ? 'border-secondary-500 hover:border-secondary-600'
                    : 'border-calm-border hover:border-primary-500 hover:bg-primary-50'}
                  transition-colors text-left w-full min-h-[72px]
                `}
                aria-label={`${scenario.completed ? 'Repetir' : 'Practicar'}: ${scenario.title}`}
              >
                <span className="text-4xl leading-none flex-shrink-0" role="img" aria-hidden="true">
                  {scenario.emoji}
                </span>
                <div>
                  <p className="font-bold text-text-primary text-base">{scenario.title}</p>
                  <p className="text-base text-text-muted">{scenario.description}</p>
                </div>
                {scenario.completed
                  ? <span className="ml-auto text-secondary-500 font-bold text-lg" aria-label="Completado">✓</span>
                  : <span className="ml-auto text-text-muted text-xl">›</span>
                }
              </motion.button>
```

- [ ] **Step 4: Verificar que los 3 tests de ScenarioList pasan**

```bash
cd frontend && npm test -- --run src/test/ScenarioList.test.jsx
```

Expected: `3 passed`

- [ ] **Step 5: Verificar suite frontend completa**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests pasan (69 + 2 nuevos = 71)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ScenarioList.jsx \
        frontend/src/test/ScenarioList.test.jsx
git commit -m "feat: ScenarioList — indicador visual de progreso en escenarios completados"
```

---

### Task 4: ScenarioFlow — fase `checkin` post-escenario

**Files:**
- Modify: `frontend/src/pages/ScenarioFlow.jsx`
- Modify: `frontend/src/test/ScenarioFlow.test.jsx`

**Interfaces:**
- Consumes (de Task 2):
  - `import { PostScenarioCheckin } from '../components/scenarios/PostScenarioCheckin'`
  - `<PostScenarioCheckin badgeEmoji={string} scenarioTitle={string} onDone={() => void} />`

- [ ] **Step 1: Agregar test de fase checkin a `ScenarioFlow.test.jsx`**

Abrir `frontend/src/test/ScenarioFlow.test.jsx`.

Agregar al final del `describe('ScenarioFlow', () => {` block, antes del cierre `})`:

```jsx
  it('al terminar el flujo muestra la pantalla de check-in post-escenario', async () => {
    renderScenario()

    // Step 0: objective
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 1: explanation
    await waitFor(() => screen.getByText('¿Cómo se hace?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 2: practice — seleccionar respuesta correcta y esperar timeout
    await waitFor(() => screen.getByText('Practiquemos'))
    await userEvent.click(screen.getByText('Digo Hola'))
    await waitFor(() => screen.getByRole('button', { name: /siguiente/i }), { timeout: 3000 })
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 3: feedback
    await waitFor(() => screen.getByText('Retroalimentación'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 4: closing → Terminar
    await waitFor(() => screen.getByText('¡Lo lograste!'))
    await userEvent.click(screen.getByRole('button', { name: /terminar/i }))

    // Debe mostrar el check-in, NO navegar a /escenarios todavía
    await waitFor(() => {
      expect(screen.getByText(/Completaste «Saludar»/)).toBeInTheDocument()
      expect(screen.getByLabelText('Feliz')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/escenarios')
  }, 15000)
```

- [ ] **Step 2: Verificar que el test nuevo falla**

```bash
cd frontend && npm test -- --run src/test/ScenarioFlow.test.jsx
```

Expected: el nuevo test FAIL (navega a /escenarios en lugar de mostrar el check-in); los 5 tests anteriores PASS.

- [ ] **Step 3: Agregar import de `PostScenarioCheckin` en `ScenarioFlow.jsx`**

Abrir `frontend/src/pages/ScenarioFlow.jsx`.

Agregar después de los imports existentes (antes de la primera función):

```jsx
import { PostScenarioCheckin } from '../components/scenarios/PostScenarioCheckin'
```

- [ ] **Step 4: Agregar estado `phase` y `badgeEmoji` en `ScenarioFlow`**

Dentro de la función `ScenarioFlow`, agregar después de `const [completing, setCompleting] = useState(false)`:

```jsx
const [phase, setPhase] = useState('flow')
```

Agregar después del guard `if (loading || !scenario)` (es decir, una vez que `scenario` está disponible):

```jsx
const badgeEmoji = scenario.steps.find(s => s.type === 'closing')?.badge_emoji ?? '🌟'
```

- [ ] **Step 5: Modificar `handleNext` — reemplazar `navigate` por `setPhase`**

Dentro de `handleNext`, reemplazar la rama `isLast`:

```jsx
// ANTES:
    if (isLast) {
      setCompleting(true)
      try { await scenariosApi.complete(scenario.id) } catch { /* continúa */ }
      navigate('/escenarios')
      return
    }

// DESPUÉS:
    if (isLast) {
      setCompleting(true)
      try { await scenariosApi.complete(scenario.id) } catch { /* continúa */ }
      setPhase('checkin')
      return
    }
```

- [ ] **Step 6: Agregar render block de fase `checkin`**

Insertar el siguiente bloque inmediatamente después de `if (loading || !scenario) { return (...) }` y antes de las constantes `currentStep`, `isLast`, etc.:

```jsx
  if (phase === 'checkin') {
    return (
      <PageWrapper className="items-center justify-center px-6 py-10">
        <PostScenarioCheckin
          badgeEmoji={badgeEmoji}
          scenarioTitle={scenario.title}
          onDone={() => navigate('/escenarios')}
        />
      </PageWrapper>
    )
  }
```

- [ ] **Step 7: Verificar que los 6 tests de ScenarioFlow pasan**

```bash
cd frontend && npm test -- --run src/test/ScenarioFlow.test.jsx
```

Expected: `6 passed`

- [ ] **Step 8: Verificar suite frontend completa**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests pasan (71 + 1 nuevo = 72)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ScenarioFlow.jsx \
        frontend/src/test/ScenarioFlow.test.jsx
git commit -m "feat: ScenarioFlow — fase checkin con PostScenarioCheckin tras completar escenario"
```
