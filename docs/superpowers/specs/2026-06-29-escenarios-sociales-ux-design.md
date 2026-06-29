# Diseño: Escenarios Sociales — Progreso y Check-in Post-Escenario

**Fecha:** 2026-06-29
**Proyecto:** SocialMind
**Módulo:** Escenarios Sociales (`/escenarios`, `/escenarios/:id`)
**Estado:** Aprobado

---

## Contexto

Los Escenarios Sociales tienen un flujo completo de 5 pasos (objetivo → explicación → práctica → retroalimentación → cierre) con 5 escenarios hardcodeados y gamificación integrada. Dos gaps de UX quedan abiertos:

1. **Progreso invisible** — `ScenarioList` no indica cuáles escenarios ya completó el niño. Todos los cards se ven igual sin importar el historial.
2. **Fin abrupto** — al pulsar "¡Terminar!" el flujo navega directo a `/escenarios` sin despedida de Lumi ni check-in emocional. ZonaCalma sí tiene `PostActivityCheckin`; Escenarios no.

Esta spec agrega:
1. **Campo `completed`** en `GET /scenarios` (requiere auth) y visual de checkmark verde en cards completados
2. **`PostScenarioCheckin`** — pantalla de felicitación con badge, Lumi y selector emocional antes de salir

El niño puede repetir escenarios completados — el checkmark es informativo, no bloqueante.

---

## Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `backend/app/schemas/scenarios.py` | Agregar `completed: bool` a `ScenarioMeta` |
| `backend/app/services/scenario_service.py` | `list_scenarios(db, user_id)` consulta completions |
| `backend/app/routers/scenarios.py` | `GET /scenarios` agrega auth + db |
| `backend/tests/test_scenarios.py` | Ajustar tests para auth + `completed` |
| `frontend/src/components/scenarios/PostScenarioCheckin.jsx` | **Nuevo** |
| `frontend/src/pages/ScenarioList.jsx` | Mostrar checkmark en completados |
| `frontend/src/pages/ScenarioFlow.jsx` | Fase `checkin` tras terminar |
| `frontend/src/test/PostScenarioCheckin.test.jsx` | **Nuevo** — 3 tests |
| `frontend/src/test/ScenarioList.test.jsx` | Ajustar mock + agregar test de completado |
| `frontend/src/test/ScenarioFlow.test.jsx` | Agregar test de fase checkin |

**Sin cambios en:** `api.js`, `router/index.jsx`, `ChatIA.jsx`, `ZonaCalma.jsx`, `PostActivityCheckin.jsx`, gamificación, `ScenarioCompletion` model, migraciones.

---

## Gap 1: Campo `completed` en `GET /scenarios`

### Backend — `ScenarioMeta` schema

```python
class ScenarioMeta(BaseModel):
    id: int
    emoji: str
    title: str
    description: str
    completed: bool = False
```

### Backend — `list_scenarios`

```python
# Antes:
def list_scenarios() -> list[ScenarioMeta]:
    sorted_scenarios = sorted(_SCENARIO_MAP.values(), key=lambda s: s.id)
    return [ScenarioMeta(id=s.id, emoji=s.emoji, title=s.title, description=s.description)
            for s in sorted_scenarios]

# Después:
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

Nota: agregar `from sqlalchemy.orm import Session` y `from app.models.scenario_completion import ScenarioCompletion` si no están presentes.

### Backend — router `GET /scenarios`

```python
# Antes:
@router.get("", response_model=list[ScenarioMeta])
def get_scenarios():
    return list_scenarios()

# Después:
@router.get("", response_model=list[ScenarioMeta])
def get_scenarios(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_scenarios(db, current_user.id)
```

### Backend — tests ajustados (`test_scenarios.py`)

**`test_list_scenarios`** — pasar token de usuario autenticado y verificar campo `completed`:

```python
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
    assert all("completed" in s for s in data)
    assert all(s["completed"] is False for s in data)
```

**Nuevo test** — completar un escenario y verificar que aparece como `completed: true`:

```python
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

**Nuevo test** — sin token devuelve 401:

```python
def test_list_scenarios_unauthenticated(client):
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 401
```

### Frontend — `ScenarioList.jsx`

El campo `completed` ya llega en `res.data` de `scenariosApi.list()` — no requiere cambios en `api.js`.

**Indicador visual:** borde verde + checkmark en la esquina derecha:

```jsx
// Antes — borde fijo:
className="
  flex items-center gap-4 p-5 rounded-3xl
  bg-calm-surface border-2 border-calm-border
  hover:border-primary-500 hover:bg-primary-50
  transition-colors text-left w-full min-h-[72px]
"
aria-label={`Practicar: ${scenario.title}`}

// Después — borde dinámico + aria-label actualizado:
className={`
  flex items-center gap-4 p-5 rounded-3xl
  bg-calm-surface border-2
  ${scenario.completed
    ? 'border-secondary-500 hover:border-secondary-600'
    : 'border-calm-border hover:border-primary-500 hover:bg-primary-50'}
  transition-colors text-left w-full min-h-[72px]
`}
aria-label={`${scenario.completed ? 'Repetir' : 'Practicar'}: ${scenario.title}`}
```

**Checkmark y flecha:**

```jsx
// Antes — solo flecha:
<span className="ml-auto text-text-muted text-xl">›</span>

// Después — checkmark si completado, sino flecha:
{scenario.completed
  ? <span className="ml-auto text-secondary-500 font-bold text-lg" aria-label="Completado">✓</span>
  : <span className="ml-auto text-text-muted text-xl">›</span>
}
```

### Frontend — `ScenarioList.test.jsx` (ajustar + nuevo test)

**Ajustar mock** — agregar `completed` a los datos devueltos:

```jsx
vi.mock('../services/api', () => ({
  scenariosApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: 1, emoji: '🙋', title: 'Saludar',              description: 'Aprende a saludar',    completed: false },
        { id: 2, emoji: '💬', title: 'Hablar con compañero', description: 'Inicia conversación',  completed: true  },
      ],
    }),
  },
}))
```

**Ajustar test existente** — el mock ahora devuelve datos en lugar de error:

```jsx
// Mantener el test de error pero separar en describe('ScenarioList'):

describe('ScenarioList', () => {
  it('muestra error cuando falla la carga', async () => {
    scenariosApi.list.mockRejectedValueOnce(new Error('Network error'))
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('No pudimos cargar los escenarios. Intenta de nuevo.')).toBeInTheDocument()
    })
  })

  it('muestra checkmark en escenario completado', async () => {
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByLabelText('Repetir: Hablar con compañero')).toBeInTheDocument()
      expect(screen.getByLabelText('Practicar: Saludar')).toBeInTheDocument()
    })
  })
})
```

---

## Gap 2: `PostScenarioCheckin` y fase `checkin` en ScenarioFlow

### Componente `PostScenarioCheckin`

**Archivo:** `frontend/src/components/scenarios/PostScenarioCheckin.jsx`

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

### Integración en `ScenarioFlow.jsx`

**Imports a agregar** (después de los imports existentes):

```jsx
import { PostScenarioCheckin } from '../components/scenarios/PostScenarioCheckin'
```

**Estado nuevo** (después de `completing`):

```jsx
const [phase, setPhase] = useState('flow') // 'flow' | 'checkin'
```

**`badgeEmoji`** (derivado del scenario, después de cargar):

```jsx
const badgeEmoji = scenario?.steps.find(s => s.type === 'closing')?.badge_emoji ?? '🌟'
```

**`handleNext` — reemplazar la rama `isLast`:**

```jsx
// Antes:
if (isLast) {
  setCompleting(true)
  try { await scenariosApi.complete(scenario.id) } catch { /* continúa */ }
  navigate('/escenarios')
  return
}

// Después:
if (isLast) {
  setCompleting(true)
  try { await scenariosApi.complete(scenario.id) } catch { /* continúa */ }
  setPhase('checkin')
  return
}
```

**Render block** (insertar antes del `return` principal, después de `if (loading || !scenario)`):

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

### `PostScenarioCheckin.test.jsx` (nuevo — 3 tests)

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

beforeEach(() => { onDone.mockClear(); emotionsApi.log.mockClear() })

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

### `ScenarioFlow.test.jsx` — nuevo test (fase checkin)

Agregar al final del `describe('ScenarioFlow')`:

```jsx
it('al terminar el flujo muestra la pantalla de check-in post-escenario', async () => {
  renderScenario()

  // Step 0: objective
  await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
  await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

  // Step 1: explanation
  await waitFor(() => screen.getByText('¿Cómo se hace?'))
  await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

  // Step 2: practice — seleccionar respuesta correcta
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

  // Debe mostrar el check-in, no navegar a /escenarios todavía
  await waitFor(() => {
    expect(screen.getByText(/Completaste «Saludar»/)).toBeInTheDocument()
    expect(screen.getByLabelText('Feliz')).toBeInTheDocument()
  })
  expect(mockNavigate).not.toHaveBeenCalledWith('/escenarios')
}, 15000)
```

---

## Sin Cambios En

- `backend/app/models/` — ningún modelo cambia
- Migraciones de alembic — ninguna tabla cambia
- `frontend/src/services/api.js` — `scenariosApi.list()` y `emotionsApi.log()` ya existen
- `frontend/src/router/index.jsx` — no hay rutas nuevas
- `PostActivityCheckin.jsx` — no se toca
- Gamificación — ya integrada en `complete_scenario_endpoint`
