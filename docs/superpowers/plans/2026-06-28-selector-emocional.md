# Selector Emocional — Flujo Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender `EmotionSelector.jsx` con flujo de 4 fases: carga inicial, "ya elegiste hoy" (con opción de cambiar), selección, y resultado con reacción de Lumi + 3 sugerencias de navegación según la emoción.

**Architecture:** Un solo componente `EmotionSelector.jsx` maneja todo via estado `phase` (`'checking' | 'already_selected' | 'selecting' | 'selected'`). Un objeto estático `EMOTION_CONFIG` centraliza mensajes de Lumi y rutas sugeridas por emoción. El backend no cambia.

**Tech Stack:** React 18, Framer Motion, Tailwind CSS, Vitest + Testing Library.

## Global Constraints

- Solo español en textos de UI
- Colores deben respetar el diseño sensorial del proyecto (no agregar colores nuevos fuera del tema Tailwind existente)
- Botones mínimo `min-h-[56px]` (definido en `Button.jsx`)
- No modificar: backend, `api.js`, `router/index.jsx`, `Button.jsx`, `LumiCharacter.jsx`, `PageWrapper.jsx`
- `LumiCharacter` acepta `state`: `'idle' | 'happy' | 'thinking' | 'encouraging'`
- `Button` acepta `variant`: `'primary' | 'secondary' | 'ghost'`

---

### Task 1: Tests actualizados para el nuevo flujo

**Files:**
- Modify: `frontend/src/test/EmotionSelector.test.jsx`

**Interfaces:**
- Consumes: `EmotionSelector` exportado desde `../pages/EmotionSelector`
- Consumes: mock de `emotionsApi.list`, `emotionsApi.log`, `emotionsApi.today`

---

- [ ] **Step 1: Reemplazar el contenido completo de `EmotionSelector.test.jsx`**

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

const MOCK_EMOTIONS = [
  { key: 'feliz',      label: 'Feliz',      emoji: '😊' },
  { key: 'nervioso',   label: 'Nervioso',   emoji: '😰' },
  { key: 'confundido', label: 'Confundido', emoji: '🤔' },
  { key: 'frustrado',  label: 'Frustrado',  emoji: '😤' },
  { key: 'cansado',    label: 'Cansado',    emoji: '😴' },
]

const mockList  = vi.fn().mockResolvedValue({ data: MOCK_EMOTIONS })
const mockLog   = vi.fn().mockResolvedValue({ data: { id: 1, emotion_key: 'feliz' } })
const mockToday = vi.fn().mockResolvedValue({ data: { emotion_key: null } })

vi.mock('../services/api', () => ({
  emotionsApi: {
    list:  () => mockList(),
    log:   (key) => mockLog(key),
    today: () => mockToday(),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

function renderSelector() {
  return render(<MemoryRouter><EmotionSelector /></MemoryRouter>)
}

describe('EmotionSelector — fase selecting (sin emoción previa)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockToday.mockResolvedValue({ data: { emotion_key: null } })
  })

  it('muestra el título y 5 tarjetas de emociones', async () => {
    renderSelector()
    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument()
      expect(screen.getByText('Feliz')).toBeInTheDocument()
      expect(screen.getByText('Nervioso')).toBeInTheDocument()
      expect(screen.getByText('Confundido')).toBeInTheDocument()
      expect(screen.getByText('Frustrado')).toBeInTheDocument()
      expect(screen.getByText('Cansado')).toBeInTheDocument()
    })
  })

  it('después de seleccionar Feliz muestra mensaje de Lumi y 3 sugerencias', async () => {
    renderSelector()
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => {
      expect(screen.getByText(/Qué bueno que te sientes feliz/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Escenarios sociales/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Chat con Lumi/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Mi aventura/i })).toBeInTheDocument()
    })
  })

  it('la sugerencia principal navega a /escenarios al hacer clic', async () => {
    renderSelector()
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => screen.getByRole('button', { name: /Escenarios sociales/i }))
    await userEvent.click(screen.getByRole('button', { name: /Escenarios sociales/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/escenarios')
  })

  it('después de seleccionar Frustrado la primera sugerencia es Zona de calma', async () => {
    renderSelector()
    await waitFor(() => screen.getByText('Frustrado'))
    await userEvent.click(screen.getByText('Frustrado'))
    await waitFor(() => {
      expect(screen.getByText(/Entiendo que estás frustrado/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Zona de calma/i })).toBeInTheDocument()
    })
  })

  it('error en log muestra mensaje y permite reintentar', async () => {
    mockLog.mockRejectedValueOnce(new Error('network'))
    renderSelector()
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => {
      expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument()
    })
    // después del error las tarjetas siguen disponibles
    expect(screen.getByText('Feliz')).toBeInTheDocument()
  })
})

describe('EmotionSelector — fase already_selected (con emoción previa)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockToday.mockResolvedValue({ data: { emotion_key: 'nervioso' } })
  })

  it('muestra mensaje de emoción ya registrada', async () => {
    renderSelector()
    await waitFor(() => {
      expect(screen.getByText(/Ya registraste que te sientes Nervioso hoy/i)).toBeInTheDocument()
    })
  })

  it('botón Ir al inicio navega a /inicio', async () => {
    renderSelector()
    await waitFor(() => screen.getByRole('button', { name: /Ir al inicio/i }))
    await userEvent.click(screen.getByRole('button', { name: /Ir al inicio/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/inicio')
  })

  it('botón Cambiar emoción muestra la grilla de selección', async () => {
    renderSelector()
    await waitFor(() => screen.getByRole('button', { name: /Cambiar emoción/i }))
    await userEvent.click(screen.getByRole('button', { name: /Cambiar emoción/i }))
    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument()
      expect(screen.getByText('Feliz')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Ejecutar los tests para confirmar que fallan**

```bash
cd frontend && npx vitest run src/test/EmotionSelector.test.jsx
```

Resultado esperado: varios FAIL — `Cannot find module` o fallos de assertion porque `EmotionSelector` aún no tiene las fases nuevas.

---

### Task 2: Implementar EmotionSelector.jsx con flujo de 4 fases

**Files:**
- Modify: `frontend/src/pages/EmotionSelector.jsx`

**Interfaces:**
- Consumes (Task 1): tests que verifican `phase`, `EMOTION_CONFIG`, y navegación por sugerencias
- Produce: componente `EmotionSelector` exportado con las 4 fases funcionales

---

- [ ] **Step 1: Reemplazar el contenido completo de `EmotionSelector.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { emotionsApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { Button } from '../components/ui/Button'

// Clases Tailwind explícitas para que JIT las incluya en el build
const EMOTION_COLORS = {
  feliz:      'bg-primary-100 border-primary-500',
  nervioso:   'bg-primary-50 border-accent-yellow',
  confundido: 'bg-secondary-100 border-secondary-500',
  frustrado:  'bg-primary-50 border-accent-coral',
  cansado:    'bg-calm-bg border-calm-border',
}

const EMOTION_CONFIG = {
  feliz: {
    lumiState: 'happy',
    lumiMessage: '¡Qué bueno que te sientes feliz hoy! 😊 ¿Qué quieres hacer?',
    alreadyMessage: '¡Ya registraste que te sientes Feliz hoy! 😊',
    suggestions: [
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '⭐ Mi aventura',          path: '/mi-aventura' },
    ],
  },
  nervioso: {
    lumiState: 'encouraging',
    lumiMessage: 'Está bien sentirse nervioso. ¡Estoy aquí contigo! 💙',
    alreadyMessage: '¡Ya registraste que te sientes Nervioso hoy! 😰',
    suggestions: [
      { label: '🧘 Zona de calma',       path: '/calma' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
    ],
  },
  confundido: {
    lumiState: 'thinking',
    lumiMessage: 'No pasa nada si estás confundido. ¡Podemos resolverlo juntos! 🤔',
    alreadyMessage: '¡Ya registraste que te sientes Confundido hoy! 🤔',
    suggestions: [
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
      { label: '🧘 Zona de calma',       path: '/calma' },
    ],
  },
  frustrado: {
    lumiState: 'encouraging',
    lumiMessage: 'Entiendo que estás frustrado. Vamos paso a paso. 💪',
    alreadyMessage: '¡Ya registraste que te sientes Frustrado hoy! 😤',
    suggestions: [
      { label: '🧘 Zona de calma',       path: '/calma' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
    ],
  },
  cansado: {
    lumiState: 'encouraging',
    lumiMessage: 'Está bien descansar. Te acompaño a tu ritmo. 😴',
    alreadyMessage: '¡Ya registraste que te sientes Cansado hoy! 😴',
    suggestions: [
      { label: '🧘 Zona de calma',       path: '/calma' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '⭐ Mi aventura',          path: '/mi-aventura' },
    ],
  },
}

export function EmotionSelector() {
  const navigate = useNavigate()
  const [phase, setPhase]         = useState('checking')
  const [todayEmotion, setToday]  = useState(null)
  const [selected, setSelected]   = useState(null)
  const [emotions, setEmotions]   = useState([])
  const [lumiState, setLumiState] = useState('idle')
  const [error, setError]         = useState(null)

  useEffect(() => {
    Promise.all([emotionsApi.list(), emotionsApi.today()])
      .then(([listRes, todayRes]) => {
        setEmotions(listRes.data)
        const key = todayRes.data.emotion_key
        if (key) {
          setToday(key)
          setLumiState(EMOTION_CONFIG[key]?.lumiState ?? 'idle')
          setPhase('already_selected')
        } else {
          setPhase('selecting')
        }
      })
      .catch(() => setPhase('selecting'))
  }, [])

  async function handleSelect(key) {
    if (selected) return
    setSelected(key)
    setError(null)
    try {
      await emotionsApi.log(key)
      setLumiState(EMOTION_CONFIG[key].lumiState)
      setPhase('selected')
    } catch {
      setError('Algo salió mal. Intenta de nuevo.')
      setSelected(null)
    }
  }

  function handleChange() {
    setToday(null)
    setSelected(null)
    setLumiState('idle')
    setPhase('selecting')
  }

  const activeEmotion = selected ?? todayEmotion
  const config = activeEmotion ? EMOTION_CONFIG[activeEmotion] : null

  return (
    <PageWrapper className="items-center justify-center px-6 py-10">
      <div className="max-w-md w-full flex flex-col items-center gap-8">

        {/* Fase: checking */}
        {phase === 'checking' && (
          <>
            <LumiCharacter state="idle" size={90} />
            <p className="text-text-muted text-base">Cargando...</p>
          </>
        )}

        {/* Fase: already_selected */}
        {phase === 'already_selected' && config && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <LumiCharacter state={lumiState} size={90} />
              <span
                className="text-7xl leading-none"
                role="img"
                aria-label={activeEmotion}
              >
                {emotions.find(e => e.key === activeEmotion)?.emoji ?? '😊'}
              </span>
              <div className="bg-calm-surface rounded-2xl p-4 text-base text-text-primary">
                {config.alreadyMessage}
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button
                variant="primary"
                className="w-full"
                aria-label="Ir al inicio"
                onClick={() => navigate('/inicio')}
              >
                Ir al inicio
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                aria-label="Cambiar emoción"
                onClick={handleChange}
              >
                Cambiar emoción
              </Button>
            </div>
          </>
        )}

        {/* Fase: selecting */}
        {phase === 'selecting' && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <LumiCharacter state="idle" size={90} />
              <h1 className="text-2xl font-extrabold text-primary-700">
                ¿Cómo te sientes hoy?
              </h1>
              <p className="text-base text-text-secondary">
                Elige la emoción que más se parece a cómo te sientes ahora.
              </p>
            </div>

            {error && (
              <p className="text-base text-accent-coral">{error}</p>
            )}

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
                  <span className="text-base font-bold text-text-primary">
                    {emotion.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </>
        )}

        {/* Fase: selected */}
        {phase === 'selected' && config && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <LumiCharacter state={lumiState} size={90} />
              <div className="bg-calm-surface rounded-2xl p-4 text-base text-text-primary">
                {config.lumiMessage}
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              {config.suggestions.map((suggestion, i) => (
                <motion.div
                  key={suggestion.path}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Button
                    variant={i === 0 ? 'primary' : 'secondary'}
                    className="w-full"
                    aria-label={suggestion.label}
                    onClick={() => navigate(suggestion.path)}
                  >
                    {suggestion.label}
                  </Button>
                </motion.div>
              ))}
            </div>
          </>
        )}

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Ejecutar los tests y verificar que pasan**

```bash
cd frontend && npx vitest run src/test/EmotionSelector.test.jsx
```

Resultado esperado: todos los tests en PASS (9 tests).

- [ ] **Step 3: Ejecutar el suite completo para verificar que no hay regresiones**

```bash
cd frontend && npx vitest run
```

Resultado esperado: todos los tests existentes siguen en PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/EmotionSelector.jsx frontend/src/test/EmotionSelector.test.jsx
git commit -m "feat: EmotionSelector — flujo completo con fases, reacción de Lumi y sugerencias por emoción"
```
