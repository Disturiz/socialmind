# Módulo de Administración — Design Spec

## Objetivo

Panel de administración integrado en la app para gestionar usuarios (padres, especialistas) desde una cuenta con rol `admin`: listar, buscar, activar/desactivar, cambiar rol y eliminar con borrado en cascada.

## Contexto del proyecto

- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL
- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion + React Router v6
- **Patrón existente:** routers en `backend/app/routers/`, servicios en `backend/app/services/`, dependencias en `backend/app/core/dependencies.py`
- **Roles existentes:** `admin`, `parent`, `specialist` — ya definidos en `UserRole` enum en `user.py`
- **`is_active`:** ya existe en el modelo `User` (Boolean, default=True)
- **No se necesita migración de Alembic:** el rol `admin` ya está en el enum y `is_active` ya existe

---

## Arquitectura

### Archivos a crear

```
backend/app/schemas/admin.py           ← AdminUserOut, AdminUserUpdate
backend/app/services/admin_service.py  ← list_users, update_user, delete_user
backend/app/routers/admin.py           ← 3 endpoints REST
backend/scripts/create_admin.py        ← CLI para crear el primer admin
backend/tests/test_admin.py            ← tests unitarios e integración

frontend/src/pages/AdminPage.jsx       ← tabla de usuarios con filtros y acciones
```

### Archivos a modificar

```
backend/app/core/dependencies.py       ← añadir require_admin()
backend/app/main.py                    ← registrar admin router
frontend/src/services/api.js           ← añadir adminApi
frontend/src/router/index.jsx          ← AdminRoute guard + ruta /admin
frontend/src/pages/Dashboard.jsx       ← enlace "Admin" visible solo para role=admin
```

---

## Backend

### Dependencia `require_admin`

Añadir a `backend/app/core/dependencies.py`:

```python
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para administradores.",
        )
    return current_user
```

### Schemas (`backend/app/schemas/admin.py`)

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class AdminUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None      # "parent" | "specialist" | "admin"
    is_active: Optional[bool] = None
```

### Endpoints (`backend/app/routers/admin.py`)

Todos los endpoints requieren `require_admin`. El prefijo es `/api/v1/admin`.

| Método   | Ruta           | Query params                              | Respuesta               | Descripción                         |
|----------|----------------|-------------------------------------------|-------------------------|-------------------------------------|
| `GET`    | `/users`       | `search`, `role`, `is_active`             | `list[AdminUserOut]`    | Lista de usuarios con filtros       |
| `PATCH`  | `/users/{id}`  | —                                         | `AdminUserOut`          | Cambia `role` y/o `is_active`       |
| `DELETE` | `/users/{id}`  | —                                         | HTTP 204 No Content     | Borrado en cascada                  |

**Filtros del GET:**
- `search` (str, opcional): filtra por `full_name` o `email` (ILIKE `%search%`)
- `role` (str, opcional): `"parent"`, `"specialist"` o `"admin"`
- `is_active` (bool, opcional): `true` o `false`

**Regla de seguridad para PATCH y DELETE:** si `id == current_user.id`, retornar HTTP 400 con `"No puedes modificar ni eliminar tu propia cuenta."`.

**PATCH:** al menos uno de `role` o `is_active` debe estar presente; si ambos son `None`, retornar HTTP 422.

**DELETE:** retorna HTTP 204 No Content.

### Servicio (`backend/app/services/admin_service.py`)

#### `list_users(db, search, role, is_active) -> list[User]`

Query sobre `User` con filtros opcionales encadenados. Ordenado por `created_at` descendente.

#### `update_user(db, user_id, data, current_user_id) -> User`

1. Si `user_id == current_user_id` → raise HTTP 400
2. `user = db.get(User, user_id)` → si None, raise HTTP 404
3. Si `data.role` no es None → `user.role = UserRole(data.role)` (ValueError → HTTP 422)
4. Si `data.is_active` no es None → `user.is_active = data.is_active`
5. `db.commit(); db.refresh(user); return user`

#### `delete_user(db, user_id, current_user_id) -> None`

1. Si `user_id == current_user_id` → raise HTTP 400
2. `user = db.get(User, user_id)` → si None, raise HTTP 404
3. Eliminar en este orden exacto (todos con `synchronize_session=False`):

```python
# a. password_reset_tokens
db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete(synchronize_session=False)

# b. reward_events
db.query(RewardEvent).filter(RewardEvent.user_id == user_id).delete(synchronize_session=False)

# c. user_rewards
db.query(UserRewards).filter(UserRewards.user_id == user_id).delete(synchronize_session=False)

# d. child_profile IDs del usuario (para cascadar notas y asignaciones)
child_ids = [c[0] for c in db.query(ChildProfile.id).filter(ChildProfile.parent_id == user_id).all()]

# e. specialist_notes donde specialist_id = user_id O child_profile_id en child_ids
db.query(SpecialistNote).filter(
    or_(SpecialistNote.specialist_id == user_id,
        SpecialistNote.child_profile_id.in_(child_ids))
).delete(synchronize_session=False)

# f. specialist_assignments donde specialist_id = user_id O child_profile_id en child_ids
db.query(SpecialistAssignment).filter(
    or_(SpecialistAssignment.specialist_id == user_id,
        SpecialistAssignment.child_profile_id.in_(child_ids))
).delete(synchronize_session=False)

# g. document_chunks → documents (document_chunks tiene ondelete=CASCADE en FK)
db.query(Document).filter(Document.specialist_id == user_id).delete(synchronize_session=False)

# h. adult_messages → adult_conversations
adult_conv_ids = [c[0] for c in db.query(AdultConversation.id).filter(AdultConversation.user_id == user_id).all()]
if adult_conv_ids:
    db.query(AdultMessage).filter(AdultMessage.conversation_id.in_(adult_conv_ids)).delete(synchronize_session=False)
db.query(AdultConversation).filter(AdultConversation.user_id == user_id).delete(synchronize_session=False)

# i. chat_messages → chat_conversations
chat_conv_ids = [c[0] for c in db.query(ChatConversation.id).filter(ChatConversation.user_id == user_id).all()]
if chat_conv_ids:
    db.query(ChatMessage).filter(ChatMessage.conversation_id.in_(chat_conv_ids)).delete(synchronize_session=False)
db.query(ChatConversation).filter(ChatConversation.user_id == user_id).delete(synchronize_session=False)

# j. calm_sessions
db.query(CalmSession).filter(CalmSession.user_id == user_id).delete(synchronize_session=False)

# k. scenario_completions
db.query(ScenarioCompletion).filter(ScenarioCompletion.user_id == user_id).delete(synchronize_session=False)

# l. emotion_logs
db.query(EmotionLog).filter(EmotionLog.user_id == user_id).delete(synchronize_session=False)

# m. child_profiles (el modelo User tiene cascade="all, delete-orphan", pero borramos explícitamente
#    porque ya limpiamos las dependencias FK manualmente arriba)
db.query(ChildProfile).filter(ChildProfile.parent_id == user_id).delete(synchronize_session=False)

# n. finalmente, el usuario
db.delete(user)
db.commit()
```

**Nota importante:** `document_chunks` tiene `ForeignKey("documents.id", ondelete="CASCADE")` a nivel de base de datos, por lo que al eliminar `documents` con SQLAlchemy (`synchronize_session=False`) en PostgreSQL, los chunks se eliminan automáticamente por la FK CASCADE de la BD.

### Script CLI (`backend/scripts/create_admin.py`)

Uso:
```bash
docker compose -f docker-compose.prod.yml exec backend \
  python -m scripts.create_admin --email admin@socialmind.it.com --full-name "Admin" --password "MiClave123"
```

Comportamiento:
1. Parsear `--email`, `--full-name` (default: `"Administrador"`), `--password`
2. Abrir sesión de BD
3. Si ya existe un usuario con ese email → imprimir error y salir con código 1
4. Crear `User(email=..., full_name=..., hashed_password=hash_password(...), role=UserRole.admin)`
5. Commit y print: `"Admin creado: {email}"`

El script importa `hash_password` desde `app.core.security` y `get_db` / `engine` desde `app.database`. No usa FastAPI — abre la sesión directamente con `SessionLocal()`.

El archivo `backend/scripts/__init__.py` debe existir (vacío) para que `python -m scripts.create_admin` funcione.

### Registro en `main.py`

```python
from app.routers import admin as admin_router
# ...
app.include_router(admin_router.router, prefix="/api/v1/admin", tags=["administración"])
```

---

## Frontend

### `adminApi` en `frontend/src/services/api.js`

```js
export const adminApi = {
  listUsers:  (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id)       => api.delete(`/admin/users/${id}`),
}
```

### `AdminRoute` en `frontend/src/router/index.jsx`

```jsx
function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-calm-bg flex items-center justify-center">
    <p className="text-text-secondary text-base">Cargando...</p>
  </div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/inicio" replace />
  return children
}
```

Ruta a añadir al array del router (pública dentro del guard, sin `ParentOnboardingGuard`):
```jsx
{ path: '/admin', element: <AdminRoute><AdminPage /></AdminRoute> }
```

Importar:
```jsx
import { AdminPage } from '../pages/AdminPage'
```

### `AdminPage.jsx`

**Estado:**
```js
const [users, setUsers]           = useState([])
const [loading, setLoading]       = useState(true)
const [error, setError]           = useState('')
const [search, setSearch]         = useState('')
const [roleFilter, setRoleFilter] = useState('')
const [activeFilter, setActiveFilter] = useState('')
const [confirmDelete, setConfirmDelete] = useState(null)  // user id o null
```

**Carga de datos:** `useEffect` que llama a `adminApi.listUsers({ search, role: roleFilter, is_active: activeFilter })` cuando cambia cualquiera de los tres filtros. Debounce de 300ms en `search`.

**Layout:**
```
<PageWrapper>
  <h1>Panel de administración</h1>

  [Barra de filtros]
    <Input placeholder="Buscar por nombre o email..." value={search} onChange=... />
    <select value={roleFilter} onChange=...>
      <option value="">Todos los roles</option>
      <option value="parent">Padres</option>
      <option value="specialist">Especialistas</option>
      <option value="admin">Admins</option>
    </select>
    <select value={activeFilter} onChange=...>
      <option value="">Todos</option>
      <option value="true">Activos</option>
      <option value="false">Suspendidos</option>
    </select>

  [Tabla de usuarios]
    Columnas: Nombre | Email | Rol | Estado | Fecha de registro | Acciones

  [Por fila — Acciones]
    • Botón toggle: si is_active=true → "Suspender" (llama PATCH {is_active:false}),
                    si is_active=false → "Activar" (llama PATCH {is_active:true})
    • Dropdown rol: <select> con opciones parent/specialist/admin → onChange llama PATCH {role:...}
    • Botón "Eliminar":
        - Si confirmDelete !== user.id → setConfirmDelete(user.id) y cambia texto a "¿Seguro?"
        - Si confirmDelete === user.id → llama deleteUser(user.id), recarga lista, setConfirmDelete(null)
    • El admin no puede actuar sobre su propia fila (las acciones aparecen deshabilitadas)

  [Badges de rol]
    admin → bg-purple, specialist → bg-blue, parent → bg-green
  [Badge estado]
    Activo → verde, Suspendido → gris
```

**Feedback:** spinner durante carga, mensaje de error en rojo si falla, las acciones por fila tienen estado de carga individual (`loadingRow: {[userId]: bool}`).

### Enlace en Dashboard / navbar

En `frontend/src/pages/Dashboard.jsx` (o el componente de navegación que corresponda), añadir condicionalmente:
```jsx
{user.role === 'admin' && (
  <Link to="/admin">Panel admin</Link>
)}
```

---

## Tests (`backend/tests/test_admin.py`)

Usando pytest + TestClient + SQLite en memoria (mismo patrón que `test_password_reset.py`).

Setup: crear un usuario admin, un usuario parent y un usuario specialist como fixtures.

| Test | Descripción |
|------|-------------|
| `test_list_users_returns_all` | GET /admin/users → lista los 3 usuarios |
| `test_list_users_filter_role` | GET /admin/users?role=parent → solo el parent |
| `test_list_users_filter_search` | GET /admin/users?search=especialista → filtra por nombre |
| `test_list_users_filter_active` | GET /admin/users?is_active=false → lista vacía inicialmente |
| `test_list_users_requires_admin` | GET /admin/users con token de parent → 403 |
| `test_update_user_role` | PATCH /admin/users/{parent_id} {role:"specialist"} → 200, role cambiado |
| `test_update_user_deactivate` | PATCH /admin/users/{parent_id} {is_active:false} → 200, is_active=False |
| `test_update_self_returns_400` | PATCH /admin/users/{admin_id} → 400 |
| `test_update_user_not_found` | PATCH /admin/users/99999 → 404 |
| `test_delete_user_cascades` | DELETE /admin/users/{parent_id} → 204, user ya no existe en BD |
| `test_delete_self_returns_400` | DELETE /admin/users/{admin_id} → 400 |
| `test_delete_user_not_found` | DELETE /admin/users/99999 → 404 |
| `test_delete_requires_admin` | DELETE con token de specialist → 403 |

---

## Creación del primer admin en producción

```bash
# Ejecutar una sola vez en el VPS
docker compose -f /root/socialmind/docker-compose.prod.yml exec backend \
  python -m scripts.create_admin \
  --email admin@socialmind.it.com \
  --full-name "Administrador" \
  --password "CONTRASEÑA_SEGURA"
```

---

## Restricciones globales

- El rol `admin` ya existe en `UserRole` enum — no crear un nuevo enum ni valor
- No añadir paginación a la lista de usuarios (YAGNI — la plataforma es pequeña)
- No añadir página de detalle de usuario — las acciones van inline en la tabla
- El admin no puede actuar sobre su propia cuenta (ni desde backend ni desde frontend)
- El borrado es permanente (hard delete con cascada) — no hay papelera ni soft delete adicional al `is_active` existente
- Seguir el patrón de tests existente en `backend/tests/test_password_reset.py`
- No introducir nuevas dependencias de Python ni de npm
