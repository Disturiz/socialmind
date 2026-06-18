# SocialMind Etapa 6 — Biblioteca Educativa (RAG): Diseño y Especificación

**Fecha:** 2026-06-17
**Autor:** Douglas Isturiz
**Estado:** Aprobado

---

## Resumen

Biblioteca de documentos educativos (PDFs sobre autismo) que los especialistas pueden subir y gestionar. El contenido se procesa automáticamente (extracción de texto, chunking, embeddings OpenAI) y queda disponible para que Lumi lo consulte durante el chat mediante una herramienta `search_library` (tool use multi-turno). Lumi decide autónomamente cuándo buscar en la biblioteca según la conversación.

---

## Alcance de Etapa 6

**Incluido:**
- Modelos `documents` y `document_chunks` con migración Alembic
- Pipeline de procesamiento sincrónico: pdfplumber → chunking → OpenAI embeddings → almacenamiento
- 3 endpoints REST bajo `/api/v1/biblioteca` (upload, list, delete)
- Integración con chat: herramienta `search_library` + loop multi-turno en `chat_service.py`
- Página `Biblioteca.jsx` con upload, lista y eliminación de documentos
- Ruta protegida `/biblioteca` con `SpecialistRoute`
- Tarjeta Biblioteca en Dashboard para especialistas
- Tests backend (pytest + mock OpenAI) y frontend (Vitest)

**Excluido:**
- Búsqueda manual de la biblioteca por parte del especialista (solo Lumi busca)
- Preview/visualización del PDF en el navegador
- pgvector — se usa similitud coseno en Python con numpy (compatible con SQLite/tests; migración a pgvector trivial si la biblioteca crece)
- Soporte para formatos distintos de PDF

---

## Modelos de datos

### `documents` (nuevo)
```sql
id               SERIAL PRIMARY KEY
specialist_id    INTEGER NOT NULL REFERENCES users(id)
filename         VARCHAR(255) NOT NULL   -- UUID en disco, ej. "a1b2c3d4.pdf"
original_name    VARCHAR(255) NOT NULL   -- nombre que subió el especialista
file_size_bytes  INTEGER NOT NULL
status           VARCHAR(20) NOT NULL    -- 'processing' | 'ready' | 'failed'
chunk_count      INTEGER NOT NULL DEFAULT 0
created_at       TIMESTAMP NOT NULL DEFAULT NOW()
```

### `document_chunks` (nuevo)
```sql
id               SERIAL PRIMARY KEY
document_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE
chunk_index      INTEGER NOT NULL
content          TEXT NOT NULL
embedding        TEXT NOT NULL           -- JSON serializado: list[float] (1536 dims)
created_at       TIMESTAMP NOT NULL DEFAULT NOW()
```

**Nota de diseño:** Los embeddings se almacenan como JSON (`Text`) y la similitud coseno se calcula en Python con numpy. Esto evita la extensión `pgvector` y mantiene compatibilidad con SQLite en tests. El rendimiento es adecuado para una biblioteca de decenas a pocos cientos de documentos.

---

## API — Endpoints

Base: `/api/v1/biblioteca`. Upload y delete requieren `role == specialist` (403 si no). List requiere JWT válido.

### `POST /api/v1/biblioteca/upload`

Sube un PDF y lo procesa sincrónicamente.

**Request:** `multipart/form-data` con campo `file` (PDF, máx. 10 MB).

**Validaciones:**
- Tipo MIME debe ser `application/pdf`
- Tamaño máximo: 10 MB (10 485 760 bytes) → 413 si excede
- Solo `specialist` puede subir → 403 si otro rol

**Flujo:** guarda PDF en `/data/biblioteca/{uuid}.pdf` → crea `Document(status='processing')` → extrae texto con pdfplumber → divide en chunks → genera embeddings OpenAI → guarda `DocumentChunk` por cada chunk → actualiza `Document(status='ready', chunk_count=N)`.

Si pdfplumber falla o OpenAI falla: actualiza `Document(status='failed')` y retorna 500.

**Response 201:**
```json
{
  "id": 3,
  "original_name": "guia-autismo-grado1.pdf",
  "file_size_bytes": 204800,
  "status": "ready",
  "chunk_count": 12,
  "created_at": "2026-06-17T16:00:00Z"
}
```

---

### `GET /api/v1/biblioteca/documents`

Lista todos los documentos de la plataforma (cualquier especialista, no filtrado por uploader).

**Response 200:**
```json
[
  {
    "id": 3,
    "original_name": "guia-autismo-grado1.pdf",
    "file_size_bytes": 204800,
    "status": "ready",
    "chunk_count": 12,
    "created_at": "2026-06-17T16:00:00Z"
  }
]
```

---

### `DELETE /api/v1/biblioteca/documents/{doc_id}`

Elimina el documento, sus chunks y el archivo en disco.

**Acceso:** solo el especialista que subió el documento puede eliminarlo → 404 si no existe o es de otro especialista.

**Response 204** sin body.

---

## Pipeline de procesamiento

### Parámetros de chunking
- Tamaño de chunk: 500 tokens (~400 palabras)
- Overlap entre chunks: 50 tokens (~40 palabras)
- Separador: por párrafos (`\n\n`) primero; si el párrafo excede el límite, se divide por oraciones

### Embeddings
- Modelo: `text-embedding-3-small` (OpenAI)
- Dimensiones: 1536
- Cliente: singleton `openai_client = openai.OpenAI(api_key=settings.openai_api_key)` en `biblioteca_service.py`, patcheable en tests

### Búsqueda semántica
- Se embeds la query de Lumi con el mismo modelo
- Se calcula similitud coseno entre query embedding y todos los chunk embeddings en memoria
- Se retornan los top-3 chunks ordenados por similitud descendente
- Resultado formateado como string:
```
[Fragmento 1 de "guia-autismo-grado1.pdf"]:
<contenido del chunk>

[Fragmento 2 de "tecnicas-regulacion.pdf"]:
<contenido del chunk>
```

---

## Integración con chat (Lumi + tool use)

### Herramienta `SEARCH_TOOL`
```python
SEARCH_TOOL = {
    "name": "search_library",
    "description": (
        "Busca en la biblioteca educativa cuando el niño menciona algo "
        "sobre lo que querés agregar contexto de los documentos subidos "
        "por especialistas. Solo úsala cuando sea relevante para la conversación."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Texto de búsqueda semántica en la biblioteca"
            }
        },
        "required": ["query"]
    }
}
```

### Loop multi-turno en `_call_anthropic`

`tool_choice` cambia de `{"type": "tool", "name": "respond_to_child"}` a `{"type": "auto"}`.

```python
def _call_anthropic(emotion_key, db_messages, db):
    messages = _build_messages(emotion_key, db_messages)
    max_iterations = 3

    for _ in range(max_iterations):
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=SYSTEM_PROMPT_TEMPLATE.format(emotion_key=emotion_key),
            tools=[RESPOND_TOOL, SEARCH_TOOL],
            tool_choice={"type": "auto"},
            messages=messages,
        )

        search_use = next(
            (b for b in response.content if b.type == "tool_use" and b.name == "search_library"),
            None
        )
        respond_use = next(
            (b for b in response.content if b.type == "tool_use" and b.name == "respond_to_child"),
            None
        )

        if respond_use:
            return respond_use.input

        if search_use:
            results = biblioteca_service.search(db, search_use.input["query"], top_k=3)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": search_use.id,
                    "content": results,
                }]
            })
        else:
            break

    return FALLBACK_RESPONSE
```

`_call_anthropic` recibe `db` como parámetro nuevo (necesario para `biblioteca_service.search`). Todos los llamadores actuales (`start_conversation`, `send_message`) pasan `db`.

---

## Archivos backend

```
backend/app/models/document.py                          (nuevo)
backend/app/models/document_chunk.py                    (nuevo)
backend/alembic/versions/xxxx_add_biblioteca.py         (nuevo)
backend/app/schemas/biblioteca.py                       (nuevo)
backend/app/services/biblioteca_service.py              (nuevo)
backend/app/routers/biblioteca.py                       (nuevo)
backend/app/main.py                                     (modificado)
backend/app/models/__init__.py                          (modificado)
backend/app/services/chat_service.py                    (modificado)
backend/app/config.py                                   (modificado — agregar OPENAI_API_KEY)
backend/tests/test_biblioteca.py                        (nuevo)
backend/tests/test_chat.py                              (modificado — agregar 2 tests nuevos)
```

### Configuración
`backend/app/config.py` agrega:
```python
openai_api_key: str = ""
```
`.env` agrega: `OPENAI_API_KEY=sk-...`

### Almacenamiento en disco
PDFs se guardan en `/data/biblioteca/` dentro del contenedor. En `docker-compose.yml` (development):
```yaml
volumes:
  - ./data/biblioteca:/data/biblioteca
```

---

## Frontend — Archivos

```
frontend/src/pages/Biblioteca.jsx                       (nuevo)
frontend/src/test/Biblioteca.test.jsx                   (nuevo)
frontend/src/services/api.js                            (modificado — agregar bibliotecaApi)
frontend/src/router/index.jsx                           (modificado — ruta /biblioteca)
frontend/src/pages/Dashboard.jsx                        (modificado — segunda tarjeta especialista)
```

### `bibliotecaApi` en `api.js`
```js
export const bibliotecaApi = {
  upload: (formData) =>
    api.post('/biblioteca/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list:   ()      => api.get('/biblioteca/documents'),
  delete: (docId) => api.delete(`/biblioteca/documents/${docId}`),
}
```

### `Biblioteca.jsx` — comportamiento
- Al montar: `bibliotecaApi.list()` → muestra tarjetas de documentos
- Upload: `<input type="file" accept=".pdf">` + botón `"Subir documento"` · validación cliente: solo PDF y ≤ 10MB antes de llamar API · durante upload: botón deshabilitado + texto `"Subiendo..."` · al completar: recarga lista
- Tarjetas: nombre original, tamaño formateado (KB/MB), fecha, badge de estado (`ready` → verde / `processing` → amarillo / `failed` → rojo)
- Eliminar: botón `"Eliminar"` en cada tarjeta · al hacer click: pide confirmación inline con texto `"¿Eliminar este documento?"` + botones `"Sí, eliminar"` y `"Cancelar"` (sin `window.confirm`) · al confirmar: llama API y recarga lista
- Estado vacío: `"Aún no hay documentos en la biblioteca."`
- Error de upload: mensaje `text-base` bajo el formulario (no bloquea la pantalla)

### Dashboard — segunda tarjeta especialista
```jsx
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
```

Los `MODULE_CARDS` (para padres/niños) no incluyen estas tarjetas. El Dashboard muestra `[...MODULE_CARDS, ...SPECIALIST_CARDS]` solo si `user?.role === 'specialist'`.

---

## Restricciones globales (heredadas de Etapas 1–5)

- Todo texto visible al usuario: mínimo `text-base`
- Elementos interactivos: `min-h-[44px]`
- Colores: solo clases estáticas en Tailwind (sin concatenación dinámica)
- Idioma: solo español latinoamericano
- Sin lenguaje clínico, médico ni diagnóstico en ninguna etiqueta visible
- `OPENAI_API_KEY`: solo en `.env` backend, nunca en código ni frontend
- `ANTHROPIC_API_KEY`: solo en `.env` backend, nunca en código ni frontend

---

## Testing

### Backend (`pytest` + mock OpenAI + SQLite in-memory)
```
test_upload_document_creates_record_and_chunks
test_upload_document_non_pdf_returns_422
test_upload_document_too_large_returns_413
test_upload_document_parent_role_returns_403
test_list_documents_returns_all_documents
test_delete_document_removes_record_and_file
test_delete_document_other_specialist_returns_404
test_chat_search_library_injects_context
test_chat_no_search_needed_responds_directly
```

`openai_client` se parchea como singleton en `biblioteca_service.py`:
```python
openai_client = openai.OpenAI(api_key=settings.openai_api_key)
```
Patch en tests: `patch("app.services.biblioteca_service.openai_client", mock_openai)`

### Frontend (Vitest + Testing Library)
```
test: Biblioteca muestra lista de documentos al cargar
test: Biblioteca muestra mensaje si no hay documentos
test: subir archivo llama a bibliotecaApi.upload
test: eliminar documento llama a bibliotecaApi.delete con id correcto
test: error en upload muestra mensaje de error visible
```
