# Panel del Especialista — Tendencia Emocional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un gráfico de distribución emocional semanal al detalle del niño en el panel del especialista, y reemplazar claves crudas de emociones por emoji + label en ambas páginas del panel.

**Architecture:** Un nuevo componente `EmotionDistributionChart` calcula frecuencias localmente a partir del array ya devuelto por `GET /panel/children/:id` (sin cambios en backend). Exporta también `EMOTION_META` como named export para reutilizar en `ChildDetail` y `PanelProfesional`. Las barras se animan con Framer Motion (ya instalado).

**Tech Stack:** React 18, Framer Motion (ya instalado), Tailwind CSS, Vitest + @testing-library/react

## Global Constraints

- Sin cambios en backend, `api.js`, ni `router/index.jsx`
- `EMOTION_META` se define UNA sola vez en `EmotionDistributionChart.jsx` y se importa desde allí — no duplicar el objeto en ningún otro archivo
- Clases Tailwind de barras: `bg-primary-500` (feliz), `bg-accent-yellow` (nervioso), `bg-secondary-500` (confundido), `bg-accent-coral` (frustrado), `bg-calm-border` (cansado)
- Animación Framer Motion: `initial={{ width: 0 }}`, `animate={{ width: '...' }}`, `transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}`
- Accesibilidad: `role="img"` + `aria-label="Distribución de emociones de la última semana"` en el contenedor; `aria-label={\`${label}: ${count} veces\`}` en cada fila
- Texto en español: "Emociones esta semana", "Sin emociones registradas esta semana."
- Comando de tests: `cd frontend && npm test -- --run` (debe pasar 100%)

---

### Task 1: Componente EmotionDistributionChart

**Files:**
- Create: `frontend/src/components/panel/EmotionDistributionChart.jsx`
- Create: `frontend/src/test/EmotionDistributionChart.test.jsx`

**Interfaces:**
- Consumes: nada de tareas anteriores
- Produces:
  - `export const EMOTION_META` — objeto con emoji, label y clase de barra por cada emoción; Tasks 2 y 3 lo importan desde este archivo
  - `export function EmotionDistributionChart({ emotions })` — Task 2 lo importa y renderiza

- [ ] **Step 1: Crear el archivo de test**

Crear `frontend/src/test/EmotionDistributionChart.test.jsx` con el siguiente contenido completo:

```jsx
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EmotionDistributionChart } from '../components/panel/EmotionDistributionChart'

const FIXED_NOW = new Date('2026-06-28T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

const emotions = [
  { emotion_key: 'nervioso', logged_at: '2026-06-27T10:00:00Z' }, // dentro — 1 día atrás
  { emotion_key: 'nervioso', logged_at: '2026-06-26T10:00:00Z' }, // dentro — 2 días atrás
  { emotion_key: 'feliz',    logged_at: '2026-06-25T10:00:00Z' }, // dentro — 3 días atrás
  { emotion_key: 'cansado',  logged_at: '2026-06-10T10:00:00Z' }, // fuera — 18 días atrás
]

describe('EmotionDistributionChart', () => {
  it('muestra emociones de los últimos 7 días', () => {
    render(<EmotionDistributionChart emotions={emotions} />)
    expect(screen.getByText(/Nervioso/)).toBeInTheDocument()
    expect(screen.getByText(/Feliz/)).toBeInTheDocument()
  })

  it('no muestra emociones fuera de los 7 días', () => {
    render(<EmotionDistributionChart emotions={emotions} />)
    expect(screen.queryByText(/Cansado/)).not.toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay emociones esta semana', () => {
    render(<EmotionDistributionChart emotions={[]} />)
    expect(screen.getByText('Sin emociones registradas esta semana.')).toBeInTheDocument()
  })

  it('ordena emociones por frecuencia descendente', () => {
    render(<EmotionDistributionChart emotions={emotions} />)
    const rows = screen.getAllByLabelText(/veces/i)
    expect(rows[0]).toHaveAccessibleName(/Nervioso.*2 veces/i)
    expect(rows[1]).toHaveAccessibleName(/Feliz.*1 veces/i)
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd frontend && npm test -- --run src/test/EmotionDistributionChart.test.jsx
```

Expected: FAIL con `Cannot find module '../components/panel/EmotionDistributionChart'`

- [ ] **Step 3: Crear el componente**

Crear `frontend/src/components/panel/EmotionDistributionChart.jsx` con el siguiente contenido completo:

```jsx
import { motion } from 'framer-motion'

export const EMOTION_META = {
  feliz:      { emoji: '😊', label: 'Feliz',      bar: 'bg-primary-500'   },
  nervioso:   { emoji: '😰', label: 'Nervioso',   bar: 'bg-accent-yellow' },
  confundido: { emoji: '🤔', label: 'Confundido', bar: 'bg-secondary-500' },
  frustrado:  { emoji: '😤', label: 'Frustrado',  bar: 'bg-accent-coral'  },
  cansado:    { emoji: '😴', label: 'Cansado',    bar: 'bg-calm-border'   },
}

export function EmotionDistributionChart({ emotions }) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const counts = emotions
    .filter(e => new Date(e.logged_at) >= cutoff)
    .reduce((acc, e) => {
      acc[e.emotion_key] = (acc[e.emotion_key] ?? 0) + 1
      return acc
    }, {})
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const maxCount = sorted[0]?.[1] ?? 1

  return (
    <div
      role="img"
      aria-label="Distribución de emociones de la última semana"
      className="bg-calm-surface rounded-3xl p-5 flex flex-col gap-3"
    >
      <p className="text-base font-bold text-text-primary">Emociones esta semana</p>
      {sorted.length === 0 ? (
        <p className="text-base text-text-secondary text-center py-2">
          Sin emociones registradas esta semana.
        </p>
      ) : (
        sorted.map(([key, count], i) => {
          const meta = EMOTION_META[key] ?? { emoji: '', label: key, bar: 'bg-calm-border' }
          return (
            <div
              key={key}
              className="flex items-center gap-3"
              aria-label={`${meta.label}: ${count} veces`}
            >
              <span className="w-28 text-base text-text-primary flex-shrink-0">
                {meta.emoji} {meta.label}
              </span>
              <div className="flex-1 bg-calm-bg rounded-full h-3 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${meta.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / maxCount) * 100}%` }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
                />
              </div>
              <span className="text-base font-bold text-text-primary w-6 text-right">
                {count}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar que los 4 tests pasan**

```bash
cd frontend && npm test -- --run src/test/EmotionDistributionChart.test.jsx
```

Expected: `4 passed`

- [ ] **Step 5: Verificar suite completa sin regresiones**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests existentes pasan + 4 nuevos

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/panel/EmotionDistributionChart.jsx \
        frontend/src/test/EmotionDistributionChart.test.jsx
git commit -m "feat: EmotionDistributionChart — gráfico de distribución emocional semanal"
```

---

### Task 2: Integración en ChildDetail

**Files:**
- Modify: `frontend/src/pages/ChildDetail.jsx`
- Modify: `frontend/src/test/ChildDetail.test.jsx`

**Interfaces:**
- Consumes (de Task 1):
  - `import { EmotionDistributionChart, EMOTION_META } from '../components/panel/EmotionDistributionChart'`
  - `EmotionDistributionChart({ emotions })` — props: array de `{ emotion_key: string, logged_at: string }`
  - `EMOTION_META[key]?.emoji` — string emoji o `undefined`
  - `EMOTION_META[key]?.label` — string label en español con mayúscula o `undefined`

- [ ] **Step 1: Modificar ChildDetail.test.jsx**

Abrir `frontend/src/test/ChildDetail.test.jsx`.

**Ajustar el test existente** "muestra historial de emociones" (buscar el bloque exacto y reemplazarlo):

```jsx
// ANTES — buscar este bloque exacto:
it('muestra historial de emociones', async () => {
  renderDetail()
  await waitFor(() => screen.getByText('Emociones'))
  await userEvent.click(screen.getByText('Emociones'))
  await waitFor(() => {
    expect(screen.getByText('nervioso')).toBeInTheDocument()
  })
})

// DESPUÉS — reemplazar con:
it('muestra historial de emociones', async () => {
  renderDetail()
  await waitFor(() => screen.getByText('Emociones'))
  await userEvent.click(screen.getByText('Emociones'))
  await waitFor(() => {
    expect(screen.getAllByText(/Nervioso/i).length).toBeGreaterThan(0)
  })
})
```

**Agregar 2 tests nuevos al final del `describe('ChildDetail', () => {` block**, antes del cierre `})`:

```jsx
  it('muestra el gráfico de tendencia emocional encima de los tabs', async () => {
    renderDetail()
    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: /distribución de emociones/i })
      ).toBeInTheDocument()
    })
  })

  it('tab Emociones muestra emoji + label en lugar de clave cruda', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Emociones'))
    await userEvent.click(screen.getByText('Emociones'))
    await waitFor(() => {
      expect(screen.queryByText('nervioso')).not.toBeInTheDocument()
      expect(screen.getAllByText(/Nervioso/i).length).toBeGreaterThan(0)
    })
  })
```

- [ ] **Step 2: Verificar que los nuevos tests fallan**

```bash
cd frontend && npm test -- --run src/test/ChildDetail.test.jsx
```

Expected: los 2 tests nuevos FAIL; el test ajustado puede fallar también (todavía busca 'nervioso' exacto)

- [ ] **Step 3: Modificar ChildDetail.jsx — agregar import**

Abrir `frontend/src/pages/ChildDetail.jsx`.

Buscar la línea del último import existente (la que importa `LumiCharacter`):
```jsx
import { LumiCharacter } from '../components/lumi/LumiCharacter'
```

Agregar después:
```jsx
import { EmotionDistributionChart, EMOTION_META } from '../components/panel/EmotionDistributionChart'
```

- [ ] **Step 4: Insertar el gráfico encima de los tabs**

En `ChildDetail.jsx`, buscar el bloque de tabs:
```jsx
        {/* Tabs */}
        <div className="flex gap-2 border-b border-calm-border">
```

Insertar el siguiente bloque INMEDIATAMENTE ANTES de ese comentario/div:
```jsx
        {/* Tendencia emocional */}
        <EmotionDistributionChart emotions={child.emotions} />

```

- [ ] **Step 5: Reemplazar emotion_key cruda en el tab Emociones**

En `ChildDetail.jsx`, buscar:
```jsx
                  <p className="text-base font-bold text-text-primary">{e.emotion_key}</p>
```

Reemplazar con:
```jsx
                  <p className="text-base font-bold text-text-primary">
                    {EMOTION_META[e.emotion_key]?.emoji ?? ''}{' '}
                    {EMOTION_META[e.emotion_key]?.label ?? e.emotion_key}
                  </p>
```

- [ ] **Step 6: Verificar que los 8 tests de ChildDetail pasan**

```bash
cd frontend && npm test -- --run src/test/ChildDetail.test.jsx
```

Expected: `8 passed` (6 originales + 2 nuevos)

- [ ] **Step 7: Verificar suite completa sin regresiones**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests pasan

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/ChildDetail.jsx \
        frontend/src/test/ChildDetail.test.jsx
git commit -m "feat: ChildDetail — gráfico de tendencia emocional y polish de emojis"
```

---

### Task 3: Polish de emojis en PanelProfesional

**Files:**
- Modify: `frontend/src/pages/PanelProfesional.jsx`
- Modify: `frontend/src/test/PanelProfesional.test.jsx`

**Interfaces:**
- Consumes (de Task 1):
  - `import { EMOTION_META } from '../components/panel/EmotionDistributionChart'`
  - `EMOTION_META[key]?.emoji` — string emoji o `undefined`
  - `EMOTION_META[key]?.label` — string label en español con mayúscula o `undefined`

- [ ] **Step 1: Agregar test en PanelProfesional.test.jsx**

Abrir `frontend/src/test/PanelProfesional.test.jsx`.

Agregar al final del `describe('PanelProfesional', () => {` block, antes del cierre `})`:

```jsx
  it('muestra emoji + label para last_emotion_key en lugar de clave cruda', async () => {
    renderPanel()
    await waitFor(() => {
      expect(screen.queryByText('nervioso')).not.toBeInTheDocument()
      expect(screen.getByText(/Hoy:.*Nervioso/i)).toBeInTheDocument()
    })
  })
```

Nota: el mock ya tiene `last_emotion_key: 'nervioso'` en `mockChildren`. No cambiar el mock.

- [ ] **Step 2: Verificar que el test falla**

```bash
cd frontend && npm test -- --run src/test/PanelProfesional.test.jsx
```

Expected: `1 failed` (el nuevo), `3 passed` (los existentes)

- [ ] **Step 3: Modificar PanelProfesional.jsx — agregar import**

Abrir `frontend/src/pages/PanelProfesional.jsx`.

Buscar la línea del último import existente (la que importa `LumiCharacter`):
```jsx
import { LumiCharacter } from '../components/lumi/LumiCharacter'
```

Agregar después:
```jsx
import { EMOTION_META } from '../components/panel/EmotionDistributionChart'
```

- [ ] **Step 4: Reemplazar last_emotion_key cruda en tarjetas**

En `PanelProfesional.jsx`, buscar:
```jsx
                  {child.last_emotion_key && (
                    <p className="text-base text-text-secondary">
                      Hoy: {child.last_emotion_key}
                    </p>
                  )}
```

Reemplazar con:
```jsx
                  {child.last_emotion_key && (
                    <p className="text-base text-text-secondary">
                      Hoy: {EMOTION_META[child.last_emotion_key]?.emoji ?? ''}{' '}
                      {EMOTION_META[child.last_emotion_key]?.label ?? child.last_emotion_key}
                    </p>
                  )}
```

- [ ] **Step 5: Verificar que los 4 tests de PanelProfesional pasan**

```bash
cd frontend && npm test -- --run src/test/PanelProfesional.test.jsx
```

Expected: `4 passed`

- [ ] **Step 6: Verificar suite completa**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests pasan (55 anteriores + 7 nuevos = 62 tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/PanelProfesional.jsx \
        frontend/src/test/PanelProfesional.test.jsx
git commit -m "feat: PanelProfesional — polish last_emotion_key con emoji y label"
```
