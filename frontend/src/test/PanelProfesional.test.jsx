import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PanelProfesional } from '../pages/PanelProfesional'
import { panelApi, assignmentsApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  panelApi: {
    listChildren: vi.fn(),
    getChild: vi.fn(),
    saveNote: vi.fn(),
  },
  assignmentsApi: { myParents: vi.fn() },
  authApi:     { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  emotionsApi: { list: vi.fn(), log: vi.fn(), today: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi:     { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
  calmApi:     { saveSession: vi.fn(), getPhrase: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, full_name: 'Dra. García', role: 'specialist' },
    loading: false,
  }),
}))

const mockChildren = [
  {
    child_profile_id: 1,
    name: 'Juan',
    age: 10,
    avatar_emoji: '⭐',
    last_emotion_key: 'nervioso',
    total_calm_sessions: 3,
    total_chats: 2,
    total_scenarios_completed: 2,
  },
]

function renderPanel() {
  return render(<MemoryRouter><PanelProfesional /></MemoryRouter>)
}

describe('PanelProfesional', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    panelApi.listChildren.mockResolvedValue({ data: mockChildren })
    assignmentsApi.myParents.mockResolvedValue({ data: [] })
  })

  it('muestra tarjetas de niños al cargar', async () => {
    renderPanel()
    await waitFor(() => {
      expect(screen.getByText('Juan')).toBeInTheDocument()
      expect(screen.getByText('10 años')).toBeInTheDocument()
    })
  })

  it('muestra mensaje si no hay niños', async () => {
    panelApi.listChildren.mockResolvedValueOnce({ data: [] })
    renderPanel()
    await waitFor(() => {
      expect(
        screen.getByText(/Aún no tienes niños asignados/)
      ).toBeInTheDocument()
    })
  })

  it('click en tarjeta navega a /panel/ninos/:id', async () => {
    renderPanel()
    await waitFor(() => screen.getByText('Juan'))
    await userEvent.click(screen.getByText('Juan').closest('button') || screen.getByText('Juan'))
    expect(mockNavigate).toHaveBeenCalledWith('/panel/ninos/1')
  })

  it('muestra emoji + label para last_emotion_key en lugar de clave cruda', async () => {
    renderPanel()
    await waitFor(() => {
      // Case-sensitive: old code showed "nervioso" (lowercase), new shows "Nervioso" (capital N)
      expect(screen.queryByText(/Hoy:.*nervioso/)).not.toBeInTheDocument()
      // Verify emoji appears alongside the label
      expect(screen.getByText(/😰.*Nervioso/)).toBeInTheDocument()
    })
  })

  it('muestra total de escenarios completados en la tarjeta del niño', async () => {
    renderPanel()
    await waitFor(() => {
      expect(screen.getByText(/2 escenarios/)).toBeInTheDocument()
    })
  })
})
