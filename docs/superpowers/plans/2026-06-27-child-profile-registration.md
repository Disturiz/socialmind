# Registro de Perfil de Niño — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un padre registre el perfil de su hijo como segundo paso tras crear su cuenta, con un guard de router que bloquea el acceso a los módulos hasta que el perfil exista, y un fix del Dashboard que corrige que los especialistas veían módulos del niño.

**Architecture:** Nuevo router FastAPI `/api/v1/profiles` con dos endpoints (`POST /children` y `GET /me`). En el frontend, una nueva página `ChildProfileForm.jsx` en `/perfil/nuevo-nino`, un guard `ParentOnboardingGuard` que envuelve las rutas de padres, y ajustes al Dashboard para mostrar el perfil del niño y corregir la vista de especialistas.

**Tech Stack:** FastAPI + SQLAlchemy 2.x + Pydantic v2 (backend), React 18 + React Router v6 + Axios + Tailwind (frontend). Tests con pytest + FastAPI TestClient (SQLite in-memory). No se necesita migración Alembic (la tabla `child_profiles` ya existe).

## Global Constraints

- Tabla `child_profiles` ya existe: columnas `id`, `parent_id`, `name` (String 100), `age` (Integer), `avatar_emoji` (String 10), `created_at` (DateTime).
- Emojis permitidos exactamente: `['🦊', '🐧', '🐸', '🦁', '🌟', '🐳', '🦋', '🐼']`
- Edad válida: 1–17 (inclusive).
- Un solo hijo por padre en MVP: segundo `POST /children` retorna 409.
- `require_parent` es análogo al `require_specialist` existente en `backend/app/core/dependencies.py`.
- Tests de backend usan el fixture `client` de `backend/tests/conftest.py` (SQLite in-memory, `TestClient`).
- Frontend usa `localStorage` keys `sm_token` y `sm_user`. El interceptor Axios en `api.js` ya agrega el token Bearer automáticamente.
- Componentes UI disponibles: `PageWrapper`, `Button`, `Input`, `Card`, `LumiCharacter` — importar desde paths relativos en `../components/`.
- Rutas protegidas usan `ProtectedRoute` (cualquier rol autenticado) o `SpecialistRoute` (solo especialistas) — ver `frontend/src/router/index.jsx`.

---

### Task 1: Backend — Schemas, dependencia require_parent, router y tests

**Files:**
- Create: `backend/app/schemas/profiles.py`
- Create: `backend/app/routers/profiles.py`
- Create: `backend/tests/test_profiles.py`
- Modify: `backend/app/core/dependencies.py` (agregar `require_parent`)
- Modify: `backend/app/main.py` (registrar router)

**Interfaces:**
- Produce: `GET /api/v1/profiles/me` → `{ "child": { "id": int, "name": str, "age": int, "avatar_emoji": str, "created_at": str } | null }`
- Produce: `POST /api/v1/profiles/children` → `{ "id": int, "name": str, "age": int, "avatar_emoji": str, "created_at": str }` (201) o 409 si ya existe, 403 si no es padre, 422 si validación falla.

- [ ] **Step 1: Crear `backend/app/schemas/profiles.py`**

```python
from datetime import datetime
from pydantic import BaseModel, field_validator

ALLOWED_AVATARS = ['🦊', '🐧', '🐸', '🦁', '🌟', '🐳', '🦋', '🐼']


class ChildProfileCreate(BaseModel):
    name: str
    age: int
    avatar_emoji: str

    @field_validator('name')
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError('El nombre debe tener entre 1 y 100 caracteres.')
        return v

    @field_validator('age')
    @classmethod
    def age_valid(cls, v: int) -> int:
        if v < 1 or v > 17:
            raise ValueError('La edad debe estar entre 1 y 17 años.')
        return v

    @field_validator('avatar_emoji')
    @classmethod
    def avatar_valid(cls, v: str) -> str:
        if v not in ALLOWED_AVATARS:
            raise ValueError('Avatar no permitido.')
        return v


class ChildProfileOut(BaseModel):
    id: int
    name: str
    age: int
    avatar_emoji: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ParentProfileOut(BaseModel):
    child: ChildProfileOut | None
```

- [ ] **Step 2: Agregar `require_parent` a `backend/app/core/dependencies.py`**

El archivo actual tiene `get_current_user` y `require_specialist`. Agregar al final:

```python
def require_parent(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.parent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para padres.",
        )
    return current_user
```

- [ ] **Step 3: Crear `backend/app/routers/profiles.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_parent
from app.models.user import User
from app.models.child_profile import ChildProfile
from app.schemas.profiles import ChildProfileCreate, ChildProfileOut, ParentProfileOut

router = APIRouter()


@router.get("/me", response_model=ParentProfileOut)
def get_my_profile(
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    child = db.query(ChildProfile).filter(ChildProfile.parent_id == current_user.id).first()
    return ParentProfileOut(child=child)


@router.post("/children", response_model=ChildProfileOut, status_code=201)
def create_child(
    data: ChildProfileCreate,
    current_user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    existing = db.query(ChildProfile).filter(ChildProfile.parent_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya tienes un niño registrado.")
    child = ChildProfile(
        parent_id=current_user.id,
        name=data.name,
        age=data.age,
        avatar_emoji=data.avatar_emoji,
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return child
```

- [ ] **Step 4: Registrar el router en `backend/app/main.py`**

Agregar el import junto a los demás routers:
```python
from app.routers import profiles
```

Agregar el `include_router` junto a los demás (antes del router de gamificación está bien):
```python
app.include_router(profiles.router, prefix="/api/v1/profiles", tags=["perfiles"])
```

- [ ] **Step 5: Escribir los tests en `backend/tests/test_profiles.py`**

```python
import pytest


def _register_parent(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "padre@example.com",
        "password": "Password123!",
        "full_name": "Juan García",
        "role": "parent",
    })
    return r.json()["access_token"]


def _register_specialist(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "esp@example.com",
        "password": "Password123!",
        "full_name": "Dra. Ana",
        "role": "specialist",
    })
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


VALID_CHILD = {"name": "Sofía", "age": 7, "avatar_emoji": "🦋"}


def test_get_me_no_child(client):
    token = _register_parent(client)
    r = client.get("/api/v1/profiles/me", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["child"] is None


def test_create_child_success(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Sofía"
    assert data["age"] == 7
    assert data["avatar_emoji"] == "🦋"
    assert "id" in data
    assert "created_at" in data


def test_get_me_with_child(client):
    token = _register_parent(client)
    client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    r = client.get("/api/v1/profiles/me", headers=_auth(token))
    assert r.status_code == 200
    child = r.json()["child"]
    assert child["name"] == "Sofía"
    assert child["age"] == 7
    assert child["avatar_emoji"] == "🦋"


def test_create_child_duplicate(client):
    token = _register_parent(client)
    client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    assert r.status_code == 409
    assert "Ya tienes" in r.json()["detail"]


def test_create_child_invalid_age_zero(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "Niño", "age": 0, "avatar_emoji": "🌟"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_invalid_age_eighteen(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "Niño", "age": 18, "avatar_emoji": "🌟"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_invalid_avatar(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "Niño", "age": 7, "avatar_emoji": "🚀"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_empty_name(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "   ", "age": 7, "avatar_emoji": "🌟"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_specialist_forbidden(client):
    token = _register_specialist(client)
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    assert r.status_code == 403


def test_get_me_specialist_forbidden(client):
    token = _register_specialist(client)
    r = client.get("/api/v1/profiles/me", headers=_auth(token))
    assert r.status_code == 403


def test_create_child_unauthenticated(client):
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD)
    assert r.status_code == 401
```

- [ ] **Step 6: Ejecutar los tests y verificar que pasan**

```bash
cd backend
pytest tests/test_profiles.py -v
```

Salida esperada: todos los tests pasan (11 passed).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/profiles.py \
        backend/app/routers/profiles.py \
        backend/app/core/dependencies.py \
        backend/app/main.py \
        backend/tests/test_profiles.py
git commit -m "feat: backend perfiles — POST /children, GET /me, require_parent, tests"
```

---

### Task 2: Frontend — profilesApi y página ChildProfileForm

**Files:**
- Modify: `frontend/src/services/api.js` (agregar `profilesApi` al final)
- Create: `frontend/src/pages/ChildProfileForm.jsx`

**Interfaces:**
- Consumes: `profilesApi.createChild(data)` → `api.post('/profiles/children', data)` (Task 1)
- Produce: `profilesApi` exportado desde `api.js`, consumido por Task 3 (guard) y Task 4 (Dashboard)
- Produce: `ChildProfileForm` en ruta `/perfil/nuevo-nino`, importado en Task 3 (router)

- [ ] **Step 1: Agregar `profilesApi` al final de `frontend/src/services/api.js`**

Agregar estas líneas al final del archivo (después de `gamificationApi`):

```js
export const profilesApi = {
  getMe:       () => api.get('/profiles/me'),
  createChild: (data) => api.post('/profiles/children', data),
}
```

- [ ] **Step 2: Crear `frontend/src/pages/ChildProfileForm.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { profilesApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const AVATARS = ['🦊', '🐧', '🐸', '🦁', '🌟', '🐳', '🦋', '🐼']

export function ChildProfileForm() {
  const navigate = useNavigate()
  const [name, setName]               = useState('')
  const [age, setAge]                 = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('🌟')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('El nombre es obligatorio.')
      return
    }
    const ageNum = parseInt(age, 10)
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 17) {
      setError('La edad debe estar entre 1 y 17 años.')
      return
    }
    setLoading(true)
    try {
      await profilesApi.createChild({ name: trimmedName, age: ageNum, avatar_emoji: avatarEmoji })
      navigate('/inicio')
    } catch (err) {
      setError(err.response?.data?.detail || 'Algo salió mal. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="encouraging" size={100} />

        <Card animate className="w-full">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">
                ¿Cómo se llama tu niño/a?
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                Cuéntanos sobre él/ella
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              {/* Avatar */}
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-text-primary text-sm">
                  Elige un avatar
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatarEmoji(emoji)}
                      className={`
                        flex items-center justify-center rounded-2xl border-2 text-3xl
                        min-h-[56px] transition-colors
                        ${avatarEmoji === emoji
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-calm-border bg-calm-surface hover:border-primary-200'
                        }
                      `}
                      aria-label={`Avatar ${emoji}`}
                      aria-pressed={avatarEmoji === emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <Input
                id="name"
                name="name"
                type="text"
                label="Nombre del niño/a"
                placeholder="Ejemplo: Sofía"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              {/* Edad */}
              <Input
                id="age"
                name="age"
                type="number"
                label="Edad"
                placeholder="Entre 1 y 17 años"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={1}
                max={17}
                required
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-accent-coral text-xs text-center"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Guardando...' : 'Guardar y continuar'}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 3: Verificar visualmente en el navegador**

Con Docker corriendo (`docker-compose up -d`), abrir `http://localhost:5173/perfil/nuevo-nino` (la ruta aún no está protegida por el guard, así que es accesible directamente para verificar el UI).

Verificar:
- Lumi aparece arriba
- 8 emojis en grilla 4×2
- El emoji 🌟 está seleccionado por defecto (borde azul)
- Clic en otro emoji lo selecciona y quita el borde del anterior
- Campos de nombre y edad presentes
- Botón "Guardar y continuar"

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.js frontend/src/pages/ChildProfileForm.jsx
git commit -m "feat: ChildProfileForm y profilesApi — formulario de registro del niño"
```

---

### Task 3: Router — guard ParentOnboardingGuard, ruta y fix post-registro

**Files:**
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Register.jsx`

**Interfaces:**
- Consumes: `profilesApi.getMe()` de `../services/api` (Task 2)
- Consumes: `ChildProfileForm` de `../pages/ChildProfileForm` (Task 2)
- Produce: Guard `ParentOnboardingGuard` que bloquea padres sin hijo registrado

- [ ] **Step 1: Reemplazar el contenido completo de `frontend/src/router/index.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { profilesApi } from '../services/api'
import { Welcome }           from '../pages/Welcome'
import { Login }             from '../pages/Login'
import { Register }          from '../pages/Register'
import { Dashboard }         from '../pages/Dashboard'
import { EmotionSelector }   from '../pages/EmotionSelector'
import { ScenarioList }      from '../pages/ScenarioList'
import { ScenarioFlow }      from '../pages/ScenarioFlow'
import { ChatIA }            from '../pages/ChatIA'
import { ZonaCalma }         from '../pages/ZonaCalma'
import { PanelProfesional }  from '../pages/PanelProfesional'
import { ChildDetail }       from '../pages/ChildDetail'
import { Biblioteca }        from '../pages/Biblioteca'
import { MiAventura }        from '../pages/MiAventura'
import { ChildProfileForm }  from '../pages/ChildProfileForm'

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

function SpecialistRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'specialist') return <Navigate to="/inicio" replace />
  return children
}

function ParentOnboardingGuard({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(user?.role !== 'parent')

  useEffect(() => {
    if (user?.role !== 'parent') return
    profilesApi.getMe()
      .then(res => {
        if (!res.data.child) {
          navigate('/perfil/nuevo-nino', { replace: true })
        } else {
          setChecked(true)
        }
      })
      .catch(() => setChecked(true))
  }, [user?.role, navigate])

  if (!checked) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  return children
}

export const router = createBrowserRouter([
  { path: '/',         element: <Welcome /> },
  { path: '/login',    element: <Login /> },
  { path: '/registro', element: <Register /> },
  {
    path: '/perfil/nuevo-nino',
    element: <ProtectedRoute><ChildProfileForm /></ProtectedRoute>,
  },
  {
    path: '/inicio',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><Dashboard /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/emociones',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><EmotionSelector /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/escenarios',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ScenarioList /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/escenarios/:scenarioId',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ScenarioFlow /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/chat',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ChatIA /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/calma',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ZonaCalma /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/mi-aventura',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><MiAventura /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/panel',
    element: <SpecialistRoute><PanelProfesional /></SpecialistRoute>,
  },
  {
    path: '/panel/ninos/:childId',
    element: <SpecialistRoute><ChildDetail /></SpecialistRoute>,
  },
  {
    path: '/biblioteca',
    element: <SpecialistRoute><Biblioteca /></SpecialistRoute>,
  },
])
```

- [ ] **Step 2: Modificar `frontend/src/pages/Register.jsx` — navegación post-registro**

En `Register.jsx`, localizar el `handleSubmit`. Reemplazar la línea `navigate('/inicio')` con:

```jsx
// Antes:
navigate('/inicio')

// Después:
if (form.role === 'parent') {
  navigate('/perfil/nuevo-nino')
} else {
  navigate('/inicio')
}
```

El bloque completo del try en `handleSubmit` queda:

```jsx
try {
  await register(form)
  if (form.role === 'parent') {
    navigate('/perfil/nuevo-nino')
  } else {
    navigate('/inicio')
  }
} catch (err) {
  setError(err.response?.data?.detail || 'Hubo un error. Inténtalo de nuevo.')
}
```

- [ ] **Step 3: Verificar el flujo completo de registro**

Con Docker corriendo:
1. Ir a `http://localhost:5173/registro`
2. Registrar un nuevo padre (email distinto a los ya usados)
3. Verificar que después del submit redirige a `/perfil/nuevo-nino`
4. Completar el formulario del niño y verificar que redirige a `/inicio`
5. Cerrar sesión, volver a `/login`, ingresar con la misma cuenta
6. Verificar que el guard deja pasar (child ya existe) y llega al Dashboard

- [ ] **Step 4: Verificar que el guard bloquea a un padre sin hijo**

1. Registrar otro padre nuevo
2. Después del submit de registro, en la URL `/perfil/nuevo-nino`, navegar manualmente a `http://localhost:5173/inicio`
3. Verificar que el guard redirige de vuelta a `/perfil/nuevo-nino`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router/index.jsx frontend/src/pages/Register.jsx
git commit -m "feat: ParentOnboardingGuard y navegación post-registro a /perfil/nuevo-nino"
```

---

### Task 4: Dashboard — tarjeta del niño y fix de especialistas

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `profilesApi.getMe()` de `../services/api` (Task 2)
- Produce: Dashboard actualizado con cabecera de niño para padres y solo SPECIALIST_CARDS para especialistas

- [ ] **Step 1: Reemplazar el contenido completo de `frontend/src/pages/Dashboard.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { profilesApi } from '../services/api'
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
    emoji: '🦉',
    title: 'Chat con Lumi',
    desc: 'Conversa sobre cómo te sentís',
    available: true,
    path: '/chat',
  },
  {
    emoji: '🧘',
    title: 'Zona de calma',
    desc: 'Respira, pausa y calmáte',
    available: true,
    path: '/calma',
  },
  {
    emoji: '⭐',
    title: 'Mi aventura',
    desc: 'Tu progreso y recompensas',
    available: true,
    path: '/mi-aventura',
  },
]

const SPECIALIST_CARDS = [
  {
    emoji: '📊',
    title: 'Panel Profesional',
    desc: 'Historial de los niños',
    available: true,
    path: '/panel',
  },
  {
    emoji: '📚',
    title: 'Biblioteca',
    desc: 'Documentos educativos para Lumi',
    available: true,
    path: '/biblioteca',
  },
]

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const [child, setChild] = useState(null)

  useEffect(() => {
    if (user?.role === 'parent') {
      profilesApi.getMe()
        .then(res => setChild(res.data.child))
        .catch(() => {})
    }
  }, [user?.role])

  const cards = user?.role === 'specialist' ? SPECIALIST_CARDS : MODULE_CARDS

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-8">

        {/* Cabecera */}
        <div className="flex items-center gap-4">
          {user?.role === 'parent' && child ? (
            <>
              <span className="text-5xl" role="img" aria-label={`Avatar de ${child.name}`}>
                {child.avatar_emoji}
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-primary-700">{child.name}</h1>
                <p className="text-base text-text-secondary">{child.age} años</p>
              </div>
            </>
          ) : (
            <>
              <LumiCharacter state="happy" size={80} />
              <div>
                <h1 className="text-xl font-extrabold text-primary-700">
                  ¡Hola, {user?.full_name?.split(' ')[0] || 'Bienvenido'}!
                </h1>
                <p className="text-base text-text-secondary">
                  {ROLE_LABELS[user?.role] || 'Usuario'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Módulos */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">Módulos</h2>
          {cards.map((mod, i) => (
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
                    <p className="font-bold text-text-primary text-base">{mod.title}</p>
                    <p className="text-base text-text-secondary">{mod.desc}</p>
                  </div>
                  <span className="text-text-muted text-xl">›</span>
                </button>
              ) : (
                <Card className="flex items-center gap-4 opacity-50">
                  <span className="text-3xl">{mod.emoji}</span>
                  <div>
                    <p className="font-bold text-text-primary text-base">{mod.title}</p>
                    <p className="text-base text-text-muted">{mod.desc}</p>
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

- [ ] **Step 2: Verificar Dashboard de padre**

Con Docker corriendo y habiendo completado el flujo de registro del Task 3:
1. Iniciar sesión como padre que ya registró a su hijo
2. Ir a `/inicio`
3. Verificar que la cabecera muestra el emoji avatar del niño + nombre del niño + edad
4. Verificar que los 5 módulos del niño aparecen (Selector emocional, Escenarios, Chat, Calma, Mi aventura)

- [ ] **Step 3: Verificar Dashboard de especialista**

1. Iniciar sesión como especialista
2. Ir a `/inicio`
3. Verificar que solo aparecen 2 módulos: "Panel Profesional" y "Biblioteca"
4. Verificar que NO aparecen los módulos del niño (Selector emocional, Escenarios, Chat, Calma, Mi aventura)
5. La cabecera debe mostrar Lumi + saludo genérico (no intenta cargar perfil de hijo)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: Dashboard — tarjeta hijo para padres, solo SPECIALIST_CARDS para especialistas"
```
