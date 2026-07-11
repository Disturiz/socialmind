# Spec: Lumi Chat Adultos

**Fecha:** 2026-07-11  
**Estado:** Aprobado  
**Módulo:** Chat / Lumi

---

## Objetivo

Permitir que padres y especialistas conversen con Lumi en un chat multi-turno, con voz, que consulta automáticamente la Biblioteca como contexto y puede responder preguntas generales sobre el espectro autista. Completamente separado del chat para niños.

---

## Alcance

- Nuevos modelos `AdultConversation` y `AdultMessage`
- Nueva migración Alembic
- Servicio `lumi_chat_service.py` con RAG automático y prompts por rol
- 3 endpoints bajo `/api/v1/lumi-chat/`
- Página `/lumi-chat` — campo de texto + botón micrófono + TTS por respuesta
- Accesible a ambos roles (`parent` y `specialist`)
- Puntos de entrada: tarjeta en Dashboard + botón en Panel Profesional

---

## Backend

### Modelos

```python
# backend/app/models/adult_conversation.py
class AdultConversation(Base):
    __tablename__ = "adult_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    messages: Mapped[list["AdultMessage"]] = relationship("AdultMessage", back_populates="conversation", order_by="AdultMessage.created_at")
```

```python
# backend/app/models/adult_message.py
class AdultMessage(Base):
    __tablename__ = "adult_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(Integer, ForeignKey("adult_conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)   # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    conversation: Mapped["AdultConversation"] = relationship("AdultConversation", back_populates="messages")

    __table_args__ = (
        Index("ix_adult_messages_conv_created", "conversation_id", "created_at"),
    )
```

### Migración Alembic

- `revision = 'd9e0f1a2b3c4'`
- `down_revision = 'c8d9e0f1a2b3'`
- Crea las tablas `adult_conversations` y `adult_messages` con sus FK e índices

### Endpoints

**Router:** `backend/app/routers/lumi_chat.py`  
**Prefijo:** `/api/v1/lumi-chat`  
**Auth:** `get_current_user` (ambos roles — no `require_parent` / `require_specialist`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/conversations` | Crea nueva conversación. Retorna `{id, started_at}` (201) |
| `POST` | `/conversations/{conv_id}/messages` | Envía mensaje, retorna respuesta de Lumi |
| `GET`  | `/conversations/{conv_id}` | Devuelve conversación completa con mensajes |

**Seguridad:** Cada endpoint verifica que `conv_id` pertenezca al `current_user.id`. Retorna 404 si no.

**POST `/conversations/{conv_id}/messages`:**
- Body: `{ "content": "..." }` (1-2000 chars)
- Flujo:
  1. Guarda el mensaje del usuario (`role="user"`)
  2. RAG: llama `biblioteca_service.search(db, content, top_k=3)` → contexto textual
  3. Construye historial: todas las `AdultMessage` de la conversación (excepto el recién guardado ya incluido)
  4. Llama a Claude con system prompt por rol + contexto de biblioteca + historial
  5. Guarda la respuesta de Lumi (`role="assistant"`)
  6. Retorna `{ "id": int, "content": str, "created_at": datetime }`

### Schemas

```python
# backend/app/schemas/lumi_chat.py

class ConversationOut(BaseModel):
    id: int
    started_at: datetime
    model_config = {"from_attributes": True}

class MessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}

class ConversationDetailOut(BaseModel):
    id: int
    started_at: datetime
    messages: list[MessageOut]
    model_config = {"from_attributes": True}
```

### Servicio

**`backend/app/services/lumi_chat_service.py`**

System prompts:

```python
SYSTEM_SPECIALIST = (
    "Eres Lumi, un asistente clínico especializado en autismo y desarrollo infantil. "
    "Conversas con especialistas ofreciendo orientación basada en evidencia. "
    "Cuando dispongas de fragmentos de documentos relevantes, úsalos para fundamentar tus respuestas. "
    "Si no hay fragmentos aplicables, responde desde tu conocimiento general del espectro autista. "
    "Usa terminología profesional. Sé preciso y conciso."
)

SYSTEM_PARENT = (
    "Eres Lumi, un búho amigable y comprensivo que acompaña a padres de niños con autismo. "
    "Ofreces orientación cálida, práctica y sin tecnicismos. "
    "Cuando dispongas de fragmentos de documentos relevantes, úsalos para fundamentar tus respuestas. "
    "Si no hay fragmentos aplicables, responde desde tu conocimiento general del espectro autista. "
    "Habla siempre con empatía y esperanza."
)
```

Funciones:
- `create_conversation(db, user_id) -> AdultConversation`
- `get_conversation(db, conv_id, user_id) -> AdultConversation` — 404 si no existe o no pertenece al usuario
- `send_message(db, conv_id, user_id, content, role) -> AdultMessage` — flujo completo descrito arriba
  - Model: `claude-haiku-4-5-20251001`, `max_tokens=1024`
  - Si Claude lanza excepción → HTTP 503

---

## Frontend

### Página nueva

**`frontend/src/pages/LumiChatAdultosPage.jsx`**

Ruta: `/lumi-chat`  
Accesible para `parent` y `specialist` (ProtectedRoute genérico).

Comportamiento:
- Al montar: llama `POST /lumi-chat/conversations` → obtiene `conversationId`
- Muestra historial de mensajes en burbujas (usuario a la derecha, Lumi a la izquierda)
- Campo de texto (multilinea) + botón micrófono + botón enviar
- Cada respuesta de Lumi tiene botón TTS (🔊 / ⏹), misma lógica que `BibliotecaChat`
- Estado de carga mientras Lumi responde: botón deshabilitado + texto "Lumi está pensando..."
- Errores de API: mensaje rojo inline, no bloquea el chat

**Campo de texto + micrófono (Web Speech API):**
```jsx
// SpeechRecognition — rellenar el campo con lo que el usuario dice
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
recognition.lang = 'es-419'
recognition.interimResults = false
recognition.onresult = (e) => setInput(e.results[0][0].transcript)
```
- Botón micrófono: 🎤 mientras inactivo, 🔴 mientras escucha
- Si el navegador no soporta SpeechRecognition → botón micrófono oculto (feature detect)

### API client

```js
// frontend/src/services/api.js — agregar:
export const lumiChatApi = {
  createConversation: () => api.post('/lumi-chat/conversations'),
  sendMessage: (convId, content) =>
    api.post(`/lumi-chat/conversations/${convId}/messages`, { content }),
  getConversation: (convId) => api.get(`/lumi-chat/conversations/${convId}`),
}
```

### Puntos de entrada

**Dashboard (`frontend/src/pages/Dashboard.jsx`):**
- `MODULE_CARDS` (padres): agregar tarjeta `{ emoji: '🦉', title: 'Chat con Lumi', desc: 'Habla con Lumi sobre el autismo', path: '/lumi-chat' }`  
  *(La tarjeta existente `Chat con Lumi` va a `/chat` — la del niño. Esta nueva es exclusiva para adultos.)*
- `SPECIALIST_CARDS`: agregar tarjeta `{ emoji: '🦉', title: 'Chat con Lumi', desc: 'Consultas sobre el espectro autista', path: '/lumi-chat' }`

**Panel Profesional (`frontend/src/pages/PanelProfesional.jsx`):**
- Botón en la sección de accesos rápidos (junto al botón existente de Biblioteca): `🦉 Chat con Lumi` → navega a `/lumi-chat`

### Router

**`frontend/src/router/index.jsx`:**
- Agregar: `/lumi-chat` → `<LumiChatAdultosPage />` dentro de `ProtectedRoute`

---

## Voz

| Función | Tecnología | Notas |
|---------|-----------|-------|
| Entrada por voz | Web Speech API (`SpeechRecognition`) | Rellenar campo de texto; no envía automáticamente |
| TTS | Web Speech API (`SpeechSynthesis`) | Un botón por respuesta de Lumi; cancelar al enviar nuevo mensaje |

Ambas funciones son progresivas — si el navegador no las soporta, el chat funciona en modo solo texto.

---

## Errores

| Caso | Respuesta |
|------|-----------|
| `conv_id` no pertenece al usuario | 404 Not Found |
| Claude no disponible | 503 Service Unavailable |
| `content` vacío o > 2000 chars | 422 Unprocessable Entity |
| Usuario no autenticado | 401 Unauthorized |

---

## Lo que queda fuera de este spec

- Historial de conversaciones anteriores (listar conversaciones pasadas)
- Búsqueda semántica real (embeddings) — se usa el mismo keyword search de la Biblioteca
- Límite de mensajes por conversación
