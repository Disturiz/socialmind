# Spec: Chat con Documentos de la Biblioteca

**Fecha:** 2026-07-06  
**Estado:** Aprobado  
**Módulo:** Biblioteca Educativa  

---

## Objetivo

Permitir que padres y especialistas consulten los documentos de la biblioteca educativa mediante preguntas en lenguaje natural. El sistema busca fragmentos relevantes en los PDFs subidos y genera una respuesta adaptada al rol del usuario.

---

## Alcance

- Endpoint único: `POST /api/v1/biblioteca/ask`
- Dos experiencias de UI: una para padres (en `/inicio`) y una para especialistas (en `/panel`)
- Sin historial de conversación — cada consulta es independiente
- Sin tablas nuevas en la base de datos

---

## Backend

### Endpoint

```
POST /api/v1/biblioteca/ask
Authorization: Bearer <token>
Content-Type: application/json

{ "question": "¿Cómo puedo ayudar a mi hijo con las rutinas?" }
```

### Respuesta

```json
{
  "answer": "...",
  "sources": [
    { "doc_name": "Trastorno_espectro.pdf", "fragment": "Las rutinas predecibles ayudan a..." }
  ]
}
```

- `sources`: máximo 3 entradas, fragmento truncado a 150 caracteres
- Si no hay documentos o resultados relevantes, `sources` es array vacío

### Lógica

1. Autenticar usuario y leer su `role` desde el token JWT
2. Llamar `biblioteca_service.search(db, question, top_k=3)`
3. Si no hay resultados, responder con mensaje estándar sin llamar a Claude
4. Construir system prompt según rol:
   - **specialist:** tono técnico-clínico, terminología profesional, respuestas concisas
   - **parent:** tono cálido y simple, sin jerga médica, orientado a consejos prácticos
5. Llamar a `claude-haiku-4-5-20251001` con la pregunta y los fragmentos como contexto
6. Devolver `answer` + `sources`

### System prompts

**Especialista:**
```
Eres un asistente clínico especializado en trastornos del desarrollo. 
Responde con precisión técnica basándote en los fragmentos de documentos provistos.
Usa terminología profesional. Sé conciso. Si los fragmentos no contienen la respuesta,
indícalo claramente.
```

**Padre:**
```
Eres un asistente amable que ayuda a padres de niños con autismo.
Explica en lenguaje simple y cálido, sin términos médicos.
Basa tu respuesta en los fragmentos provistos. Da consejos prácticos cuando sea posible.
Si los fragmentos no contienen la respuesta, dilo con empatía.
```

### Errores

| Caso | Respuesta |
|------|-----------|
| Sin documentos en biblioteca | `{ "answer": "Aún no hay documentos en la biblioteca. Un especialista debe subir documentos primero.", "sources": [] }` |
| Sin fragmentos relevantes | Claude responde con `sources: []`, sin inventar fuentes |
| Error de API Claude | HTTP 503 con mensaje amigable |
| Pregunta vacía | HTTP 422 (validación Pydantic) |

---

## Frontend

### Especialista — Panel Profesional (`/panel`)

- Nueva pestaña **"Consultar Biblioteca"** junto a las existentes
- Contiene: campo de texto (placeholder: *"Escribe tu consulta clínica..."*), botón **Consultar**
- Respuesta muestra: texto de la respuesta + lista colapsable de fuentes con nombre del documento y fragmento

### Padre — Dashboard (`/inicio`)

- Nueva tarjeta **"Consultar Biblioteca Educativa"** en la pantalla de inicio
- Al hacer clic abre una vista simple con campo de pregunta y respuesta
- Estilo visual cálido, consistente con el diseño para padres
- Placeholder: *"¿Tienes alguna pregunta sobre el autismo?"*

### Respuesta con voz

Después de cada respuesta aparece un botón **"🔊 Escuchar respuesta"**. Al hacer clic:
- Lee en voz alta un resumen de la respuesta usando `window.speechSynthesis` (Web Speech API)
- Mientras habla, el botón cambia a **"⏹ Detener"**
- Al terminar, vuelve a **"🔊 Escuchar respuesta"**
- El idioma se fija en `es-419` (español latinoamericano)
- No requiere backend ni API externa

### Estados de UI

- **Cargando:** spinner mientras se espera respuesta
- **Sin documentos:** mensaje informativo, sin campo de consulta
- **Con respuesta:** texto de respuesta + fuentes (máx. 3, truncadas a 150 chars) + botón de voz
- **Error:** mensaje amigable genérico

---

## Archivos a crear/modificar

### Backend
- `backend/app/schemas/biblioteca.py` — agregar `BibliotecaAskRequest`, `BibliotecaAskResponse`, `SourceFragment`
- `backend/app/routers/biblioteca.py` — agregar endpoint `POST /ask`
- `backend/app/services/biblioteca_service.py` — agregar función `ask()`

### Frontend
- `frontend/src/pages/PanelProfesional.jsx` — agregar pestaña Consultar Biblioteca
- `frontend/src/pages/Dashboard.jsx` — agregar tarjeta Consultar Biblioteca Educativa
- `frontend/src/components/BibliotecaChat.jsx` — componente reutilizable de pregunta/respuesta

---

## Lo que queda fuera de este spec

- Historial de consultas (puede agregarse en iteración futura)
- Filtrar por documento específico
- Consultas desde el rol de niño
