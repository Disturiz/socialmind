# SocialMind — Aprendo Hábitos (Infografías de Comportamiento): Diseño y Especificación

**Fecha:** 2026-07-19
**Autor:** Douglas Isturiz
**Estado:** Aprobado

---

## Resumen

Módulo nuevo donde especialistas y administradores suben infografías (imagen o PDF de una página) sobre comportamientos y buenos hábitos, organizadas por categoría, para que niños y padres las consulten en una galería visual. Sigue el mismo patrón de subida de archivos que la Biblioteca educativa (Etapa 6), pero a diferencia de Biblioteca — donde el PDF nunca se muestra, solo se usa para RAG — aquí el archivo debe **verse** directamente, lo que requiere un endpoint nuevo de servido de archivos que Biblioteca no tiene.

Como parte de este trabajo se corrige también un problema de infraestructura descubierto durante el diseño: los archivos subidos (Biblioteca y ahora Aprendo Hábitos) no tienen volumen persistente en `docker-compose.prod.yml`, por lo que se perderían en el próximo `--build` del VPS.

---

## Alcance

**Incluido:**
- Modelo `habit_infographics` con migración Alembic
- 5 endpoints REST bajo `/api/v1/habitos` (upload, list, categorías, servir archivo, delete)
- Validación de tipo (imagen PNG/JPG/WebP o PDF), tamaño (máx. 10 MB) y firma de bytes
- Página `AprendoHabitos.jsx` — galería con filtro por categoría, visor de imagen en modal, PDF abre en pestaña nueva
- Página `GestionHabitos.jsx` — subida y eliminación (specialist/admin)
- Nuevo guard de ruta `SpecialistOrAdminRoute`
- Tarjetas en Dashboard: "Aprendo Hábitos" (todos los roles ven la galería) y "Gestionar Aprendo Hábitos" (specialist/admin)
- Volumen Docker persistente para `/data` (dev y prod), compartido con Biblioteca
- Tests backend (pytest) y verificación manual en navegador (frontend)

**Excluido (fuera de V1, YAGNI):**
- Favoritos o tracking de progreso de qué infografías vio el niño (decisión explícita del usuario: solo visualización simple)
- Tabla separada de categorías — se derivan de los valores ya usados en `habit_infographics.category`
- Visor de PDF embebido en la app — se abre con el visor nativo del navegador en pestaña nueva
- Edición de una infografía ya subida (para cambiarla, se elimina y se sube de nuevo)
- Paginación de la galería (volumen esperado bajo en V1; se agrega si hace falta)

---

## Modelo de datos

### `habit_infographics` (nuevo)
```sql
id               SERIAL PRIMARY KEY
uploaded_by      INTEGER NOT NULL REFERENCES users(id)
title            VARCHAR(120) NOT NULL
description      VARCHAR(500)              -- opcional
category         VARCHAR(60) NOT NULL
file_type        VARCHAR(10) NOT NULL      -- 'image' | 'pdf'
filename         VARCHAR(255) NOT NULL     -- nombre UUID en disco, ej. "a1b2c3d4.png"
original_name    VARCHAR(255) NOT NULL
mime_type        VARCHAR(100) NOT NULL
file_size_bytes  INTEGER NOT NULL
created_at       TIMESTAMP NOT NULL DEFAULT NOW()
```

**Nota de diseño:** `category` es texto libre, no una tabla aparte. El endpoint `GET /habitos/categorias` devuelve los valores distintos ya usados, y el formulario de subida ofrece ese dropdown más la opción de escribir una categoría nueva. Evita una entidad extra para algo que en V1 no necesita más que texto único.

---

## API — Endpoints

Base: `/api/v1/habitos`. Upload y delete requieren `role in (specialist, admin)` → 403 si no. List, categorías y servir archivo requieren solo JWT válido (cualquier rol).

### `POST /api/v1/habitos/upload`

**Request:** `multipart/form-data` — `file`, `title`, `category`, `description` (opcional).

**Validaciones:**
- `title`: 1–120 caracteres, requerido
- `category`: 1–60 caracteres, requerido
- Tipo MIME debe ser `image/png`, `image/jpeg`, `image/webp` o `application/pdf` → 422 si no
- Tamaño máximo: 10 MB → 413 si excede
- Firma de bytes: PDF debe empezar con `%PDF-`; imágenes se validan por sus magic bytes (PNG `\x89PNG`, JPEG `\xff\xd8\xff`, WebP `RIFF....WEBP`) → 422 si no coincide
- Solo `specialist` o `admin` puede subir → 403 si otro rol

**Flujo:** guarda archivo en `/data/habitos/{uuid}.{ext}` → crea `HabitInfographic` con los metadatos.

**Response 201:**
```json
{
  "id": 5,
  "title": "Cómo pedir ayuda",
  "description": "Pasos simples para pedir ayuda a un adulto",
  "category": "Pedir ayuda",
  "file_type": "image",
  "original_name": "pedir-ayuda.png",
  "file_size_bytes": 184320,
  "created_at": "2026-07-19T15:00:00Z"
}
```

---

### `GET /api/v1/habitos`

Lista todas las infografías. Filtro opcional `?category=Pedir%20ayuda`.

**Response 200:** lista de objetos igual al de arriba, ordenados por `created_at` descendente.

---

### `GET /api/v1/habitos/categorias`

**Response 200:**
```json
["Pedir ayuda", "Saludar", "Esperar turno"]
```
Valores distintos de `category` entre todas las infografías, ordenados alfabéticamente.

---

### `GET /api/v1/habitos/{id}/archivo`

Sirve el archivo binario con su `Content-Type` real (`image/png`, `image/jpeg`, `image/webp` o `application/pdf`), vía `FileResponse`. Requiere JWT válido (cualquier rol) → 404 si no existe.

---

### `DELETE /api/v1/habitos/{id}`

Elimina el registro y el archivo en disco.

**Acceso:** quien lo subió, o cualquier `admin` → 404 si no existe o si no es ni el uploader ni admin.

**Response 204** sin body.

---

## Archivos backend

```
backend/app/models/habit_infographic.py                 (nuevo)
backend/alembic/versions/xxxx_add_habit_infographics.py (nuevo)
backend/app/schemas/habitos.py                           (nuevo)
backend/app/services/habitos_service.py                  (nuevo)
backend/app/routers/habitos.py                            (nuevo)
backend/app/main.py                                       (modificado — registrar router)
backend/app/models/__init__.py                            (modificado)
backend/app/core/dependencies.py                          (modificado — agregar require_specialist_or_admin)
backend/tests/test_habitos.py                              (nuevo)
```

### `require_specialist_or_admin` en `dependencies.py`
```python
def require_specialist_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.specialist, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso solo para especialistas o administradores.",
        )
    return current_user
```

### Almacenamiento en disco
Igual patrón que `biblioteca_service.py`: `DATA_DIR = os.environ.get("HABITOS_DATA_DIR", "/data/habitos")`, nombre de archivo `f"{uuid.uuid4().hex}.{ext}"` preservando la extensión original según `mime_type`.

### Registro en `main.py`
```python
app.include_router(habitos.router, prefix="/api/v1/habitos", tags=["habitos"])
```

---

## Corrección de infraestructura: volumen persistente para `/data`

**Problema:** ni `docker-compose.yml` ni `docker-compose.prod.yml` tienen un volumen para `/data` dentro del contenedor `backend`. Hoy esto ya afecta a Biblioteca (los PDFs se pierden en cada rebuild) y afectaría igual a Aprendo Hábitos si no se corrige ahora.

**Cambio en ambos `docker-compose*.yml`, servicio `backend`:**
```yaml
    volumes:
      - uploads_data:/data
```
(en `docker-compose.yml` de desarrollo se agrega junto al bind mount `./backend:/app` ya existente)

**Y en la sección `volumes:` de nivel superior de ambos archivos:**
```yaml
volumes:
  postgres_data:
  uploads_data:
```

Esto hace que tanto `/data/biblioteca` como `/data/habitos` persistan entre despliegues. Se debe desplegar este cambio en el VPS igual que se hizo con `.env.prod` (correr `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build` tras el `git pull`).

---

## Frontend — Archivos

```
frontend/src/pages/AprendoHabitos.jsx                    (nuevo)
frontend/src/pages/GestionHabitos.jsx                     (nuevo)
frontend/src/services/api.js                              (modificado — agregar habitosApi)
frontend/src/router/index.jsx                              (modificado — rutas /habitos y /habitos/gestionar, guard nuevo)
frontend/src/pages/Dashboard.jsx                           (modificado — tarjetas nuevas)
```

### `habitosApi` en `api.js`
```js
export const habitosApi = {
  upload:      (formData) =>
    api.post('/habitos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list:        (category) => api.get('/habitos', { params: category ? { category } : {} }),
  categorias:  ()          => api.get('/habitos/categorias'),
  delete:      (id)        => api.delete(`/habitos/${id}`),
  getArchivo:  (id)        => api.get(`/habitos/${id}/archivo`, { responseType: 'blob' }),
}
```

**Nota de diseño — por qué no un `fileUrl` directo:** un `<img src="...">` no envía el header `Authorization`, así que un endpoint protegido por JWT nunca cargaría si se referencia por URL directa. En vez de exponer el endpoint sin autenticación (debilitaría el control de acceso ya que toda la app vive detrás de login), `getArchivo` pide el archivo con axios (que sí adjunta el JWT), y el componente arma la imagen con `URL.createObjectURL(blob)`, revocando el object URL al desmontar o reemplazar (`URL.revokeObjectURL`). Mismo mecanismo se usa para abrir el PDF en pestaña nueva: se pide el blob, se crea el object URL, y recién ahí `window.open(objectUrl)`.

### `AprendoHabitos.jsx` — comportamiento (`/habitos`, cualquier rol autenticado)
- Al montar: `habitosApi.categorias()` → pastillas de filtro (+ "Todas") · `habitosApi.list()` → grilla de tarjetas
- Cada tarjeta de tipo `image` pide su blob con `habitosApi.getArchivo(id)` al montar y muestra la miniatura vía object URL; se revoca al desmontar el componente
- Tarjetas tipo `pdf` muestran un ícono genérico de documento (no se pide el blob hasta que se abre, para no descargar PDFs completos solo para listar)
- Tap en una infografía tipo `image`: abre modal de pantalla completa reusando el mismo object URL ya cargado
- Tap en una infografía tipo `pdf`: pide el blob en ese momento, crea el object URL y llama `window.open(objectUrl)`
- Filtro por categoría: recarga la lista con `habitosApi.list(category)`
- Estado vacío: `"Aún no hay infografías disponibles."`

### `GestionHabitos.jsx` — comportamiento (`/habitos/gestionar`, specialist/admin)
- Formulario: input de archivo (`accept="image/png,image/jpeg,image/webp,.pdf"`), campo título, dropdown de categoría (poblado por `habitosApi.categorias()`) + opción "Otra..." que revela un input de texto, campo descripción opcional
- Validación cliente: tipo y tamaño (≤10MB) antes de llamar API, igual que `Biblioteca.jsx`
- Al completar: recarga lista y limpia formulario
- Lista debajo: miniatura (misma carga vía blob que en `AprendoHabitos.jsx`), título, categoría, tamaño, fecha, botón "Eliminar" con confirmación inline (mismo patrón que `Biblioteca.jsx`, sin `window.confirm`)

### Router — rutas nuevas
```jsx
{
  path: '/habitos',
  element: (
    <ProtectedRoute>
      <ParentOnboardingGuard><AprendoHabitos /></ParentOnboardingGuard>
    </ProtectedRoute>
  ),
},
{
  path: '/habitos/gestionar',
  element: <SpecialistOrAdminRoute><GestionHabitos /></SpecialistOrAdminRoute>,
},
```

### `SpecialistOrAdminRoute` (nuevo, junto a `SpecialistRoute`/`AdminRoute` en `router/index.jsx`)
```jsx
function SpecialistOrAdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) { /* mismo loading state que las otras guards */ }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'specialist' && user.role !== 'admin') return <Navigate to="/inicio" replace />
  return children
}
```

### Dashboard — tarjetas nuevas
En `MODULE_CARDS` (padres/niños):
```jsx
{
  emoji: '🌱',
  title: 'Aprendo Hábitos',
  desc: 'Infografías para practicar buenos hábitos',
  available: true,
  path: '/habitos',
},
```
En `SPECIALIST_CARDS` y `ADMIN_CARDS`, se agrega:
```jsx
{
  emoji: '🖼️',
  title: 'Gestionar Aprendo Hábitos',
  desc: 'Subir y administrar infografías',
  available: true,
  path: '/habitos/gestionar',
},
```
(Specialist y admin también ven la tarjeta `/habitos` de solo-lectura, igual que ven `/biblioteca/consultar` además de `/biblioteca`.)

---

## Restricciones globales (heredadas de etapas anteriores)

- Todo texto visible al usuario: mínimo `text-base`
- Elementos interactivos: `min-h-[44px]`
- Colores: solo clases estáticas en Tailwind (sin concatenación dinámica)
- Idioma: solo español latinoamericano
- Sin lenguaje clínico, médico ni diagnóstico en ninguna etiqueta visible
- Animaciones: usar `useReducedMotion()` de Framer Motion en cualquier `motion.*` nuevo (patrón ya establecido en `Welcome.jsx` y `LumiCharacter.jsx`)

---

## Testing

### Backend (`pytest`)
```
test_upload_infographic_creates_record
test_upload_infographic_invalid_type_returns_422
test_upload_infographic_too_large_returns_413
test_upload_infographic_bad_signature_returns_422
test_upload_infographic_parent_role_returns_403
test_upload_infographic_specialist_allowed
test_upload_infographic_admin_allowed
test_list_infographics_returns_all
test_list_infographics_filters_by_category
test_get_categorias_returns_distinct_sorted
test_get_archivo_returns_file_with_correct_content_type
test_get_archivo_requires_auth
test_delete_infographic_by_uploader_succeeds
test_delete_infographic_by_admin_succeeds
test_delete_infographic_by_other_specialist_returns_404
```

### Frontend
Verificación manual en navegador (galería, filtro, modal de imagen, apertura de PDF, formulario de subida con validaciones, eliminación) — igual enfoque que en los fixes de `Welcome.jsx`/`LumiCharacter.jsx` de esta semana, dado que jsdom no reproduce fielmente carga de imágenes/PDF ni el flujo de archivo real.

---

## Despliegue

1. Migración Alembic corre automáticamente en el arranque del contenedor `backend` (`alembic upgrade head` ya está en el `command:` de `docker-compose.prod.yml`)
2. El cambio de volumen `uploads_data` requiere `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build` en el VPS tras el `git pull` — mismo procedimiento ya usado para los fixes recientes
3. Sin variables de entorno nuevas requeridas (no usa IA ni servicios externos)
