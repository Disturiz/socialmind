# Diseño: Chat IA — Pantalla de Cierre y Typing Indicator Animado

**Fecha:** 2026-06-28
**Proyecto:** SocialMind
**Módulo:** Chat IA (`/chat`)
**Estado:** Aprobado

---

## Contexto

El Chat IA tiene un flujo completo con IA (Anthropic + tool use), opciones en grilla 2 columnas, entrada de texto libre y reconocimiento de voz. Dos aspectos de UX están incompletos:

1. **Fin de conversación abrupto** — cuando el backend devuelve `ended: true`, el código actual hace `setTimeout(() => navigate('/inicio'), 1500)` sin dar aviso al niño. El niño es teletransportado al inicio sin control ni despedida.
2. **Indicador de escritura plano** — "Lumi está escribiendo..." es texto estático sin animación, lo que se siente poco natural en un chat.

Esta spec agrega:
1. **Pantalla de cierre** — cuando `ended: true`, Lumi se despide con un mensaje fijo y un botón "Volver al inicio" que da al niño control sobre cuándo salir
2. **`TypingIndicator` animado** — tres puntos con animación Framer Motion reemplazan el texto plano

---

## Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/chat/TypingIndicator.jsx` | **Nuevo** — tres puntos animados |
| `frontend/src/pages/ChatIA.jsx` | **Modificar** — estado `ended`, pantalla de cierre, usar TypingIndicator |
| `frontend/src/test/TypingIndicator.test.jsx` | **Nuevo** — 2 tests |
| `frontend/src/test/ChatIA.test.jsx` | **Modificar** — 1 test ajustado, 2 tests nuevos |

**Sin cambios en:** backend, `api.js`, `router/index.jsx`, `ChatBubble.jsx`, `ChatOptions.jsx`

---

## Componente `TypingIndicator`

**Archivo:** `frontend/src/components/chat/TypingIndicator.jsx`

### Estructura visual

Tres puntos pulsantes alineados a la izquierda (igual que los mensajes de Lumi):

```
  ●  ●  ●
  (animado con stagger)
```

### Código completo

```jsx
import { motion } from 'framer-motion'

export function TypingIndicator() {
  return (
    <div
      aria-label="Lumi está escribiendo"
      className="
        bg-primary-50 border-2 border-primary-200
        rounded-3xl rounded-tl-sm px-5 py-4
        flex items-center gap-2
      "
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-primary-400 inline-block"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            repeat: Infinity,
            duration: 1.2,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
```

### Accesibilidad

- `aria-label="Lumi está escribiendo"` en el contenedor `div`
- Sin texto visible — el significado lo da el aria-label

---

## Cambios en `ChatIA.jsx`

### 1. Nuevo estado

Agregar después de los estados existentes:

```js
const [ended, setEnded] = useState(false)
```

### 2. Import de TypingIndicator

```js
import { TypingIndicator } from '../components/chat/TypingIndicator'
```

### 3. `handleSelect` — reemplazar lógica de ended

```js
// Antes
if (ended) {
  setTimeout(() => navigate('/inicio'), 1500)
} else {
  setOptions(newOpts)
}

// Después
if (endedFlag) {
  setEnded(true)
} else {
  setOptions(newOpts)
}
```

Nota: la variable local del destructuring se llama `ended` en el código actual (`const { message, options: newOpts, lumi_state, ended } = res.data`). El nuevo estado se llama también `ended` — para evitar conflicto de nombres, renombrar la variable local: `const { message, options: newOpts, lumi_state, ended: endedFlag } = res.data`.

### 4. Render block de pantalla de cierre

Insertar **antes del `return` principal** (después del bloque de error `if (error && messages.length === 0)`):

```jsx
if (ended) {
  return (
    <PageWrapper className="items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6 text-center"
      >
        <LumiCharacter state="happy" size={90} />
        <div className="bg-calm-surface rounded-3xl p-5">
          <p className="text-base text-text-primary">
            ¡Fue un gusto charlar contigo! Hasta la próxima. 🌟
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/inicio')}>
          Volver al inicio
        </Button>
      </motion.div>
    </PageWrapper>
  )
}
```

### 5. Reemplazar indicador de escritura plano

```jsx
// Antes
{sending && (
  <div className="flex justify-start">
    <div className="bg-primary-50 border-2 border-primary-200 rounded-3xl rounded-tl-sm px-5 py-4">
      <p className="text-base text-text-muted">Lumi está escribiendo...</p>
    </div>
  </div>
)}

// Después
{sending && (
  <div className="flex justify-start">
    <TypingIndicator />
  </div>
)}
```

---

## Tests

### `TypingIndicator.test.jsx` (nuevo — 2 tests)

```jsx
import { render, screen } from '@testing-library/react'
import { TypingIndicator } from '../components/chat/TypingIndicator'

describe('TypingIndicator', () => {
  it('tiene aria-label de accesibilidad', () => {
    render(<TypingIndicator />)
    expect(screen.getByLabelText('Lumi está escribiendo')).toBeInTheDocument()
  })

  it('muestra 3 puntos animados', () => {
    render(<TypingIndicator />)
    const container = screen.getByLabelText('Lumi está escribiendo')
    expect(container.querySelectorAll('span').length).toBe(3)
  })
})
```

### `ChatIA.test.jsx` (modificar)

**Test ajustado** — "al recibir ended:true navega a /inicio" → reemplazar con:

```jsx
it('al recibir ended:true muestra pantalla de cierre con botón para volver', async () => {
  chatApi.sendMessage.mockResolvedValueOnce({
    data: {
      message: '¡Hasta la próxima!',
      options: [],
      lumi_state: 'happy',
      ended: true,
    },
  })
  renderChat()
  await waitFor(() => screen.getByText('Terminar'))
  await userEvent.click(screen.getByText('Terminar'))
  await waitFor(() => {
    expect(
      screen.getByText('¡Fue un gusto charlar contigo! Hasta la próxima. 🌟')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /volver al inicio/i })
    ).toBeInTheDocument()
  })
})
```

**Nuevo test 1** — TypingIndicator aparece durante envío:

```jsx
it('muestra el indicador de escritura mientras Lumi responde', async () => {
  let resolveMessage
  chatApi.sendMessage.mockReturnValueOnce(
    new Promise((resolve) => { resolveMessage = resolve })
  )
  renderChat()
  await waitFor(() => screen.getByText('Sí, quiero hablar'))
  await userEvent.click(screen.getByText('Sí, quiero hablar'))
  await waitFor(() => {
    expect(screen.getByLabelText('Lumi está escribiendo')).toBeInTheDocument()
  })
  resolveMessage({
    data: { message: '¡Gracias!', options: ['Ok'], lumi_state: 'happy', ended: false },
  })
})
```

**Nuevo test 2** — botón de cierre navega:

```jsx
it('botón "Volver al inicio" en pantalla de cierre navega a /inicio', async () => {
  chatApi.sendMessage.mockResolvedValueOnce({
    data: { message: '¡Hasta!', options: [], lumi_state: 'happy', ended: true },
  })
  renderChat()
  await waitFor(() => screen.getByText('Terminar'))
  await userEvent.click(screen.getByText('Terminar'))
  await waitFor(() => screen.getByRole('button', { name: /volver al inicio/i }))
  await userEvent.click(screen.getByRole('button', { name: /volver al inicio/i }))
  expect(mockNavigate).toHaveBeenCalledWith('/inicio')
})
```

---

## Sin Cambios En

- Backend (endpoints existentes cubren todo)
- `frontend/src/services/api.js`
- `frontend/src/router/index.jsx`
- `ChatBubble.jsx`, `ChatOptions.jsx`
- Lógica de inicio de conversación, envío de mensajes, voz, error handling
