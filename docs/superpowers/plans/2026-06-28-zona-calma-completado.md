# Zona de Calma — Completado y Check-in Emocional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar pantalla de completado con reacción de Lumi y mini check-in emocional post-actividad a la Zona de Calma, y migrar botones de salir al componente `Button`.

**Architecture:** Nuevo componente `PostActivityCheckin.jsx` encapsula la felicitación y el check-in. `ZonaCalma.jsx` agrega estado `completedActivity` y renderiza el check-in entre la actividad y la lista. Los botones de salir en los 3 componentes de actividad migran al componente `Button` existente.

**Tech Stack:** React 18, Framer Motion, Tailwind CSS, Vitest + Testing Library.

## Global Constraints

- Solo español en textos de UI
- No agregar colores Tailwind fuera del tema existente
- No modificar: backend, `api.js`, `router/index.jsx`, `LumiCharacter.jsx`, `PageWrapper.jsx`, `Button.jsx`
- `LumiCharacter` acepta `state`: `'idle' | 'happy' | 'thinking' | 'encouraging'`
- `Button` acepta `variant`: `'primary' | 'secondary' | 'ghost'`; `min-h-[56px]` aplicado automáticamente
- `emotionsApi.log` en `PostActivityCheckin` es fire-and-forget — error silencioso, nunca bloquea al niño
- No tocar la lógica interna de `BreathingExercise`, `VisualTimer`, `LumiPhrase` — solo sus botones de salida

---

### Task 1: Componente `PostActivityCheckin` (TDD)

**Files:**
- Create: `frontend/src/components/calma/PostActivityCheckin.jsx`
- Create: `frontend/src/test/PostActivityCheckin.test.jsx`

**Interfaces:**
- Consumes: `emotionsApi.log(key)` de `../../services/api`
- Consumes: `LumiCharacter` de `../lumi/LumiCharacter`
- Produces: `PostActivityCheckin({ activityId, emotionsBefore, onDone })` — usado en Task 2

---

- [ ] **Step 1: Crear el archivo de tests**

Crear `frontend/src/test/PostActivityCheckin.test.jsx` con este contenido exacto:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PostActivityCheckin } from '../components/calma/PostActivityCheckin'

vi.mock('../services/api', () => ({
  emotionsApi: {
    log: vi.fn().mockResolvedValue({ data: { id: 1, emotion_key: 'feliz' } }),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

describe('PostActivityCheckin', () => {
  it('muestra el mensaje correcto para actividad respirar', () => {
    const onDone = vi.fn()
    render(
      <PostActivityCheckin activityId="respirar" emotionsBefore="nervioso" onDone={onDone} />
    )
    expect(screen.getByText(/Terminaste de respirar/i)).toBeInTheDocument()
  })

  it('muestra las 5 emociones', () => {
    const onDone = vi.fn()
    render(
      <PostActivityCheckin activityId="respirar" emotionsBefore="nervioso" onDone={onDone} />
    )
    expect(screen.getByText('Feliz')).toBeInTheDocument()
    expect(screen.getByText('Nervioso')).toBeInTheDocument()
    expect(screen.getByText('Confundido')).toBeInTheDocument()
    expect(screen.getByText('Frustrado')).toBeInTheDocument()
    expect(screen.getByText('Cansado')).toBeInTheDocument()
  })

  it('al hacer clic en una emoción llama onDone', async () => {
    const onDone = vi.fn()
    render(
      <PostActivityCheckin activityId="pausa" emotionsBefore="cansado" onDone={onDone} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Feliz' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

```bash
cd frontend && npx vitest run src/test/PostActivityCheckin.test.jsx
```

Resultado esperado: FAIL — `Cannot find module '../components/calma/PostActivityCheckin'`

- [ ] **Step 3: Crear `PostActivityCheckin.jsx`**

Crear `frontend/src/components/calma/PostActivityCheckin.jsx` con este contenido exacto:

```jsx
import { motion } from 'framer-motion'
import { emotionsApi } from '../../services/api'
import { LumiCharacter } from '../lumi/LumiCharacter'

const COMPLETION_MESSAGES = {
  respirar: '¡Muy bien! Terminaste de respirar 🌬️ ¿Cómo te sientes ahora?',
  pausa:    '¡Descansaste! ¿Cómo te sientes después de tu pausa? ⏸️',
  frase:    '¡Gracias por leer mi frase! ¿Cómo te sientes ahora? 🦉',
}

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

export function PostActivityCheckin({ activityId, emotionsBefore, onDone }) {
  const message = COMPLETION_MESSAGES[activityId] ?? '¡Lo hiciste! ¿Cómo te sientes ahora?'

  async function handleEmotionSelect(key) {
    try {
      await emotionsApi.log(key)
    } catch {
      // fire-and-forget — no bloquea al niño
    }
    onDone()
  }

  return (
    <div className="max-w-md w-full flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <LumiCharacter state="happy" size={90} />
        <div className="bg-calm-surface rounded-2xl p-4 text-base text-text-primary">
          {message}
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
              ${EMOTION_COLORS[emotion.key]}
            `}
            aria-label={emotion.label}
          >
            <span className="text-5xl leading-none" role="img" aria-hidden="true">
              {emotion.emoji}
            </span>
            <span className="text-base font-bold text-text-primary">
              {emotion.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar tests y verificar que pasan**

```bash
cd frontend && npx vitest run src/test/PostActivityCheckin.test.jsx
```

Resultado esperado: 3/3 PASS

- [ ] **Step 5: Ejecutar suite completo para verificar sin regresiones**

```bash
cd frontend && npx vitest run
```

Resultado esperado: todos los tests existentes en PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/calma/PostActivityCheckin.jsx frontend/src/test/PostActivityCheckin.test.jsx
git commit -m "feat: PostActivityCheckin — felicitación de Lumi y check-in emocional post-actividad"
```

---

### Task 2: Integrar `PostActivityCheckin` en `ZonaCalma.jsx`

**Files:**
- Modify: `frontend/src/pages/ZonaCalma.jsx`
- Modify: `frontend/src/test/ZonaCalma.test.jsx`

**Interfaces:**
- Consumes (Task 1): `PostActivityCheckin({ activityId, emotionsBefore, onDone })` de `../components/calma/PostActivityCheckin`
- Consumes: `emotionsApi.log` ya mockeado en `ZonaCalma.test.jsx` (solo agregar `.mockResolvedValue`)

---

- [ ] **Step 1: Agregar 3 tests nuevos al final de `ZonaCalma.test.jsx`**

Abrir `frontend/src/test/ZonaCalma.test.jsx`. Agregar `emotionsApi` al import de la línea 6 (ya está, solo verificar) y agregar `.mockResolvedValue({ data: {} })` al mock de `emotionsApi.log`. Luego agregar estos 3 tests al final del `describe('ZonaCalma')`:

```jsx
  it('después de salir del timer muestra pantalla de completado con mensaje de Lumi', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => {
      expect(screen.getByText(/Cómo te sientes ahora/i)).toBeInTheDocument()
    })
  })

  it('en la pantalla de completado se muestran las 5 emociones', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => {
      expect(screen.getByText('Feliz')).toBeInTheDocument()
      expect(screen.getByText('Nervioso')).toBeInTheDocument()
    })
  })

  it('al seleccionar emoción post-actividad llama emotionsApi.log y vuelve a la lista', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => screen.getByRole('button', { name: 'Feliz' }))
    await userEvent.click(screen.getByRole('button', { name: 'Feliz' }))
    await waitFor(() => {
      expect(calmApi.saveSession).toHaveBeenCalled()
      expect(screen.getByText('Respirar')).toBeInTheDocument()
    })
  })
```

También actualizar el mock de `emotionsApi.log` de `vi.fn()` a `vi.fn().mockResolvedValue({ data: {} })` en la sección de mocks de ese archivo.

- [ ] **Step 2: Ejecutar tests para confirmar que los 3 nuevos fallan**

```bash
cd frontend && npx vitest run src/test/ZonaCalma.test.jsx
```

Resultado esperado: los 3 tests nuevos en FAIL (el componente aún no tiene `PostActivityCheckin`), los 6 existentes en PASS.

- [ ] **Step 3: Actualizar `ZonaCalma.jsx`**

Reemplazar el contenido completo de `frontend/src/pages/ZonaCalma.jsx`:

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
import { PostActivityCheckin } from '../components/calma/PostActivityCheckin'

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
  const [emotionKey, setEmotionKey]               = useState('feliz')
  const [activeActivity, setActiveActivity]       = useState(null)
  const [completedActivity, setCompletedActivity] = useState(null)
  const [loading, setLoading]                     = useState(true)

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
    if (activeActivity !== 'frase') {
      try {
        await calmApi.saveSession(activeActivity, durationSeconds, emotionKey)
      } catch {
        // pérdida silenciosa aceptable
      }
    }
    setCompletedActivity({ id: activeActivity, duration: durationSeconds })
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
              <BreathingExercise emotionKey={emotionKey} onComplete={handleComplete} />
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

  if (completedActivity) {
    return (
      <PageWrapper className="items-center justify-center px-6 py-10">
        <PostActivityCheckin
          activityId={completedActivity.id}
          emotionsBefore={emotionKey}
          onDone={() => setCompletedActivity(null)}
        />
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

- [ ] **Step 4: Ejecutar tests y verificar que pasan**

```bash
cd frontend && npx vitest run src/test/ZonaCalma.test.jsx
```

Resultado esperado: 9/9 PASS (6 existentes + 3 nuevos).

- [ ] **Step 5: Ejecutar suite completo**

```bash
cd frontend && npx vitest run
```

Resultado esperado: todos en PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ZonaCalma.jsx frontend/src/test/ZonaCalma.test.jsx
git commit -m "feat: ZonaCalma — integrar PostActivityCheckin tras completar actividad"
```

---

### Task 3: Migrar botones de salir al componente `Button`

**Files:**
- Modify: `frontend/src/components/calma/BreathingExercise.jsx`
- Modify: `frontend/src/components/calma/VisualTimer.jsx`
- Modify: `frontend/src/components/calma/LumiPhrase.jsx`

**Interfaces:**
- Consumes: `Button` de `../ui/Button` (variantes `ghost` y `primary`)
- No produce interfaces nuevas — cambio de UI puro

---

- [ ] **Step 1: Actualizar `BreathingExercise.jsx`**

Reemplazar el contenido completo de `frontend/src/components/calma/BreathingExercise.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui/Button'

const TOTAL_CYCLES = 5
const HALF_CYCLE_MS = 4000
const TOTAL_SECONDS = TOTAL_CYCLES * 8

export function BreathingExercise({ emotionKey, onComplete }) {
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

      <Button variant="ghost" onClick={handleExit}>
        Salir
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Actualizar `VisualTimer.jsx`**

Reemplazar el contenido completo de `frontend/src/components/calma/VisualTimer.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/Button'

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

      <Button variant="ghost" onClick={handleExit}>
        Salir antes
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Actualizar `LumiPhrase.jsx`**

Reemplazar el contenido completo de `frontend/src/components/calma/LumiPhrase.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LumiCharacter } from '../lumi/LumiCharacter'
import { Button } from '../ui/Button'
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
      try {
        await calmApi.saveSession('frase', 0, emotionKey)
      } catch {
        // pérdida silenciosa aceptable
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
        <Button variant="primary" onClick={() => onComplete(0)}>
          Listo
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar suite completo**

```bash
cd frontend && npx vitest run
```

Resultado esperado: todos los tests en PASS. Los tests de `ZonaCalma` verifican "Salir antes" por texto — el texto del botón no cambia, solo el componente que lo renderiza.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/calma/BreathingExercise.jsx frontend/src/components/calma/VisualTimer.jsx frontend/src/components/calma/LumiPhrase.jsx
git commit -m "fix: migrar botones de salir en actividades al componente Button"
```
