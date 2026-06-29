# Chat IA — Pantalla de Cierre y TypingIndicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la auto-navegación abrupta al terminar el chat por una pantalla de despedida de Lumi, y el texto plano "Lumi está escribiendo..." por tres puntos animados con Framer Motion.

**Architecture:** Un nuevo componente `TypingIndicator` encapsula los tres puntos animados. `ChatIA.jsx` agrega el estado `ended` (booleano) para controlar la pantalla de cierre, y reemplaza el `setTimeout`/navigate por `setEnded(true)`. Ambos cambios son puramente de presentación — sin cambios en backend ni en `api.js`.

**Tech Stack:** React 18, Framer Motion (ya instalado), Tailwind CSS, Vitest + @testing-library/react

## Global Constraints

- Sin cambios en backend, `api.js`, `router/index.jsx`, `ChatBubble.jsx`, `ChatOptions.jsx`
- Texto exacto de despedida: `"¡Fue un gusto charlar contigo! Hasta la próxima. 🌟"`
- Texto exacto del botón: `"Volver al inicio"`
- `aria-label` exacto del TypingIndicator: `"Lumi está escribiendo"`
- Framer Motion en TypingIndicator: `animate={{ opacity: [0.2, 1, 0.2] }}`, `transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2, ease: 'easeInOut' }}`
- Framer Motion en pantalla de cierre: `initial={{ opacity: 0, scale: 0.8 }}`, `animate={{ opacity: 1, scale: 1 }}`, `transition={{ duration: 0.4 }}`
- Pantalla de cierre: `PageWrapper className="items-center justify-center px-6 py-10"`, `LumiCharacter state="happy" size={90}`
- Variable local del destructuring renombrada: `ended: endedFlag` para evitar conflicto con el estado `ended`
- Comando de tests: `cd frontend && npm test -- --run` (debe pasar 100%)

---

### Task 1: Componente TypingIndicator

**Files:**
- Create: `frontend/src/components/chat/TypingIndicator.jsx`
- Create: `frontend/src/test/TypingIndicator.test.jsx`

**Interfaces:**
- Consumes: nada de tareas anteriores
- Produces:
  - `export function TypingIndicator()` — sin props, importado en Task 2 como `import { TypingIndicator } from '../components/chat/TypingIndicator'`

- [ ] **Step 1: Crear el archivo de test**

Crear `frontend/src/test/TypingIndicator.test.jsx` con el siguiente contenido completo:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
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

- [ ] **Step 2: Verificar que el test falla**

```bash
cd frontend && npm test -- --run src/test/TypingIndicator.test.jsx
```

Expected: FAIL con `Cannot find module '../components/chat/TypingIndicator'`

- [ ] **Step 3: Crear el componente**

Crear `frontend/src/components/chat/TypingIndicator.jsx` con el siguiente contenido completo:

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

- [ ] **Step 4: Verificar que los 2 tests pasan**

```bash
cd frontend && npm test -- --run src/test/TypingIndicator.test.jsx
```

Expected: `2 passed`

- [ ] **Step 5: Verificar suite completa sin regresiones**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests existentes pasan + 2 nuevos (64 total)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/chat/TypingIndicator.jsx \
        frontend/src/test/TypingIndicator.test.jsx
git commit -m "feat: TypingIndicator — tres puntos animados para estado de escritura de Lumi"
```

---

### Task 2: Pantalla de cierre y uso de TypingIndicator en ChatIA

**Files:**
- Modify: `frontend/src/pages/ChatIA.jsx`
- Modify: `frontend/src/test/ChatIA.test.jsx`

**Interfaces:**
- Consumes (de Task 1):
  - `import { TypingIndicator } from '../components/chat/TypingIndicator'`
  - `<TypingIndicator />` — sin props

- [ ] **Step 1: Modificar ChatIA.test.jsx — ajustar test existente y agregar 2 nuevos**

Abrir `frontend/src/test/ChatIA.test.jsx`.

**Reemplazar el test existente** "al recibir ended:true navega a /inicio" (buscar el bloque exacto y sustituirlo completo):

```jsx
// ANTES — buscar este bloque exacto:
it('al recibir ended:true navega a /inicio', async () => {
  chatApi.sendMessage.mockResolvedValueOnce({
    data: {
      message: '¡Hasta la próxima!',
      options: ['Terminar'],
      lumi_state: 'happy',
      ended: true,
    },
  })
  renderChat()
  await waitFor(() => screen.getByText('Terminar'))
  await userEvent.click(screen.getByText('Terminar'))
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/inicio')
  }, { timeout: 3000 })
})

// DESPUÉS — reemplazar con:
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

**Agregar 2 tests nuevos al final del `describe('ChatIA', () => {` block**, antes del cierre `})`:

```jsx
  it('muestra el indicador de escritura animado mientras Lumi responde', async () => {
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

- [ ] **Step 2: Verificar que los nuevos tests fallan**

```bash
cd frontend && npm test -- --run src/test/ChatIA.test.jsx
```

Expected: los 2 tests nuevos FAIL y el ajustado FAIL; los demás PASS

- [ ] **Step 3: Agregar imports en ChatIA.jsx**

Abrir `frontend/src/pages/ChatIA.jsx`.

El archivo actualmente NO importa `motion` de framer-motion (lo usan los subcomponentes, no la página directamente). Agregar ambos imports nuevos.

Buscar la línea:
```jsx
import { ChatOptions } from '../components/chat/ChatOptions'
```

Agregar inmediatamente después:
```jsx
import { motion } from 'framer-motion'
import { TypingIndicator } from '../components/chat/TypingIndicator'
```

- [ ] **Step 4: Agregar estado `ended`**

En `ChatIA.jsx`, buscar el bloque de estados (líneas ~17-26). Localizar:
```jsx
  const [listening, setListening] = useState(false)
```

Agregar inmediatamente después:
```jsx
  const [ended, setEnded] = useState(false)
```

- [ ] **Step 5: Modificar handleSelect — renombrar variable y reemplazar setTimeout**

En `ChatIA.jsx`, dentro de `handleSelect`, buscar:
```jsx
      const { message, options: newOpts, lumi_state, ended } = res.data
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])
      setLumiState(lumi_state)
      if (ended) {
        setTimeout(() => navigate('/inicio'), 1500)
      } else {
        setOptions(newOpts)
      }
```

Reemplazar con:
```jsx
      const { message, options: newOpts, lumi_state, ended: endedFlag } = res.data
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])
      setLumiState(lumi_state)
      if (endedFlag) {
        setEnded(true)
      } else {
        setOptions(newOpts)
      }
```

- [ ] **Step 6: Agregar render block de pantalla de cierre**

En `ChatIA.jsx`, buscar el bloque de error (al inicio del render, antes del `return` principal):
```jsx
  if (error && messages.length === 0) {
    return (
      ...
    )
  }

  return (
```

Insertar el siguiente bloque ENTRE el bloque de error y el `return` principal:

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

- [ ] **Step 7: Reemplazar indicador de escritura plano**

En `ChatIA.jsx`, buscar:
```jsx
          {sending && (
            <div className="flex justify-start">
              <div className="bg-primary-50 border-2 border-primary-200 rounded-3xl rounded-tl-sm px-5 py-4">
                <p className="text-base text-text-muted">Lumi está escribiendo...</p>
              </div>
            </div>
          )}
```

Reemplazar con:
```jsx
          {sending && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}
```

- [ ] **Step 8: Verificar que los 8 tests de ChatIA pasan**

```bash
cd frontend && npm test -- --run src/test/ChatIA.test.jsx
```

Expected: `8 passed` (6 originales ajustados + 2 nuevos)

- [ ] **Step 9: Verificar suite completa sin regresiones**

```bash
cd frontend && npm test -- --run
```

Expected: todos los tests pasan (64 total: 62 anteriores + 2 de TypingIndicator)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/ChatIA.jsx \
        frontend/src/test/ChatIA.test.jsx
git commit -m "feat: ChatIA — pantalla de cierre con Lumi y TypingIndicator animado"
```
