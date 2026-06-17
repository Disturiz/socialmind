# SocialMind Etapa 4 — Zona de Calma: Diseño y Especificación

**Fecha:** 2026-06-17
**Autor:** Douglas Isturiz
**Estado:** Aprobado

---

## Resumen

Módulo "Zona de Calma" accesible desde el Dashboard. El niño elige entre tres actividades de regulación emocional: respiración guiada (4s inhalar / 4s exhalar), temporizador visual de pausa (3 minutos fijos), y frase calmante generada por Lumi según la emoción del día. Lumi sugiere una actividad al entrar, pero el niño puede elegir otra. Cada sesión se persiste en backend para uso futuro del Panel Profesional (Etapa 6).

---

## Alcance de Etapa 4

**Incluido:**
- Modelo `calm_sessions` con migración Alembic
- 2 endpoints REST bajo `/api/v1/calma` (guardar sesión, generar frase)
- Integración Anthropic para frase calmante (texto libre, sin tool_use)
- Página `ZonaCalma.jsx` con 3 tarjetas de actividad y sugerencia de Lumi
- Componentes `BreathingExercise.jsx`, `VisualTimer.jsx`, `LumiPhrase.jsx`
- Ruta protegida `/calma` en el router
- Tarjeta "Zona de calma" activada en Dashboard
- Tests backend (pytest, mock Anthropic) y frontend (Vitest)

**Excluido (Etapa 6):**
- Panel profesional que muestre historial de sesiones de calma
- Estadísticas de uso por actividad
- Sonidos o música de fondo

---

## Modelo de datos

### `calm_sessions`
```sql
id               SERIAL PRIMARY KEY
user_id          INTEGER NOT NULL REFERENCES users(id)
activity_type    VARCHAR(20) NOT NULL   -- 'respirar' | 'pausa' | 'frase'
duration_seconds INTEGER NOT NULL       -- segundos reales transcurridos
emotion_key      VARCHAR(50) NOT NULL   -- emoción del día al iniciar
created_at       TIMESTAMP NOT NULL DEFAULT NOW()
```

**Índice:** `calm_sessions(user_id, created_at)` para consultas del panel profesional.

---

## API — Endpoints

Base: `/api/v1/calma` — todos requieren JWT.

### `POST /api/v1/calma/session`

Guarda una sesión de actividad al completarla o salir antes.

**Request body:**
```json
{
  "activity_type": "respirar",
  "duration_seconds": 64,
  "emotion_key": "nervioso"
}
```

**Validaciones:**
- `activity_type` debe ser uno de `['respirar', 'pausa', 'frase']`
- `duration_seconds` debe ser ≥ 0
- `emotion_key` no puede ser vacío

**Response 201:**
```json
{
  "id": 7,
  "activity_type": "respirar",
  "duration_seconds": 64,
  "emotion_key": "nervioso",
  "created_at": "2026-06-17T15:00:00Z"
}
```

### `POST /api/v1/calma/phrase`

Genera una frase calmante personalizada usando Lumi (Anthropic).

**Request body:**
```json
{ "emotion_key": "nervioso" }
```

**Response 200:**
```json
{ "phrase": "Respirar despacio ayuda cuando todo parece mucho." }
```

**En caso de error Anthropic (timeout, falla):** devuelve frase de fallback hardcodeada:
```json
{ "phrase": "Estás bien. Respira. Todo va a estar bien." }
```

---

## Integración Anthropic

### Modelo
`claude-haiku-4-5-20251001` — respuesta rápida para frase breve.

### Llamada (texto libre, sin tool_use)
```python
response = anthropic_client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=60,
    system=(
        "Eres Lumi, un búho amigable y calmado. "
        "Genera UNA sola frase corta y calmante (máximo 15 palabras) "
        "para un niño de 8-17 años que se siente {emotion_key}. "
        "Solo la frase, sin comillas, sin saludo, en español latinoamericano."
    ),
    messages=[{"role": "user", "content": f"Me siento {emotion_key}."}],
)
phrase = response.content[0].text.strip()
```

Fallback si `response.content` está vacío o lanza excepción:
```python
phrase = "Estás bien. Respira. Todo va a estar bien."
```

---

## Lógica de sugerencia (frontend)

Sin llamada a IA — lógica estática en `ZonaCalma.jsx`:

```js
function getSuggestion(emotionKey) {
  if (['nervioso', 'frustrado', 'enojado'].includes(emotionKey)) return 'respirar'
  if (['cansado', 'confundido', 'triste'].includes(emotionKey)) return 'pausa'
  return 'frase'  // feliz, contento, otro
}
```

---

## Frontend

### Nuevos archivos
```
frontend/src/pages/ZonaCalma.jsx
frontend/src/components/calma/BreathingExercise.jsx
frontend/src/components/calma/VisualTimer.jsx
frontend/src/components/calma/LumiPhrase.jsx
frontend/src/test/ZonaCalma.test.jsx
```

### Modificados
```
frontend/src/services/api.js       — agregar calmApi
frontend/src/router/index.jsx      — agregar ruta /calma
frontend/src/pages/Dashboard.jsx   — activar tarjeta "Zona de calma" (available: true, path: '/calma')
```

### `calmApi` en `api.js`
```js
export const calmApi = {
  saveSession: (activity_type, duration_seconds, emotion_key) =>
    api.post('/calma/session', { activity_type, duration_seconds, emotion_key }),
  getPhrase: (emotion_key) =>
    api.post('/calma/phrase', { emotion_key }),
}
```

### `ZonaCalma.jsx` — comportamiento
1. Al montar: llama `GET /emotions/today` → obtiene `emotionKey` (fallback `'feliz'` si null)
2. Calcula `suggestion = getSuggestion(emotionKey)`
3. Muestra burbuja de Lumi: `"Hoy te sentiste [emoción]. Te sugiero [actividad]."` + 3 tarjetas
4. La tarjeta sugerida tiene borde resaltado (`border-primary-500`)
5. Al tocar una tarjeta: `setActiveActivity('respirar' | 'pausa' | 'frase')`
6. Componente activo ocupa el área principal; las tarjetas desaparecen
7. `handleComplete(durationSeconds)`: llama `calmApi.saveSession(activity, durationSeconds, emotionKey)` → `setActiveActivity(null)`
8. Error en `saveSession`: no bloquea al niño — registra en consola y vuelve al menú igualmente

**Estado:**
```js
const [activeActivity, setActiveActivity] = useState(null) // null | 'respirar' | 'pausa' | 'frase'
const [emotionKey, setEmotionKey]         = useState('feliz')
const [loading, setLoading]               = useState(true)
```

### `BreathingExercise.jsx`

**Props:** `{ emotionKey, onComplete }`

- Círculo SVG animado con Framer Motion: `scale 1.0 → 1.4` en 4s (inhalar), `scale 1.4 → 1.0` en 4s (exhalar)
- Texto central cambia entre `"Inhala..."` y `"Exhala..."` sincronizado con la animación
- 5 ciclos completos = 40 segundos → llama `onComplete(40)`
- Contador de ciclos: `"Ciclo 1 de 5"` en texto `text-base` fuera del círculo
- Botón `"Salir"` siempre visible → `onComplete(segundosTranscurridos)`
- Colores: fondo `calm-surface`, círculo `primary-200 → primary-400` según fase

### `VisualTimer.jsx`

**Props:** `{ onComplete }`

- Temporizador de 180 segundos (3 minutos)
- Círculo de progreso SVG: `stroke-dashoffset` decrece de 0% a 100% en 180s con `requestAnimationFrame` o `useInterval`
- Contador `MM:SS` en el centro (tamaño `text-4xl`)
- Al llegar a 0: `onComplete(180)`
- Botón `"Salir antes"` → `onComplete(segundosTranscurridos)`
- Frase estática debajo del círculo: `"Tómate este momento para vos."` (text-base)

### `LumiPhrase.jsx`

**Props:** `{ emotionKey, onComplete }`

- Al montar: llama `calmApi.getPhrase(emotionKey)`
- Estado `loading=true`: spinner + `"Lumi está pensando..."`
- Frase recibida: aparece con `motion.div` fade-in, `text-2xl font-semibold text-center`
- `LumiCharacter` visible en estado `happy`
- Botón `"Listo"` → `onComplete(0)`
- Error de red: muestra frase de fallback hardcodeada en frontend también: `"Estás bien. Respira. Todo va a estar bien."` — nunca bloquea al niño
- Sesión se guarda en el momento en que se muestra la frase (no espera "Listo"), `duration_seconds: 0`

---

## Restricciones globales (heredadas de Etapas 1–3)

- Todo texto visible al usuario: mínimo `text-base` (nunca `text-sm` ni menor)
- Elementos interactivos: `min-h-[44px]`
- Colores: solo clases estáticas en el código (Tailwind JIT — sin concatenación dinámica)
- Idioma: solo español latinoamericano
- Sin lenguaje clínico, médico ni diagnóstico en ninguna parte visible
- API keys: siempre en `.env`, nunca en código ni frontend
- Animaciones: suaves, sin flashes ni movimientos bruscos (principio de diseño sensorial)
- Modelo Anthropic: exactamente `claude-haiku-4-5-20251001`

---

## Testing

### Backend (`pytest` + mock Anthropic)
```
test_save_session_creates_record
test_save_session_invalid_activity_type_returns_422
test_save_session_unauthenticated_returns_401
test_get_phrase_returns_lumi_phrase
test_get_phrase_anthropic_failure_returns_fallback
test_get_phrase_unauthenticated_returns_401
```

### Frontend (Vitest + Testing Library)
```
test: ZonaCalma muestra 3 tarjetas de actividad al cargar
test: tarjeta sugerida tiene clase de borde resaltado
test: click en tarjeta muestra componente de actividad
test: al completar actividad llama a calmApi.saveSession
test: LumiPhrase llama a calmApi.getPhrase con emotion_key correcto
test: error en getPhrase muestra frase de fallback
```

---

## Archivos backend

```
backend/app/models/calm_session.py                         (nuevo)
backend/alembic/versions/xxxx_add_calm_sessions.py         (nuevo)
backend/app/schemas/calm.py                                (nuevo)
backend/app/services/calm_service.py                       (nuevo)
backend/app/routers/calm.py                                (nuevo)
backend/app/main.py                                        (modificado)
backend/app/models/__init__.py                             (modificado)
backend/tests/test_calm.py                                 (nuevo)
```
