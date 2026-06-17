import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ScenarioFlow } from '../pages/ScenarioFlow'

const MOCK_SCENARIO = {
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
}

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
})
