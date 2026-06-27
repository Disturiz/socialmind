# SocialMind — Registro de Perfil de Niño: Diseño y Especificación

**Fecha:** 2026-06-27
**Autor:** Douglas Isturiz
**Estado:** Aprobado

---

## Resumen

Un padre/madre que se registra en SocialMind necesita crear el perfil de su hijo antes de poder usar los módulos de la plataforma. Esta feature implementa el flujo completo: endpoint backend, formulario frontend, y guard de router que garantiza que ningún padre accede a los módulos sin tener un hijo registrado.

También incluye el fix del Dashboard para especialistas: actualmente los especialistas ven los módulos del niño (incorrecto); tras este cambio solo verán sus módulos propios.

---

## Alcance

**Incluido:**
- Endpoint `POST /api/v1/profiles/children` — crear perfil del niño (un solo hijo por padre en esta versión)
- Endpoint `GET /api/v1/profiles/me` — consultar si el padre ya tiene hijo registrado
- Dependency `require_parent` en `dependencies.py`
- Schemas Pydantic: `ChildProfileCreate`, `ChildProfileOut`, `ParentProfileOut`
- Página `ChildProfileForm.jsx` en ruta `/perfil/nuevo-nino`
- Guard de router `ParentOnboardingGuard` — redirige a `/perfil/nuevo-nino` si `child === null`
- Dashboard actualizado: cabecera con avatar + nombre del niño; fix especialistas
- `profilesApi` en `services/api.js`

**Excluido:**
- Múltiples hijos por padre (queda para etapa futura)
- Edición o eliminación del perfil del niño
- Foto de perfil real (solo emoji)
- Notificaciones push

---

## Decisiones de diseño

- **Un hijo por padre (MVP):** Si el padre ya tiene un hijo registrado, `POST /api/v1/profiles/children` retorna 409 Conflict.
- **Sin migración:** La tabla `child_profiles` ya existe desde la migración `996b01c63f7f_crear_tablas_users_y_child_profiles.py`.
- **Guard no intrusivo:** El `ParentOnboardingGuard` solo aplica a usuarios con rol `parent`. Especialistas y admins no pasan por él.
- **Flujo de registro:** Después de `POST /auth/register`, el frontend navega a `/perfil/nuevo-nino` (para padres) o a `/inicio` (para especialistas). El guard atrapa también logins posteriores sin hijo.

---

## Backend

### Estructura de archivos

```
backend/app/
  schemas/profiles.py       ← NUEVO
  routers/profiles.py       ← NUEVO
  core/dependencies.py      ← MODIFICADO: agregar require_parent
  main.py                   ← MODIFICADO: registrar router /api/v1/profiles
```

### Schemas (`schemas/profiles.py`)

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

### Dependency (`core/dependencies.py`)

Agregar junto al `require_specialist` existente:

```python
def require_parent(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.parent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para padres.",
        )
    return current_user
```

### Router (`routers/profiles.py`)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.user import User
from app.models.child_profile import ChildProfile
from app.schemas.profiles import ChildProfileCreate, ChildProfileOut, ParentProfileOut

router = APIRouter()

@router.get("/me", response_model=ParentProfileOut)
def get_my_profile(current_user: User = Depends(require_parent), db: Session = Depends(get_db)):
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

### Registro en `main.py`

```python
from app.routers import profiles
app.include_router(profiles.router, prefix="/api/v1/profiles", tags=["perfiles"])
```

---

## Frontend

### Estructura de archivos

```
frontend/src/
  pages/ChildProfileForm.jsx        ← NUEVO
  router/index.jsx                  ← MODIFICADO: ruta + ParentOnboardingGuard
  pages/Dashboard.jsx               ← MODIFICADO: cabecera con hijo; fix especialistas
  pages/Register.jsx                ← MODIFICADO: navegar a /perfil/nuevo-nino si rol parent
  services/api.js                   ← MODIFICADO: agregar profilesApi
```

### `profilesApi` en `services/api.js`

```js
profilesApi: {
  getMe:       () => api.get('/profiles/me'),
  createChild: (data) => api.post('/profiles/children', data),
}
```

### `ChildProfileForm.jsx` — ruta `/perfil/nuevo-nino`

Campos del formulario:
- `name` — input de texto, requerido, max 100 chars
- `avatar_emoji` — selector de 8 botones emoji (fila de 4 + fila de 4), uno activo a la vez con borde `border-primary-500 bg-primary-50`
- `age` — input numérico, min 1, max 17

Emojis disponibles (en este orden): `['🦊', '🐧', '🐸', '🦁', '🌟', '🐳', '🦋', '🐼']`

Valor por defecto: `avatar_emoji = '🌟'` (el quinto de la lista, emoji neutro).

Flujo:
1. `handleSubmit` llama a `profilesApi.createChild({ name, age, avatar_emoji })`
2. En éxito → `navigate('/inicio')`
3. En error → muestra `error.response?.data?.detail` o mensaje genérico

Visual:
- `PageWrapper` con `LumiCharacter state="encouraging" size={100}` en la cabecera
- `Card` con título "¿Cómo se llama tu niño/a?" y subtítulo "Cuéntanos sobre él/ella"
- `Button` deshabilitado mientras `loading`

### `ParentOnboardingGuard` en `router/index.jsx`

Componente wrapper que:
1. Solo aplica si `user.role === 'parent'`
2. Llama a `profilesApi.getMe()` una vez al montar
3. Mientras carga: muestra spinner (misma pantalla de loading que usan otras páginas)
4. Si `child === null` y la ruta actual no es `/perfil/nuevo-nino` → `<Navigate to="/perfil/nuevo-nino" replace />`
5. Si `child` existe → renderiza `<Outlet />`
6. No aplica a especialistas ni admins

El guard envuelve todas las rutas protegidas de padres: `/inicio`, `/emociones`, `/escenarios`, `/chat`, `/calma`, `/mi-aventura`.

### `Register.jsx` — cambio post-registro

En el `handleSubmit`, después del `await register(form)`:

```js
if (form.role === 'parent') {
  navigate('/perfil/nuevo-nino')
} else {
  navigate('/inicio')
}
```

### `Dashboard.jsx` — dos cambios

**1. Fix especialistas** — reemplazar línea 75-77:

```js
// Antes:
const cards = user?.role === 'specialist'
  ? [...MODULE_CARDS, ...SPECIALIST_CARDS]
  : MODULE_CARDS

// Después:
const cards = user?.role === 'specialist'
  ? SPECIALIST_CARDS
  : MODULE_CARDS
```

**2. Cabecera para padres** — mostrar el perfil del hijo si está disponible.

El Dashboard llama a `profilesApi.getMe()` al montar (solo si `user.role === 'parent'`) y guarda `child` en state. La cabecera muestra:
- Si hay hijo: `{child.avatar_emoji}` grande + `{child.name}` + `{child.age} años`
- Si no hay hijo (no debería llegar aquí gracias al guard, pero como fallback): el saludo genérico actual

---

## Tests

### Backend (pytest)

- `test_create_child_success` — padre crea hijo, 201, campos correctos
- `test_create_child_duplicate` — segundo intento retorna 409
- `test_create_child_invalid_age` — age=0 y age=18 retornan 422
- `test_create_child_invalid_avatar` — emoji no permitido retorna 422
- `test_create_child_specialist_forbidden` — especialista recibe 403
- `test_get_me_no_child` — padre nuevo, child === null
- `test_get_me_with_child` — padre con hijo, retorna datos correctos

### Frontend

No se requieren tests automatizados para el MVP del formulario. La verificación es manual en el navegador.

---

## Flujo completo de usuario

```
1. Padre visita /register
2. Completa nombre, email, contraseña, rol=parent → POST /auth/register
3. Frontend navega a /perfil/nuevo-nino
4. Padre elige emoji avatar, escribe nombre del niño, ingresa edad → POST /profiles/children
5. Frontend navega a /inicio
6. ParentOnboardingGuard verifica: child existe → deja pasar
7. Dashboard muestra avatar + nombre del niño en cabecera + módulos

--- Login posterior ---
8. Padre hace login → POST /auth/login → navega a /inicio
9. ParentOnboardingGuard llama GET /profiles/me → child existe → deja pasar
10. Dashboard normal
```
