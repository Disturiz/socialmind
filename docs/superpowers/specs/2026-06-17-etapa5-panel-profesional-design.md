# SocialMind Etapa 5 — Panel Profesional: Diseño y Especificación

**Fecha:** 2026-06-17
**Autor:** Douglas Isturiz
**Estado:** Aprobado

---

## Resumen

Panel de lectura para especialistas (terapeutas/docentes) con rol `specialist`. Muestra la lista de todos los niños registrados en la plataforma y permite ver, por niño: historial de emociones, sesiones de calma y transcripciones de conversaciones con Lumi. El especialista puede guardar una nota libre por niño. Sin diagnósticos, sin lenguaje clínico.

---

## Alcance de Etapa 5

**Incluido:**
- Modelo `specialist_notes` con migración Alembic
- 3 endpoints REST bajo `/api/v1/panel` (lista de niños, detalle de niño, guardar nota)
- Página `PanelProfesional.jsx` — lista de niños con resumen
- Página `ChildDetail.jsx` — detalle completo con 3 secciones (emociones, calma, conversaciones) y nota
- Rutas protegidas `/panel` y `/panel/ninos/:childId`
- Tarjeta "Panel Profesional" en Dashboard activada solo para rol `specialist`
- Tests backend (pytest) y frontend (Vitest)

**Excluido:**
- Exportación PDF o CSV de datos
- Estadísticas agregadas de toda la plataforma
- Asignación explícita de especialistas a niños
- Notas vinculadas a sesiones o conversaciones específicas
- Despliegue / configuración de producción

---

## Modelo de datos

### `specialist_notes` (nuevo)
```sql
id                SERIAL PRIMARY KEY
specialist_id     INTEGER NOT NULL REFERENCES users(id)
child_profile_id  INTEGER NOT NULL REFERENCES child_profiles(id)
content           TEXT NOT NULL
updated_at        TIMESTAMP NOT NULL
UNIQUE(specialist_id, child_profile_id)
```

**Índice:** la constraint UNIQUE actúa como índice para el lookup `(specialist_id, child_profile_id)`.

### Vínculo de actividades con perfiles de niño

Las tablas `emotion_logs`, `calm_sessions` y `chat_conversations` usan `user_id` que referencia `users.id` del padre. El panel obtiene los datos del niño a través de `child_profiles.parent_id = user_id`. En MVP se asume un perfil de niño por cuenta padre; si hay varios perfiles bajo el mismo padre, todos verán los mismos datos de actividad (limitación aceptada para Etapa 5).

---

## API — Endpoints

Base: `/api/v1/panel` — todos requieren JWT con rol `specialist`. Si el rol es distinto: `403 Forbidden`.

### `GET /api/v1/panel/children`

Lista todos los perfiles de niño con resumen de actividad.

**Response 200:**
```json
[
  {
    "child_profile_id": 1,
    "name": "Juan",
    "age": 10,
    "avatar_emoji": "⭐",
    "last_emotion_key": "nervioso",
    "total_calm_sessions": 5,
    "total_chats": 3
  }
]
```

Si no hay niños: array vacío `[]`.

---

### `GET /api/v1/panel/children/{child_id}`

Detalle completo de un niño. Incluye últimas 30 emociones, últimas 30 sesiones de calma y últimas 10 conversaciones con todos sus mensajes.

**Response 200:**
```json
{
  "child_profile_id": 1,
  "name": "Juan",
  "age": 10,
  "avatar_emoji": "⭐",
  "emotions": [
    { "emotion_key": "nervioso", "logged_at": "2026-06-17T10:00:00Z" }
  ],
  "calm_sessions": [
    {
      "activity_type": "respirar",
      "duration_seconds": 40,
      "emotion_key": "nervioso",
      "created_at": "2026-06-17T10:05:00Z"
    }
  ],
  "conversations": [
    {
      "conversation_id": 7,
      "emotion_key": "nervioso",
      "started_at": "2026-06-17T10:10:00Z",
      "ended_at": "2026-06-17T10:15:00Z",
      "message_count": 6,
      "messages": [
        { "role": "assistant", "content": "Hola, ¿cómo estás?", "created_at": "2026-06-17T10:10:00Z" },
        { "role": "user", "content": "Bien", "created_at": "2026-06-17T10:10:30Z" }
      ]
    }
  ],
  "specialist_note": "Juan muestra progreso en regulación emocional."
}
```

`specialist_note`: nota del especialista autenticado para ese niño, o `null` si no existe.

**Response 404:** si `child_id` no existe.

---

### `PUT /api/v1/panel/children/{child_id}/note`

Crea o actualiza la nota del especialista autenticado para ese niño (upsert por `specialist_id + child_profile_id`).

**Request body:**
```json
{ "content": "Juan muestra progreso en regulación emocional." }
```

**Validaciones:**
- `content` no puede estar vacío
- `content` máximo 2000 caracteres

**Response 200:**
```json
{
  "content": "Juan muestra progreso en regulación emocional.",
  "updated_at": "2026-06-17T15:00:00Z"
}
```

**Response 404:** si `child_id` no existe.

---

## Backend — Archivos

```
backend/app/models/specialist_note.py          (nuevo)
backend/alembic/versions/xxxx_add_specialist_notes.py  (nuevo)
backend/app/schemas/panel.py                   (nuevo)
backend/app/services/panel_service.py          (nuevo)
backend/app/routers/panel.py                   (nuevo)
backend/app/main.py                            (modificado — incluir router panel)
backend/app/models/__init__.py                 (modificado — exportar SpecialistNote)
backend/tests/test_panel.py                    (nuevo)
```

### Modelo `SpecialistNote`
```python
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class SpecialistNote(Base):
    __tablename__ = "specialist_notes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specialist_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    child_profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("child_profiles.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    __table_args__ = (UniqueConstraint("specialist_id", "child_profile_id", name="uq_note_specialist_child"),)
```

### Dependencia `require_specialist`
```python
from fastapi import HTTPException, status
from app.models.user import UserRole

def require_specialist(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.specialist:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso solo para especialistas.")
    return current_user
```

Definida en `app/core/dependencies.py` junto a `get_current_user`.

### Servicio `panel_service.py`
- `list_children(db)` — query todos los `ChildProfile`, para cada uno agrega last_emotion, total_calm_sessions, total_chats vía su `parent_id`
- `get_child_detail(db, child_id, specialist_id)` — levanta `ChildProfile` (404 si no existe), fetches emotions/calm/conversations del `parent_id`, nota del especialista
- `save_note(db, specialist_id, child_id, content)` — upsert en `specialist_notes`; `updated_at = datetime.now(timezone.utc)`

---

## Frontend — Archivos

```
frontend/src/pages/PanelProfesional.jsx        (nuevo)
frontend/src/pages/ChildDetail.jsx             (nuevo)
frontend/src/test/PanelProfesional.test.jsx    (nuevo)
frontend/src/test/ChildDetail.test.jsx         (nuevo)
frontend/src/services/api.js                   (modificado — agregar panelApi)
frontend/src/router/index.jsx                  (modificado — rutas /panel y /panel/ninos/:childId)
frontend/src/pages/Dashboard.jsx               (modificado — tarjeta Panel Profesional condicional)
```

### `panelApi` en `api.js`
```js
export const panelApi = {
  listChildren: () =>
    api.get('/panel/children'),
  getChild: (childId) =>
    api.get(`/panel/children/${childId}`),
  saveNote: (childId, content) =>
    api.put(`/panel/children/${childId}/note`, { content }),
}
```

### `PanelProfesional.jsx`
- Estado: `children: []`, `loading: true`
- Al montar: `panelApi.listChildren()` → setea `children`
- Muestra tarjetas: `avatar_emoji` + nombre + edad + última emoción (etiqueta con color del EmotionSelector) + total chats + total sesiones de calma
- Sin niños: `"Aún no hay niños registrados en la plataforma."`
- Click en tarjeta → `navigate('/panel/ninos/:childId')`
- Botón `← Volver` → `navigate('/dashboard')`
- Solo accesible con rol `specialist`

### `ChildDetail.jsx`
- Parámetro: `childId` de `useParams()`
- Al montar: `panelApi.getChild(childId)` → setea datos
- Encabezado: `avatar_emoji` + nombre + edad + `← Volver`
- **Tabs:** Emociones / Calma / Conversaciones
  - **Emociones:** lista cronológica — emoji de emoción + etiqueta + fecha formateada
  - **Calma:** lista — tipo de actividad (label legible: "Respirar" / "Pausa" / "Frase de Lumi") + duración en MM:SS + emoción al iniciar + fecha
  - **Conversaciones:** lista de conversaciones expandibles — al expandir, burbujas de mensajes: Lumi a la izquierda, niño a la derecha (mismo estilo visual que `ChatIA.jsx`)
- **Nota del especialista:** `<textarea>` con placeholder `"Escribí tus observaciones sobre este niño..."` + botón `"Guardar nota"` (`min-h-[44px]`) + texto de confirmación `"Nota guardada"` tras éxito
- Error en carga: mensaje de error, no bloquea

### `Dashboard.jsx` — cambio
La tarjeta "Panel Profesional" se muestra con `available: true, path: '/panel'` **solo si** `user?.role === 'specialist'`. Para roles `parent` y `admin`, la tarjeta permanece `available: false` o se omite del array.

---

## Restricciones globales (heredadas de Etapas 1–4)

- Todo texto visible al usuario: mínimo `text-base`
- Elementos interactivos: `min-h-[44px]`
- Colores: solo clases estáticas en Tailwind (sin concatenación dinámica)
- Idioma: solo español latinoamericano
- Sin lenguaje clínico, médico ni diagnóstico en ninguna etiqueta visible
- API keys: siempre en `.env`, nunca en código ni frontend

---

## Testing

### Backend (`pytest` + SQLite in-memory)
```
test_list_children_returns_child_profiles
test_list_children_parent_role_returns_403
test_list_children_unauthenticated_returns_401
test_get_child_detail_returns_emotions_calm_chats
test_get_child_detail_other_specialist_sees_same_child
test_get_child_detail_nonexistent_returns_404
test_save_note_creates_note
test_save_note_updates_existing_note
test_save_note_parent_role_returns_403
```

### Frontend (Vitest + Testing Library)
```
test: PanelProfesional muestra tarjetas de niños al cargar
test: PanelProfesional muestra mensaje si no hay niños
test: click en tarjeta navega a /panel/ninos/:id
test: ChildDetail muestra nombre y emoji del niño
test: ChildDetail muestra historial de emociones
test: ChildDetail muestra sesiones de calma
test: ChildDetail muestra conversaciones expandibles con mensajes
test: guardar nota llama a panelApi.saveNote con el contenido correcto
test: error en carga muestra mensaje de error
```
