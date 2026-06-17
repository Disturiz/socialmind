# SocialMind Etapa 3 — Chat IA Guiado: Diseño y Especificación

**Fecha:** 2026-06-17  
**Autor:** Douglas Isturiz  
**Estado:** Aprobado

---

## Resumen

Integración de Claude (Anthropic) como motor conversacional de Lumi en el módulo "Chat con Lumi". El niño inicia una conversación temática conectada a la emoción que registró ese día. Lumi responde con burbujas de texto cortas y genera 3–4 botones de respuesta; el niño nunca escribe texto libre. Todo el historial persiste en PostgreSQL.

---

## Alcance de Etapa 3

**Incluido:**
- Tablas `chat_conversations` y `chat_messages` con migración Alembic
- 4 endpoints REST bajo `/api/v1/chat` (start, message, history, get)
- Integración Anthropic via tool_use (structured output) en el backend
- Página `ChatIA.jsx` con burbujas + botones de respuesta
- Componentes `ChatBubble.jsx` y `ChatOptions.jsx`
- Nueva tarjeta activa en Dashboard: "Chat con Lumi" → `/chat`
- Ruta protegida `/chat` en el router
- Tests backend (pytest, mock Anthropic) y frontend (Vitest)

**Excluido (Etapa 5):**
- Visibilidad del historial para padres o especialistas
- Panel de administración de conversaciones
- RAG sobre documentos de la Biblioteca educativa

---

## Modelo de datos

### `chat_conversations`
```sql
id           SERIAL PRIMARY KEY
user_id      INTEGER NOT NULL REFERENCES users(id)
emotion_key  VARCHAR(50) NOT NULL   -- emoción al iniciar (feliz, nervioso, etc.)
started_at   TIMESTAMP NOT NULL DEFAULT NOW()
ended_at     TIMESTAMP NULL         -- NULL = conversación activa
```

### `chat_messages`
```sql
id                SERIAL PRIMARY KEY
conversation_id   INTEGER NOT NULL REFERENCES chat_conversations(id)
role              VARCHAR(20) NOT NULL  -- 'assistant' | 'user'
content           TEXT NOT NULL
created_at        TIMESTAMP NOT NULL DEFAULT NOW()
```

**Índices:** `chat_messages(conversation_id, created_at)` para cargar historial eficientemente.

---

## API — Endpoints

Base: `POST/GET /api/v1/chat` — todos requieren JWT.

### `POST /api/v1/chat/start`

Crea una nueva conversación conectada a la emoción del día del usuario. Llama a Anthropic para generar el primer mensaje de bienvenida de Lumi.

**Request body:**
```json
{ "emotion_key": "nervioso" }
```

**Response 201:**
```json
{
  "conversation_id": 42,
  "message": "Hola, veo que hoy te sentiste nervioso. ¿Querés hablar de eso?",
  "options": ["Sí, me pone ansioso hablar en clase", "Me pasó algo hoy", "Solo quiero conversar", "Terminar"],
  "lumi_state": "happy"
}
```

### `POST /api/v1/chat/{conversation_id}/message`

Envía la selección del niño (texto de un botón). Guarda el mensaje en BD, llama a Anthropic con el historial del hilo, guarda la respuesta, devuelve la siguiente respuesta de Lumi.

**Errores:**
- `404` si la conversación no existe o no pertenece al usuario autenticado
- `409` si `ended_at` no es NULL (conversación ya cerrada)

**Request body:**
```json
{ "content": "Sí, me pone ansioso hablar en clase" }
```

**Response 200:**
```json
{
  "message": "Es normal sentirse así. Muchos chicos se ponen nerviosos al hablar frente a otros.",
  "options": ["¿Qué puedo hacer?", "Me pasa seguido", "Solo a veces", "Terminar"],
  "lumi_state": "encouraging",
  "ended": false
}
```

Cuando el niño elige "Terminar": `ended_at` se persiste en BD y la respuesta incluye `"ended": true`. El frontend navega a `/inicio`.

### `GET /api/v1/chat/history`

Devuelve las últimas 10 conversaciones del usuario (sin mensajes, solo metadata).

**Response 200:**
```json
[
  {
    "conversation_id": 42,
    "emotion_key": "nervioso",
    "started_at": "2026-06-17T14:30:00Z",
    "ended_at": "2026-06-17T14:45:00Z",
    "message_count": 8
  }
]
```

### `GET /api/v1/chat/{conversation_id}`

Devuelve todos los mensajes de una conversación.

**Response 200:**
```json
{
  "conversation_id": 42,
  "emotion_key": "nervioso",
  "messages": [
    { "role": "assistant", "content": "Hola...", "created_at": "..." },
    { "role": "user",      "content": "Sí, me pone ansioso...", "created_at": "..." }
  ]
}
```

---

## Integración Anthropic

### Modelo
`claude-haiku-4-5-20251001` — rápido y económico para conversación guiada en MVP.

### Structured output via tool_use

Se define una herramienta `respond_to_child` que fuerza respuesta estructurada:

```python
RESPOND_TOOL = {
    "name": "respond_to_child",
    "description": "Responde al niño con un mensaje y opciones de respuesta.",
    "input_schema": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "Mensaje de Lumi (máx. 3 oraciones cortas)"
            },
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 4,
                "description": "Opciones de respuesta para el niño. La última siempre es 'Terminar'."
            },
            "lumi_state": {
                "type": "string",
                "enum": ["happy", "thinking", "encouraging", "idle"],
                "description": "Estado visual de Lumi para esta respuesta."
            }
        },
        "required": ["message", "options", "lumi_state"]
    }
}
```

### System prompt

```
Eres Lumi, un búho amigable y paciente que acompaña a niños y adolescentes
(8-17 años) en su aprendizaje social y emocional.

PERSONALIDAD: cálida, calmada, alentadora. Nunca sarcástica, nunca clínica.

REGLAS:
- Responde siempre en español latinoamericano
- Frases cortas y simples (máximo 3 oraciones por mensaje)
- Jamás uses términos médicos, diagnósticos ni clínicos
- Mantén el tema relacionado a la emoción inicial o lo que el niño elija
- Si el niño expresa angustia severa o peligro, responde:
  "Eso suena muy importante. ¿Podés contarle a un adulto de confianza cómo te sentís?"
- La última opción de respuesta SIEMPRE es "Terminar"
- Usa la herramienta respond_to_child para cada respuesta

CONTEXTO DE HOY: El niño se siente {emotion_key}.
```

### Construcción del contexto por request

```python
messages = [
    {"role": msg.role, "content": msg.content}
    for msg in last_20_messages_of_conversation
]
# + el nuevo mensaje del usuario (ya guardado en BD antes de llamar a Anthropic)
```

### Límite de conversación
Máximo 30 mensajes por conversación (15 intercambios). Al alcanzar el límite, el backend fuerza `ended_at` y devuelve un mensaje de cierre de Lumi sin opciones adicionales (salvo "Terminar").

---

## Frontend

### Nuevos archivos
```
frontend/src/pages/ChatIA.jsx
frontend/src/components/chat/ChatBubble.jsx
frontend/src/components/chat/ChatOptions.jsx
frontend/src/test/ChatIA.test.jsx
```

### Modificados
```
frontend/src/services/api.js       — agregar chatApi
frontend/src/router/index.jsx      — agregar ruta /chat
frontend/src/pages/Dashboard.jsx   — agregar tarjeta "Chat con Lumi"
```

### `chatApi` en `api.js`
```js
export const chatApi = {
  start:       (emotion_key)         => api.post('/chat/start', { emotion_key }),
  sendMessage: (id, content)         => api.post(`/chat/${id}/message`, { content }),
  getHistory:  ()                    => api.get('/chat/history'),
  getConversation: (id)              => api.get(`/chat/${id}`),
}
```

### `ChatIA.jsx` — comportamiento
1. Al montar: llama `chatApi.start(emotion_key)`. La `emotion_key` viene del último `emotion_log` del usuario (nuevo endpoint `GET /api/v1/emotions/today` que devuelve la emoción más reciente del día, o `"feliz"` por defecto).
2. Muestra la respuesta inicial de Lumi como primera burbuja.
3. Al tocar un botón: agrega la selección como burbuja de usuario → muestra Lumi en estado `"thinking"` → llama `sendMessage` → agrega respuesta de Lumi → muestra nuevos botones.
4. Si `ended: true` en la respuesta → espera 1.5s → navega a `/inicio`.
5. Error de red: muestra `"Algo salió mal. ¿Intentamos de nuevo?"` + botón reintentar.

### `ChatBubble.jsx`
```jsx
// role: 'assistant' | 'user'
// Lumi: alineada izquierda, fondo primary-50, borde primary-200
// Usuario: alineada derecha, fondo secondary-50, borde secondary-200
// Animación: motion.div con fade+slide al montar
```

### `ChatOptions.jsx`
```jsx
// Grid de botones (2 columnas en mobile, hasta 4 botones)
// min-h-[44px] en cada botón
// Se deshabilitan mientras carga la respuesta
// Animación de entrada con stagger
```

### Estado de Lumi
| Situación | `lumi_state` |
|-----------|-------------|
| Cargando respuesta | `"thinking"` (local, no viene de API) |
| Saludo / respuesta positiva | `"happy"` |
| Niño expresa dificultad | `"encouraging"` |
| Cierre | `"happy"` |

### Nueva tarjeta en Dashboard
```js
{
  emoji: '🦉',
  title: 'Chat con Lumi',
  desc: 'Conversa sobre cómo te sentís',
  available: true,
  path: '/chat',
}
```

### Nueva ruta
```jsx
/chat → ProtectedRoute → ChatIA
```

---

## Nuevo endpoint auxiliar

### `GET /api/v1/emotions/today`
Devuelve la emoción más reciente registrada por el usuario en las últimas 24h.

**Response 200:**
```json
{ "emotion_key": "nervioso" }
```

**Response 200 (sin registro hoy):**
```json
{ "emotion_key": null }
```

El frontend usa `emotion_key ?? "feliz"` como fallback al llamar a `chat/start`.

---

## Seguridad

- `ANTHROPIC_API_KEY` solo en `.env` backend, nunca en frontend
- El niño nunca escribe texto libre — solo selecciona botones pre-generados por la IA (elimina prompt injection desde cliente)
- Las rutas `/chat/*` requieren JWT válido
- `GET /chat/{id}` verifica que la conversación pertenezca al `user_id` del token
- `POST /chat/{id}/message` retorna 409 si la conversación está cerrada

---

## Testing

### Backend (pytest + mock Anthropic)
```
test_chat_start_creates_conversation_and_returns_lumi_message
test_chat_start_uses_emotion_key_in_system_prompt
test_send_message_saves_both_messages_and_returns_response
test_send_message_on_closed_conversation_returns_409
test_send_message_on_other_users_conversation_returns_404
test_get_history_returns_last_10_conversations
test_get_conversation_returns_all_messages
test_emotions_today_returns_latest_emotion
test_emotions_today_returns_null_when_no_log_today
```

### Frontend (Vitest + Testing Library)
```
test: ChatIA renderiza primer mensaje de Lumi al montar
test: click en opción llama chatApi.sendMessage con el texto del botón
test: Lumi muestra estado "thinking" mientras carga
test: botones deshabilitados durante carga
test: respuesta con ended:true navega a /inicio
test: error de red muestra mensaje de reintento en español
```

---

## Restricciones globales (heredadas de Etapa 1–2)

- Todo texto visible al usuario: mínimo `text-base` (nunca `text-sm` ni menor)
- Elementos interactivos: `min-h-[44px]`
- Colores de emoción: solo clases estáticas en el código (Tailwind JIT)
- Idioma: solo español latinoamericano
- Sin lenguaje clínico, médico ni diagnóstico en ninguna parte visible
- API keys y secretos: siempre en `.env`, nunca en el código ni en el frontend
