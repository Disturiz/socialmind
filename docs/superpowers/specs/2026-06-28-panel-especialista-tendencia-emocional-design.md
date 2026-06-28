# Diseño: Panel del Especialista — Tendencia Emocional y Polish de Emojis

**Fecha:** 2026-06-28
**Proyecto:** SocialMind
**Módulo:** Panel del Especialista (`/panel`, `/panel/ninos/:id`)
**Estado:** Aprobado

---

## Contexto

El Panel del Especialista tiene una base funcional: lista de niños (`PanelProfesional.jsx`) y detalle por niño (`ChildDetail.jsx`) con tabs de Emociones, Calma, Conversaciones, nota del especialista y progreso de gamificación. Lo que falta es comprensión de patrones: el especialista ve listas de datos pero no puede detectar tendencias rápido.

Esta spec agrega:

1. **Gráfico de distribución emocional** — barras horizontales CSS + Framer Motion mostrando cuántas veces apareció cada emoción en los últimos 7 días, fijo encima de los tabs en `ChildDetail`
2. **Polish de emojis** — reemplazar claves crudas ("nervioso") por emoji + label ("😰 Nervioso") en el tab Emociones de `ChildDetail` y en las tarjetas de `PanelProfesional`

Sin cambios en backend ni en `api.js`.

---

## Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/panel/EmotionDistributionChart.jsx` | **Nuevo** — gráfico de distribución |
| `frontend/src/pages/ChildDetail.jsx` | **Modificar** — agregar chart, polish emojis en tab |
| `frontend/src/pages/PanelProfesional.jsx` | **Modificar** — polish `last_emotion_key` |
| `frontend/src/test/EmotionDistributionChart.test.jsx` | **Nuevo** — 4 tests |
| `frontend/src/test/ChildDetail.test.jsx` | **Modificar** — 2 tests nuevos, 1 test ajustado |
| `frontend/src/test/PanelProfesional.test.jsx` | **Modificar** — 1 test nuevo |

**Sin cambios en:** backend, `api.js`, `router/index.jsx`, `LumiCharacter.jsx`, `PageWrapper.jsx`, `Button.jsx`

---

## Componente `EmotionDistributionChart`

**Archivo:** `frontend/src/components/panel/EmotionDistributionChart.jsx`

### Props

```js
EmotionDistributionChart({
  emotions,  // { emotion_key: string, logged_at: string }[] — mismo array de child.emotions
})
```

### Metadatos de emociones (export nombrado)

```js
export const EMOTION_META = {
  feliz:      { emoji: '😊', label: 'Feliz',      bar: 'bg-primary-500'   },
  nervioso:   { emoji: '😰', label: 'Nervioso',   bar: 'bg-accent-yellow' },
  confundido: { emoji: '🤔', label: 'Confundido', bar: 'bg-secondary-500' },
  frustrado:  { emoji: '😤', label: 'Frustrado',  bar: 'bg-accent-coral'  },
  cansado:    { emoji: '😴', label: 'Cansado',    bar: 'bg-calm-border'   },
}
```

Este objeto se exporta como named export para ser reutilizado en `ChildDetail` y `PanelProfesional` sin duplicación.

### Lógica de cálculo

```js
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const counts = emotions
  .filter(e => new Date(e.logged_at) >= cutoff)
  .reduce((acc, e) => {
    acc[e.emotion_key] = (acc[e.emotion_key] ?? 0) + 1
    return acc
  }, {})
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
const maxCount = sorted[0]?.[1] ?? 1
```

- Solo emociones con `logged_at >= ahora - 7 días`
- Ordenadas de mayor a menor frecuencia
- `maxCount` es el denominador para calcular el ancho de cada barra en porcentaje

### Estructura visual

```
┌─────────────────────────────────────┐
│  Emociones esta semana              │
│                                     │
│  😰 Nervioso  ████████████  4       │
│  😊 Feliz     ██████        2       │
│  😴 Cansado   ███           1       │
│                                     │
│  (vacío si no hay datos)            │
└─────────────────────────────────────┘
```

- Contenedor: `bg-calm-surface rounded-3xl p-5 flex flex-col gap-3`
- Título: `text-base font-bold text-text-primary` → "Emociones esta semana"
- Por cada entrada en `sorted`:
  - Fila: `flex items-center gap-3`
  - Emoji + label: `w-28 text-base text-text-primary flex-shrink-0`
  - Track de barra: `flex-1 bg-calm-bg rounded-full h-3 overflow-hidden`
  - Barra animada (Framer Motion): `h-full rounded-full {EMOTION_META[key].bar}`
    - `initial={{ width: 0 }}`
    - `animate={{ width: \`${(count / maxCount) * 100}%\` }}`
    - `transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}`
  - Conteo: `text-base font-bold text-text-primary w-6 text-right`
- Estado vacío (`sorted.length === 0`):
  ```jsx
  <p className="text-base text-text-secondary text-center py-2">
    Sin emociones registradas esta semana.
  </p>
  ```

### Accesibilidad

- `role="img"` en el contenedor del gráfico con `aria-label="Distribución de emociones de la última semana"`
- Cada fila de barra tiene `aria-label={\`${label}: ${count} veces\`}`

---

## Integración en `ChildDetail.jsx`

### Import

```js
import { EmotionDistributionChart, EMOTION_META } from '../components/panel/EmotionDistributionChart'
```

### Posición del chart

Insertar entre el encabezado del niño y los tabs:

```jsx
{/* Encabezado */}
<div className="flex items-center gap-4">...</div>

{/* NUEVO */}
<EmotionDistributionChart emotions={child.emotions} />

{/* Tabs */}
<div className="flex gap-2 border-b border-calm-border">...</div>
```

### Polish en el tab Emociones

Reemplazar la key cruda por emoji + label:

```jsx
// Antes
<p className="text-base font-bold text-text-primary">{e.emotion_key}</p>

// Después
<p className="text-base font-bold text-text-primary">
  {EMOTION_META[e.emotion_key]?.emoji ?? ''}{' '}
  {EMOTION_META[e.emotion_key]?.label ?? e.emotion_key}
</p>
```

---

## Polish en `PanelProfesional.jsx`

### Import

```js
import { EMOTION_META } from '../components/panel/EmotionDistributionChart'
```

### Tarjeta de niño

Reemplazar la key cruda por emoji + label:

```jsx
// Antes
{child.last_emotion_key && (
  <p className="text-base text-text-secondary">
    Hoy: {child.last_emotion_key}
  </p>
)}

// Después
{child.last_emotion_key && (
  <p className="text-base text-text-secondary">
    Hoy: {EMOTION_META[child.last_emotion_key]?.emoji ?? ''}{' '}
    {EMOTION_META[child.last_emotion_key]?.label ?? child.last_emotion_key}
  </p>
)}
```

---

## Tests

### `EmotionDistributionChart.test.jsx` (nuevo — 4 tests)

Mock de fecha: `vi.setSystemTime(new Date('2026-06-28T12:00:00Z'))` en `beforeEach`, restaurar en `afterEach`.

Datos de prueba:
```js
const emotions = [
  { emotion_key: 'nervioso', logged_at: '2026-06-27T10:00:00Z' }, // dentro
  { emotion_key: 'nervioso', logged_at: '2026-06-26T10:00:00Z' }, // dentro
  { emotion_key: 'feliz',    logged_at: '2026-06-25T10:00:00Z' }, // dentro
  { emotion_key: 'cansado',  logged_at: '2026-06-10T10:00:00Z' }, // fuera (>7 días)
]
```

1. **Muestra emociones de los últimos 7 días ordenadas por frecuencia** — "Nervioso" aparece antes que "Feliz"
2. **No muestra emociones fuera de los 7 días** — "Cansado" no aparece
3. **Muestra estado vacío si no hay emociones esta semana** — `emotions=[]` → texto "Sin emociones registradas esta semana."
4. **Las emociones aparecen ordenadas por frecuencia** — verificar con `screen.getAllByLabelText(/veces/i)`: el primer elemento tiene accessible name que incluye "Nervioso" y el segundo incluye "Feliz". No verificar `style.width` — Framer Motion no ejecuta animaciones en JSDOM.

### `ChildDetail.test.jsx` (modificar — 2 tests nuevos, 1 ajustado)

**Nuevos:**

5. **Muestra el gráfico de tendencia encima de los tabs** — `screen.getByRole('img', { name: /distribución/i })` está en el DOM antes de los tabs
6. **Tab Emociones muestra emoji + label** — después de hacer click en "Emociones", pantalla muestra "😰 Nervioso" (no la clave cruda "nervioso")

**Ajustado:**

- Test existente "muestra historial de emociones" busca `screen.getByText('nervioso')` → cambiar a `screen.getByText(/nervioso/i)` para que sea compatible con "😰 Nervioso"

### `PanelProfesional.test.jsx` (modificar — 1 test nuevo)

7. **Tarjeta muestra emoji + label para last_emotion_key** — `screen.getByText(/😰.*Nervioso/i)` está en el DOM (el mock tiene `last_emotion_key: 'nervioso'`)

---

## Sin Cambios En

- Backend (datos ya disponibles en `GET /panel/children/:id`)
- `frontend/src/services/api.js`
- `frontend/src/router/index.jsx`
- Lógica interna de `ChildDetail` (solo render)
- Lógica interna de `PanelProfesional` (solo render)
