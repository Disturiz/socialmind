# Diseño: Zona de Calma — Pantalla de Completado + Check-in Emocional

**Fecha:** 2026-06-28  
**Proyecto:** SocialMind  
**Módulo:** Zona de Calma (`/calma`)  
**Estado:** Aprobado

---

## Contexto

La Zona de Calma tiene una base funcional con 3 actividades (respirar, pausar, frase de Lumi). Actualmente, al terminar una actividad el componente simplemente vuelve a la lista sin ninguna reacción. Esta spec agrega:

1. **Pantalla de completado** — Lumi felicita al niño al terminar una actividad
2. **Mini check-in emocional post-actividad** — el niño elige cómo se siente con las mismas 5 emociones del Selector Emocional
3. **Fix de consistencia** — botones de salir en actividades migran a componente `Button`

---

## Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/calma/PostActivityCheckin.jsx` | **Nuevo** — pantalla de completado + check-in |
| `frontend/src/pages/ZonaCalma.jsx` | **Modificar** — nuevo estado `completedActivity`, renderizado de check-in |
| `frontend/src/components/calma/BreathingExercise.jsx` | **Modificar** — botón "Salir" → `<Button variant="ghost">` |
| `frontend/src/components/calma/VisualTimer.jsx` | **Modificar** — botón "Salir antes" → `<Button variant="ghost">` |
| `frontend/src/components/calma/LumiPhrase.jsx` | **Modificar** — botón "Listo" → `<Button variant="primary">` |
| `frontend/src/test/ZonaCalma.test.jsx` | **Modificar** — agregar 3 tests del flujo de completado |
| `frontend/src/test/PostActivityCheckin.test.jsx` | **Nuevo** — 3 tests del componente |

**Sin cambios en:** backend, `api.js`, `router/index.jsx`, `LumiCharacter.jsx`, `PageWrapper.jsx`, `Button.jsx`

---

## Flujo de Fases en `ZonaCalma.jsx`

```
lista (activeActivity = null, completedActivity = null)
  ↓ usuario elige actividad
actividad activa (activeActivity = 'respirar' | 'pausa' | 'frase')
  ↓ onComplete(durationSeconds) es llamado
completado (completedActivity = { id, duration }, activeActivity = null)
  ↓ usuario elige emoción post-actividad
lista (completedActivity = null — vuelve al estado inicial)
```

---

## Nuevo Estado en `ZonaCalma.jsx`

```js
const [completedActivity, setCompletedActivity] = useState(null)
// null | { id: string, duration: number }
```

### `handleComplete` modificado

```js
async function handleComplete(durationSeconds) {
  if (activeActivity !== 'frase') {
    try {
      await calmApi.saveSession(activeActivity, durationSeconds, emotionKey)
    } catch {
      // pérdida silenciosa aceptable
    }
  }
  setCompletedActivity({ id: activeActivity, duration: durationSeconds })
  setActiveActivity(null)
}
```

### Nueva condición de render

Insertada entre el bloque de `activeActivity` y el return de la lista:

```jsx
if (completedActivity) {
  return (
    <PageWrapper className="items-center justify-center px-6 py-10">
      <PostActivityCheckin
        activityId={completedActivity.id}
        emotionsBefore={emotionKey}
        onDone={() => setCompletedActivity(null)}
      />
    </PageWrapper>
  )
}
```

---

## Componente `PostActivityCheckin`

**Archivo:** `frontend/src/components/calma/PostActivityCheckin.jsx`

### Props

```js
PostActivityCheckin({
  activityId,      // string — id de la actividad completada ('respirar' | 'pausa' | 'frase')
  emotionsBefore,  // string — emoción del día (no usada en render, disponible para extensión futura)
  onDone,          // () => void — callback al seleccionar emoción post-actividad
})
```

### Mensajes de felicitación

```js
const COMPLETION_MESSAGES = {
  respirar: '¡Muy bien! Terminaste de respirar 🌬️ ¿Cómo te sientes ahora?',
  pausa:    '¡Descansaste! ¿Cómo te sientes después de tu pausa? ⏸️',
  frase:    '¡Gracias por leer mi frase! ¿Cómo te sientes ahora? 🦉',
}
```

El mensaje se obtiene a partir del `id` de la actividad completada (pasado via prop `activityLabel` — que internamente en `ZonaCalma` se resuelve como `ACTIVITIES.find(a => a.id === completedActivity.id)?.label`). `PostActivityCheckin` recibe también el `id` implícitamente via la clave del mensaje — `ZonaCalma` pasa `activityLabel` como string display y el componente mapea: `'Respirar' → 'respirar'`, `'Pausar' → 'pausa'`, `'Frase de Lumi' → 'frase'` vía un objeto inverso interno. Si no hay match, fallback: `'¡Lo hiciste! ¿Cómo te sientes ahora?'`

**Simplificación:** Para evitar el mapeo inverso frágil, `ZonaCalma` pasa directamente el `id` de la actividad (`completedActivity.id`) como prop `activityId` en lugar de `activityLabel`. `PostActivityCheckin` usa `activityId` para buscar en `COMPLETION_MESSAGES` y `ACTIVITIES` para obtener el label display.

### Emociones

Las mismas 5 emociones hardcodeadas que `EmotionSelector`:

```js
const EMOTIONS = [
  { key: 'feliz',      label: 'Feliz',      emoji: '😊' },
  { key: 'nervioso',   label: 'Nervioso',   emoji: '😰' },
  { key: 'confundido', label: 'Confundido', emoji: '🤔' },
  { key: 'frustrado',  label: 'Frustrado',  emoji: '😤' },
  { key: 'cansado',    label: 'Cansado',    emoji: '😴' },
]
```

### Comportamiento al seleccionar emoción

```js
async function handleEmotionSelect(key) {
  try {
    await emotionsApi.log(key)
  } catch {
    // fire-and-forget — no bloquea al niño
  }
  onDone()
}
```

### Estructura visual

```
LumiCharacter state="happy" size={90}
Burbuja: bg-calm-surface rounded-2xl p-4 — mensaje de felicitación
Grilla 2×2 — 5 tarjetas de emoción (mismo estilo que EmotionSelector)
  - EMOTION_COLORS por emoción
  - emoji text-5xl + label font-bold
  - Animación Framer Motion escalonada (delay i * 0.08)
  - aria-label={emotion.label}
```

**Sin botón "Saltar"** — el check-in es parte natural del flujo.

---

## Fix de Botones en Actividades

| Componente | Botón actual | Cambio |
|-----------|-------------|--------|
| `BreathingExercise.jsx` | `<button>` crudo "Salir" | `<Button variant="ghost">` |
| `VisualTimer.jsx` | `<button>` crudo "Salir antes" | `<Button variant="ghost">` |
| `LumiPhrase.jsx` | `<button>` crudo "Listo" | `<Button variant="primary">` |

Agregar import de `Button` en cada archivo modificado.

---

## Colores (EMOTION_COLORS)

```js
const EMOTION_COLORS = {
  feliz:      'bg-primary-100 border-primary-500',
  nervioso:   'bg-primary-50 border-accent-yellow',
  confundido: 'bg-secondary-100 border-secondary-500',
  frustrado:  'bg-primary-50 border-accent-coral',
  cansado:    'bg-calm-bg border-calm-border',
}
```

Mismo objeto que en `EmotionSelector.jsx` — definido localmente en `PostActivityCheckin.jsx` (no compartido, para mantener cada archivo independiente).

---

## Accesibilidad

- Cards de emoción con `aria-label={emotion.label}`
- `LumiCharacter` con `role="img"` y `aria-label` (ya implementado)
- Todo el texto en español
- Botones `Button` respetan `min-h-[56px]` del componente

---

## Tests

### Agregar a `ZonaCalma.test.jsx` (importar `emotionsApi`)

1. Después de salir del timer, se muestra mensaje de Lumi con "¿Cómo te sientes ahora?"
2. En la pantalla de completado, se muestran las 5 emociones
3. Al seleccionar una emoción post-actividad, se llama `emotionsApi.log` y se vuelve a la lista de actividades

### Nuevo `PostActivityCheckin.test.jsx`

1. Muestra el mensaje de felicitación correcto para "Respirar"
2. Muestra las 5 emociones
3. Al hacer clic en una emoción, llama `onDone`

---

## Sin Cambios En

- Backend (endpoints existentes cubren todo)
- `frontend/src/services/api.js`
- `frontend/src/router/index.jsx`
- `LumiCharacter.jsx`, `PageWrapper.jsx`, `Button.jsx`
- Lógica interna de `BreathingExercise`, `VisualTimer`, `LumiPhrase` (solo el botón de salida cambia)
