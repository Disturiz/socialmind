import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ScenarioFlow } from '../pages/ScenarioFlow'
import { scenariosApi } from '../services/api'

vi.mock('../services/api', () => ({
  scenariosApi: {
    get:      vi.fn().mockResolvedValue({ data: {
      id: 1,
      emoji: '🙋',
      title: 'Saludar',
      description: 'Aprende a saludar',
      steps: [
        { type: 'objective',   lumi_state: 'happy',       title: '¿Qué aprenderemos?', text: 'Hoy aprendemos a saludar.' },
        { type: 'explanation', lumi_state: 'thinking',    title: '¿Cómo se hace?',     text: 'Di Hola y tu nombre.' },
        { type: 'practice',    lumi_state: 'thinking',    question: '¿Qué haces?',
          options: [{ text: 'Digo Hola', correct: true }, { text: 'Paso sin decir nada', correct: false }] },
        { type: 'feedback',    lumi_state: 'happy',       title: '¡Muy bien!',         text: 'Saludar es genial.' },
        { type: 'closing',     lumi_state: 'encouraging', title: '¡Lo lograste!',      text: 'Practica hoy.', badge_emoji: '🌟' },
      ],
    }}),
    complete: vi.fn().mockResolvedValue({ data: { id: 1, scenario_id: 1 } }),
    list:     vi.fn(),
  },
  emotionsApi: { list: vi.fn(), log: vi.fn() },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ scenarioId: '1' }) }
})

function renderScenario() {
  return render(
    <MemoryRouter initialEntries={['/escenarios/1']}>
      <Routes>
        <Route path="/escenarios/:scenarioId" element={<ScenarioFlow />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ScenarioFlow', () => {
  beforeEach(() => { mockNavigate.mockClear() })

  it('muestra el primer paso (objective) al cargar', async () => {
    renderScenario()
    await waitFor(() => {
      expect(screen.getByText('¿Qué aprenderemos?')).toBeInTheDocument()
      expect(screen.getByText('Hoy aprendemos a saludar.')).toBeInTheDocument()
    })
  })

  it('avanza al paso siguiente al pulsar Siguiente', async () => {
    renderScenario()
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText('¿Cómo se hace?')).toBeInTheDocument()
    })
  })

  it('muestra las opciones en el paso de práctica', async () => {
    renderScenario()
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => screen.getByText('¿Cómo se hace?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText('¿Qué haces?')).toBeInTheDocument()
      expect(screen.getByText('Digo Hola')).toBeInTheDocument()
    })
  })

  it('seleccionar respuesta incorrecta muestra retroalimentacion alentadora', async () => {
    renderScenario()
    // Navigate to the practice step (step index 2)
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => screen.getByText('¿Cómo se hace?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    await waitFor(() => expect(screen.getByText('Practiquemos')).toBeInTheDocument())

    // Click the incorrect option
    const wrongOption = screen.getByText('Paso sin decir nada')
    await userEvent.click(wrongOption)

    // The encouraging feedback message should appear
    await waitFor(() => {
      expect(screen.getByText(/No pasa nada/i)).toBeInTheDocument()
    })
  })

  it('flujo completo llama a scenariosApi.complete y navega', async () => {
    // Navigation to /escenarios happens via PostScenarioCheckin.onDone —
    // covered by the "muestra la pantalla de check-in post-escenario" test below.
    renderScenario()

    // Step 0: objective
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 1: explanation
    await waitFor(() => screen.getByText('¿Cómo se hace?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 2: practice — click the correct option and wait for the 1000ms setTimeout
    await waitFor(() => screen.getByText('Practiquemos'))
    await userEvent.click(screen.getByText('Digo Hola'))
    // Wait for StepPractice's setTimeout (1000ms) to fire and enable Siguiente
    await waitFor(() => screen.getByRole('button', { name: /siguiente/i }), { timeout: 3000 })
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 3: feedback
    await waitFor(() => screen.getByText('Retroalimentación'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 4: closing — last step, button says ¡Terminar!
    await waitFor(() => screen.getByText('¡Lo lograste!'))
    await userEvent.click(screen.getByRole('button', { name: /terminar/i }))

    await waitFor(() => {
      expect(scenariosApi.complete).toHaveBeenCalledWith(1)
    })
  }, 15000)

  it('al terminar el flujo muestra la pantalla de check-in post-escenario', async () => {
    renderScenario()

    // Step 0: objective
    await waitFor(() => screen.getByText('¿Qué aprenderemos?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 1: explanation
    await waitFor(() => screen.getByText('¿Cómo se hace?'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 2: practice — seleccionar respuesta correcta y esperar timeout
    await waitFor(() => screen.getByText('Practiquemos'))
    await userEvent.click(screen.getByText('Digo Hola'))
    await waitFor(() => screen.getByRole('button', { name: /siguiente/i }), { timeout: 3000 })
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 3: feedback
    await waitFor(() => screen.getByText('Retroalimentación'))
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 4: closing → Terminar
    await waitFor(() => screen.getByText('¡Lo lograste!'))
    await userEvent.click(screen.getByRole('button', { name: /terminar/i }))

    // Debe mostrar el check-in, no navegar a /escenarios todavía
    await waitFor(() => {
      expect(screen.getByText(/Completaste «Saludar»/)).toBeInTheDocument()
      expect(screen.getByLabelText('Feliz')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/escenarios')

    // Al saltar el check-in, navega a /escenarios
    await userEvent.click(screen.getByLabelText('Saltar por ahora'))
    expect(mockNavigate).toHaveBeenCalledWith('/escenarios')
  }, 15000)
})
