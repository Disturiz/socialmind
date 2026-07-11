# Spec: Asignación Especialista-Niño

**Fecha:** 2026-07-11  
**Estado:** Aprobado  
**Módulo:** Panel Profesional / Gestión de perfiles

---

## Objetivo

Permitir que cada especialista solo vea los niños que le fueron asignados por el padre. El padre gestiona las asignaciones desde el perfil de cada hijo, eligiendo de una lista de especialistas registrados.

---

## Alcance

- Nueva tabla `specialist_assignments` (muchos-a-muchos entre especialistas y perfiles de niño)
- 4 endpoints bajo `/api/v1/assignments/`
- Panel Profesional filtrado: cada especialista ve solo sus niños asignados
- UI de gestión para el padre dentro de `ChildProfileForm`
- Migración con seed de compatibilidad para datos existentes

---

## Backend

### Modelo

```python
# backend/app/models/specialist_assignment.py
class SpecialistAssignment(Base):
    __tablename__ = "specialist_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    specialist_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    child_profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("child_profiles.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Restricción única: no duplicados
    __table_args__ = (UniqueConstraint("specialist_id", "child_profile_id"),)
```

### Endpoints

**Router:** `backend/app/routers/assignments.py`  
**Prefijo:** `/api/v1/assignments`

| Método | Ruta | Rol requerido | Descripción |
|--------|------|---------------|-------------|
| `GET` | `/specialists` | `parent` | Lista todos los usuarios con rol `specialist` (id, full_name, email) |
| `GET` | `/children/{child_id}/specialists` | `parent` | Lista especialistas asignados al niño |
| `POST` | `/children/{child_id}/specialists/{specialist_id}` | `parent` | Crea asignación |
| `DELETE` | `/children/{child_id}/specialists/{specialist_id}` | `parent` | Elimina asignación |

**Seguridad:**
- Todos los endpoints de padre verifican que `child_id` pertenezca al usuario autenticado (`ChildProfile.parent_id == current_user.id`). Retorna 404 si no es su hijo.
- `POST` duplicado retorna 409 Conflict.
- `DELETE` de asignación inexistente retorna 404.

### Schemas

```python
# SpecialistOut — usado en GET /specialists y GET /children/{id}/specialists
class SpecialistOut(BaseModel):
    id: int
    full_name: str
    email: str

# AssignmentOut — respuesta del POST
class AssignmentOut(BaseModel):
    id: int
    specialist_id: int
    child_profile_id: int
    assigned_at: datetime
```

### Modificaciones al Panel

**`panel_service.list_children(db, specialist_id)`**
- Agrega JOIN con `SpecialistAssignment`
- Filtra: `SpecialistAssignment.specialist_id == specialist_id`
- Si el especialista no tiene asignaciones, devuelve lista vacía (no error)

**`panel_service.get_child_detail(db, child_id, specialist_id)`**
- Verifica que exista `SpecialistAssignment` con ese par antes de retornar datos
- Si no existe asignación: retorna `403 Forbidden`

**`panel.py` router:**
- `list_children` pasa `current_user.id` al servicio
- `get_child_detail` ya pasa `current_user.id` — sin cambios en el router

### Migración Alembic

1. Crea tabla `specialist_assignments` con restricción única `(specialist_id, child_profile_id)`
2. **Seed de compatibilidad:** asigna todos los especialistas existentes a todos los niños existentes, para no romper el acceso actual

```python
# En la migración upgrade():
# 1. CREATE TABLE specialist_assignments ...
# 2. INSERT INTO specialist_assignments (specialist_id, child_profile_id, assigned_at)
#    SELECT u.id, cp.id, NOW()
#    FROM users u CROSS JOIN child_profiles cp
#    WHERE u.role = 'specialist'
#    ON CONFLICT DO NOTHING
```

---

## Frontend

### Componente nuevo

**`frontend/src/components/SpecialistAssignments.jsx`**

Props: `childProfileId: int`

Comportamiento:
- Al montar: llama `GET /assignments/children/{childProfileId}/specialists` → lista especialistas asignados
- Muestra lista de especialistas asignados (nombre + email) con botón ✕ para quitar
- Botón "**+ Agregar especialista**": llama `GET /assignments/specialists` → muestra lista desplegable de todos los especialistas → al seleccionar uno llama `POST /assignments/children/{childProfileId}/specialists/{specialistId}` → actualiza lista
- Si asignación duplicada (409): muestra mensaje "Ya está asignado"
- Estados: loading, vacío ("Ningún especialista asignado aún"), con datos

### Modificación: ChildProfileForm

**`frontend/src/pages/ChildProfileForm.jsx`**

- Agrega sección al final del formulario (solo visible cuando el perfil ya existe, no al crear nuevo):

```
Especialistas asignados
─────────────────────────────
👩‍⚕️ Dra. García  esp@prueba.com  [✕]
[+ Agregar especialista]
```

- El componente `SpecialistAssignments` solo se renderiza cuando `childProfileId` está disponible (perfil ya guardado)

### Modificación: api.js

```js
export const assignmentsApi = {
  listSpecialists: () => api.get('/assignments/specialists'),
  listAssigned: (childId) => api.get(`/assignments/children/${childId}/specialists`),
  assign: (childId, specialistId) =>
    api.post(`/assignments/children/${childId}/specialists/${specialistId}`),
  unassign: (childId, specialistId) =>
    api.delete(`/assignments/children/${childId}/specialists/${specialistId}`),
}
```

### Panel Profesional — sin cambios de UI

El cambio es transparente para el especialista. Si no tiene asignaciones, la lista muestra:

> "Aún no tienes niños asignados. Pide a un padre que te agregue desde el perfil de su hijo."

---

## Errores

| Caso | Respuesta |
|------|-----------|
| Padre intenta gestionar hijo ajeno | 404 Not Found |
| Asignación duplicada (POST) | 409 Conflict |
| Asignación inexistente (DELETE) | 404 Not Found |
| Especialista accede a niño no asignado | 403 Forbidden |
| ID de especialista no existe o no es rol specialist | 404 Not Found |

---

## Lo que queda fuera de este spec

- Notificaciones al especialista cuando se le asigna un niño
- El especialista puede ver qué padres lo asignaron
- Solicitudes de acceso por parte del especialista (flujo inverso)
- Panel de administración de asignaciones
