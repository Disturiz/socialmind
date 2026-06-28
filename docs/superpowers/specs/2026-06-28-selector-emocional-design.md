# Diseño: Selector Emocional — Flujo Completo

**Fecha:** 2026-06-28  
**Proyecto:** SocialMind  
**Módulo:** Selector Emocional (`/emociones`)  
**Estado:** Aprobado

---

## Contexto

El `EmotionSelector.jsx` existe con funcionalidad base: muestra 5 emociones, registra la selección y navega a `/escenarios`. Esta spec extiende ese componente para completar el módulo con tres mejoras integradas:

1. Reacción personalizada de Lumi por emoción
2. Sugerencias de navegación múltiples según la emoción seleccionada
3. Manejo del caso "ya elegiste hoy" con opción de cambiar

No se modifica el backend ni se agregan nuevos archivos — todo el cambio ocurre dentro de `EmotionSelector.jsx`.

---

## Flujo de Fases

El componente maneja 4 fases via estado `phase`:

```
checking → (¿existe emoción hoy?)
  → sí → already_selected
  → no → selecting
              ↓ (niño elige)
           selected
```

| Fase | Descripción |
|------|-------------|
| `checking` | Carga inicial — `Promise.all([list, today])`. Muestra Lumi flotando + "Cargando..." |
| `already_selected` | Ya registró hoy. Muestra emoción del día + opciones: "Cambiar" o "Ir al inicio" |
| `selecting` | Grilla de 5 tarjetas de emoción (comportamiento actual, sin cambios visuales) |
| `selected` | Emoción elegida. Lumi reacciona + mensaje + 3 botones de destino |

---

## Estado Interno

```js
const [phase, setPhase]        = useState('checking')
const [todayEmotion, setToday] = useState(null)   // string | null
const [selected, setSelected]  = useState(null)   // string | null
const [emotions, setEmotions]  = useState([])     // EmotionOut[]
const [lumiState, setLumiState] = useState('idle')
const [error, setError]        = useState(null)
```

`loading` se elimina — reemplazado por `phase === 'checking'`.

---

## Configuración por Emoción (`EMOTION_CONFIG`)

Objeto estático dentro de `EmotionSelector.jsx`. Define por cada emoción:

| Campo | Descripción |
|-------|-------------|
| `lumiState` | Estado de Lumi post-selección (`'happy'` o `'encouraging'`) |
| `lumiMessage` | Mensaje de Lumi en fase `selected` |
| `alreadyMessage` | Mensaje en fase `already_selected` |
| `suggestions` | Array de 3 `{ label, path }` — el primero es la sugerencia principal |

### Mapeo de sugerencias por emoción

| Emoción | Sugerencia 1 | Sugerencia 2 | Sugerencia 3 |
|---------|-------------|-------------|-------------|
| `feliz` | 🤝 Escenarios | 🦉 Chat con Lumi | ⭐ Mi aventura |
| `nervioso` | 🧘 Zona de calma | 🦉 Chat con Lumi | 🤝 Escenarios |
| `confundido` | 🦉 Chat con Lumi | 🤝 Escenarios | 🧘 Zona de calma |
| `frustrado` | 🧘 Zona de calma | 🦉 Chat con Lumi | 🤝 Escenarios |
| `cansado` | 🧘 Zona de calma | 🦉 Chat con Lumi | ⭐ Mi aventura |

---

## Flujo de Datos

### Al montar
```js
useEffect(() => {
  Promise.all([emotionsApi.list(), emotionsApi.today()])
    .then(([listRes, todayRes]) => {
      setEmotions(listRes.data)
      if (todayRes.data.emotion_key) {
        setToday(todayRes.data.emotion_key)
        setPhase('already_selected')
      } else {
        setPhase('selecting')
      }
    })
}, [])
```

### Al seleccionar
```js
async function handleSelect(key) {
  if (selected) return
  setSelected(key)
  setError(null)
  try {
    await emotionsApi.log(key)
    setLumiState(EMOTION_CONFIG[key].lumiState)
    setPhase('selected')
  } catch {
    setError('Algo salió mal. Intenta de nuevo.')
    setSelected(null)
  }
}
```

### Al cambiar emoción (desde `already_selected`)
```js
function handleChange() {
  setToday(null)
  setPhase('selecting')
}
```

---

## Diseño Visual

### Fase `already_selected`
- Emoji de la emoción centrado (`text-7xl`)
- `LumiCharacter` con estado de la emoción guardada
- Mensaje `alreadyMessage` en burbuja (`bg-calm-surface rounded-2xl p-4`)
- Botón secundario: "Cambiar emoción" → `handleChange()`
- Botón primario: "Ir al inicio" → `navigate('/inicio')`

### Fase `selected`
- `LumiCharacter` con `lumiState` de la emoción elegida
- Mensaje `lumiMessage` en burbuja de texto
- 3 botones en columna, con animación escalonada Framer Motion:
  - Botón 0 (índice 0): variante `primary` — sugerencia principal
  - Botones 1 y 2: variante `secondary`
- Sin auto-navegación — el niño elige cuándo avanzar

### Animaciones (patrón existente)
```js
initial={{ opacity: 0, y: 16 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: i * 0.08 }}
```

### Reutilización
- `PageWrapper`, `LumiCharacter`, `Button`, `EMOTION_COLORS` sin cambios
- El estado `selected` en fase `already_selected` usa `EMOTION_CONFIG[todayEmotion]` para obtener el `lumiState` correcto

---

## Accesibilidad
- Botones de sugerencia con `aria-label` descriptivo
- Lumi con `role="img"` y `aria-label` (ya implementado)
- Colores y contraste respetan el diseño sensorial del proyecto

---

## Sin Cambios En
- Backend (endpoints `/emotions`, `/emotions/log`, `/emotions/today` cubren todo)
- `frontend/src/services/api.js`
- `frontend/src/router/index.jsx`
- Cualquier otro componente o página

---

## Tests a Actualizar

`EmotionSelector.test.jsx` requiere nuevos casos:
1. Muestra fase `already_selected` cuando `emotionsApi.today()` devuelve una emoción
2. Botón "Cambiar emoción" regresa a la grilla
3. Después de seleccionar, muestra 3 botones de sugerencia
4. Cada botón de sugerencia navega a la ruta correcta
5. Caso de error en `log` muestra mensaje y permite reintentar (test existente a preservar)
