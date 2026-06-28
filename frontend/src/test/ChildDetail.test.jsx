import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ChildDetail } from '../pages/ChildDetail'
import { panelApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ childId: '1' }),
  }
})

vi.mock('../services/api', () => ({
  panelApi: {
    listChildren: vi.fn(),
    getChild: vi.fn(),
    saveNote: vi.fn(),
  },
  authApi:      { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  emotionsApi:  { list: vi.fn(), log: vi.fn(), today: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi:      { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
  calmApi:      { saveSession: vi.fn(), getPhrase: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 2, full_name: 'Dra. García', role: 'specialist' },
    loading: false,
  }),
}))

const mockChild = {
  child_profile_id: 1,
  name: 'Juan',
  age: 10,
  avatar_emoji: '⭐',
  emotions: [
    { emotion_key: 'nervioso', logged_at: '2026-06-17T10:00:00Z' },
  ],
  calm_sessions: [
    {
      activity_type: 'respirar',
      duration_seconds: 40,
      emotion_key: 'nervioso',
      created_at: '2026-06-17T10:05:00Z',
    },
  ],
  conversations: [
    {
      conversation_id: 1,
      emotion_key: 'nervioso',
      started_at: '2026-06-17T10:10:00Z',
      ended_at: null,
      message_count: 2,
      messages: [
        { role: 'assistant', content: '¡Hola, Juan!', created_at: '2026-06-17T10:10:00Z' },
        { role: 'user', content: 'Bien', created_at: '2026-06-17T10:10:30Z' },
      ],
    },
  ],
  specialist_note: 'Nota preexistente.',
  gamification_progress: {
    total_stars: 15,
    current_streak: 2,
    level_key: 'explorador',
    level_name: 'Explorador',
    progress_pct: 30,
    badges_earned: 1,
  },
}

function renderDetail() {
  return render(<MemoryRouter><ChildDetail /></MemoryRouter>)
}

describe('ChildDetail', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    panelApi.getChild.mockResolvedValue({ data: mockChild })
    panelApi.saveNote.mockResolvedValue({
      data: { content: 'Nueva nota.', updated_at: '2026-06-17T11:00:00Z' },
    })
  })

  it('muestra nombre y emoji del niño', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Juan')).toBeInTheDocument()
      expect(screen.getAllByText('⭐').length).toBeGreaterThan(0)
    })
  })

  it('muestra historial de emociones', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Emociones'))
    await userEvent.click(screen.getByText('Emociones'))
    await waitFor(() => {
      expect(screen.getAllByText(/Nervioso/i).length).toBeGreaterThan(0)
    })
  })

  it('muestra sesiones de calma', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Calma'))
    await userEvent.click(screen.getByText('Calma'))
    await waitFor(() => {
      expect(screen.getByText('Respirar')).toBeInTheDocument()
    })
  })

  it('muestra conversaciones expandibles con mensajes', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Conversaciones'))
    await userEvent.click(screen.getByText('Conversaciones'))
    await waitFor(() => screen.getByText(/nervioso/i))
    // Expandir la conversación
    const expandBtn = screen.getByRole('button', { name: /expandir/i })
    await userEvent.click(expandBtn)
    await waitFor(() => {
      expect(screen.getByText('¡Hola, Juan!')).toBeInTheDocument()
      expect(screen.getByText('Bien')).toBeInTheDocument()
    })
  })

  it('guardar nota llama a panelApi.saveNote con el contenido correcto', async () => {
    renderDetail()
    await waitFor(() => screen.getByPlaceholderText(/observaciones/i))
    const textarea = screen.getByPlaceholderText(/observaciones/i)
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'Nueva nota.')
    await userEvent.click(screen.getByRole('button', { name: /guardar nota/i }))
    await waitFor(() => {
      expect(panelApi.saveNote).toHaveBeenCalledWith('1', 'Nueva nota.')
    })
  })

  it('error en carga muestra mensaje de error', async () => {
    panelApi.getChild.mockRejectedValueOnce(new Error('Network'))
    renderDetail()
    await waitFor(() => {
      expect(
        screen.getByText(/no se pudo cargar/i)
      ).toBeInTheDocument()
    })
  })

  it('muestra progreso de gamificación', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Progreso y recompensas')).toBeInTheDocument()
      expect(screen.getByText('Explorador')).toBeInTheDocument()
    })
  })

  it('muestra el gráfico de tendencia emocional encima de los tabs', async () => {
    renderDetail()
    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: /distribución de emociones/i })
      ).toBeInTheDocument()
    })
  })

  it('tab Emociones muestra emoji + label en lugar de clave cruda', async () => {
    renderDetail()
    await waitFor(() => screen.getByText('Emociones'))
    await userEvent.click(screen.getByText('Emociones'))
    await waitFor(() => {
      expect(screen.queryByText('nervioso')).not.toBeInTheDocument()
      expect(screen.getAllByText(/Nervioso/i).length).toBeGreaterThan(0)
    })
  })
})
