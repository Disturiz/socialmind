# Bienvenida del Niño — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una secuencia de bienvenida de 3 pasos con Lumi al niño la primera vez que accede a la app, después de que el padre crea su perfil.

**Architecture:** `ChildProfileForm` redirige a `/bienvenida` en lugar de `/inicio` al guardar. `WelcomePage` lee el nombre del niño via `profilesApi.getMe()`, muestra 3 burbujas de diálogo con Lumi (una por paso) y navega a `/inicio` al terminar. Sin estado persistente ni cambios en backend.

**Tech Stack:** React 18, Framer Motion 11, React Router 6, Vitest + Testing Library, Tailwind CSS (design tokens existentes).

## Global Constraints

- Idioma: solo español — ningún texto en inglés en la UI
- Tokens de diseño existentes: `calm-bg`, `calm-surface`, `calm-border`, `primary-500`, `primary-700`, `text-primary`, `text-secondary`, `rounded-3xl`
- Componentes reutilizables: `PageWrapper`, `LumiCharacter`, `Button` — no crear duplicados
- `LumiCharacter` acepta `state`: `'idle' | 'happy' | 'thinking' | 'encouraging'`
- `profilesApi.getMe()` retorna `{ data: { child: { name: string, age: number, avatar_emoji: string, id: number } } }`
- Tests con Vitest + Testing Library; ejecutar desde `frontend/` con `npm test -- --run`
- Framer Motion: usar `AnimatePresence` con `mode="wait"` para transiciones entre pasos

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `frontend/src/pages/WelcomePage.jsx` | Crear | Página de bienvenida del niño — 3 pasos, Lumi, burbuja, dots, botones |
| `frontend/src/test/WelcomePage.test.jsx` | Crear | Tests de la página |
| `frontend/src/router/index.jsx` | Modificar | Agregar ruta `/bienvenida` con `ProtectedRoute` |
| `frontend/src/pages/ChildProfileForm.jsx` | Modificar | Cambiar redirect de `/inicio` a `/bienvenida` |

---

## Task 1: WelcomePage.jsx + tests

**Files:**
- Create: `frontend/src/pages/WelcomePage.jsx`
- Create: `frontend/src/test/WelcomePage.test.jsx`

**Interfaces:**
- Consumes: `profilesApi.getMe()` → `{ data: { child: { name: string } } }`
- Consumes: `LumiCharacter({ state, size })`, `Button({ onClick, className, children })`, `PageWrapper({ className, children })`
- Produces: `export function WelcomePage()` — página en ruta `/bienvenida`

- [ ] **Step 1: Escribir los tests en WelcomePage.test.jsx**

```jsx
// frontend/src/test/WelcomePage.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { WelcomePage } from '../pages/WelcomePage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGetMe = vi.fn().mockResolvedValue({ data: { child: { name: 'Sofía' } } })
vi.mock('../services/api', () => ({
  profilesApi: { getMe: () => mockGetMe() },
}))

function renderPage() {
  return render(<MemoryRouter><WelcomePage /></MemoryRouter>)
}

describe('WelcomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockGetMe.mockResolvedValue({ data: { child: { name: 'Sofía' } } })
  })

  it('muestra el paso 1 con el nombre del niño', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/¡Hola, Sofía!/i)).toBeInTheDocument()
    })
  })

  it('avanza al paso 2 al hacer clic en Siguiente', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText(/aprender juntos/i)).toBeInTheDocument()
    })
  })

  it('en el paso 3 muestra el botón final en lugar de Siguiente', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Vamos a explorar/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Siguiente/i })).not.toBeInTheDocument()
    })
  })

  it('el botón final navega a /inicio', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => screen.getByRole('button', { name: /Vamos a explorar/i }))
    await userEvent.click(screen.getByRole('button', { name: /Vamos a explorar/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/inicio')
  })

  it('si getMe falla, muestra el paso 1 sin nombre específico', async () => {
    mockGetMe.mockRejectedValueOnce(new Error('network'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/¡Hola!/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd frontend && npm test -- --run src/test/WelcomePage.test.jsx
```

Resultado esperado: FAIL — `Cannot find module '../pages/WelcomePage'`

- [ ] **Step 3: Crear WelcomePage.jsx**

```jsx
// frontend/src/pages/WelcomePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { profilesApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

function buildSteps(name) {
  const greeting = name ? `¡Hola, ${name}!` : '¡Hola!'
  return [
    {
      lumiState: 'happy',
      text: `${greeting} Soy Lumi, tu compañero en SocialMind. 👋`,
    },
    {
      lumiState: 'encouraging',
      text: 'Aquí vamos a aprender juntos a entender tus emociones y practicar situaciones del día a día.',
    },
    {
      lumiState: 'happy',
      text: '¡Estoy muy contento de conocerte! ¿Listo para explorar?',
    },
  ]
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [childName, setChildName] = useState('')

  useEffect(() => {
    profilesApi.getMe()
      .then(res => setChildName(res.data.child?.name || ''))
      .catch(() => {})
  }, [])

  const steps = buildSteps(childName)
  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-8">

        <LumiCharacter state={current.lumiState} size={160} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="w-full bg-calm-surface border-2 border-calm-border rounded-3xl p-6 text-center"
          >
            <p className="text-lg text-text-primary leading-relaxed">
              {current.text}
            </p>
          </motion.div>
        </AnimatePresence>

        <div
          className="flex gap-2"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemax={steps.length}
          aria-label="Progreso de la bienvenida"
        >
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step ? 'bg-primary-500' : 'bg-calm-border'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <Button onClick={() => navigate('/inicio')} className="w-full text-lg">
            ¡Vamos a explorar! 🚀
          </Button>
        ) : (
          <Button onClick={() => setStep(s => s + 1)} className="w-full text-lg">
            Siguiente →
          </Button>
        )}

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
cd frontend && npm test -- --run src/test/WelcomePage.test.jsx
```

Resultado esperado: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/WelcomePage.jsx frontend/src/test/WelcomePage.test.jsx
git commit -m "feat: add WelcomePage child onboarding — 3-step Lumi sequence"
```

---

## Task 2: Router + ChildProfileForm

**Files:**
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/ChildProfileForm.jsx`

**Interfaces:**
- Consumes: `WelcomePage` exportada desde `../pages/WelcomePage` (Task 1)
- Consumes: `ProtectedRoute` ya definido en `router/index.jsx`

- [ ] **Step 1: Cambiar redirect en ChildProfileForm.jsx**

En `frontend/src/pages/ChildProfileForm.jsx`, línea 37, cambiar:

```js
// antes
navigate('/inicio')

// después
navigate('/bienvenida')
```

El bloque `handleSubmit` quedaría así en su parte relevante:

```js
try {
  await profilesApi.createChild({ name: trimmedName, age: ageNum, avatar_emoji: avatarEmoji })
  navigate('/bienvenida')
} catch (err) {
```

- [ ] **Step 2: Agregar import y ruta en router/index.jsx**

Agregar el import de `WelcomePage` junto a los demás imports de páginas:

```js
import { WelcomePage } from '../pages/WelcomePage'
```

Agregar la ruta dentro del array de `createBrowserRouter`, después de la ruta `/reset-password`:

```js
{ path: '/bienvenida', element: <ProtectedRoute><WelcomePage /></ProtectedRoute> },
```

El bloque de rutas públicas queda así:

```js
export const router = createBrowserRouter([
  { path: '/',         element: <Welcome /> },
  { path: '/login',    element: <Login /> },
  { path: '/registro', element: <Register /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  { path: '/bienvenida', element: <ProtectedRoute><WelcomePage /></ProtectedRoute> },
  { path: '/admin', element: <AdminRoute><AdminPage /></AdminRoute> },
  // ... resto sin cambios
])
```

- [ ] **Step 3: Correr suite completa de tests**

```bash
cd frontend && npm test -- --run
```

Resultado esperado: todos los tests PASS (ninguna regresión)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/router/index.jsx frontend/src/pages/ChildProfileForm.jsx
git commit -m "feat: wire /bienvenida route and redirect from ChildProfileForm"
```
