import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmotionSelector } from '../pages/EmotionSelector'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const MOCK_EMOTIONS = [
  { key: 'feliz',      label: 'Feliz',      emoji: '😊' },
  { key: 'nervioso',   label: 'Nervioso',   emoji: '😰' },
  { key: 'confundido', label: 'Confundido', emoji: '🤔' },
  { key: 'frustrado',  label: 'Frustrado',  emoji: '😤' },
  { key: 'cansado',    label: 'Cansado',    emoji: '😴' },
]

const mockList  = vi.fn().mockResolvedValue({ data: MOCK_EMOTIONS })
const mockLog   = vi.fn().mockResolvedValue({ data: { id: 1, emotion_key: 'feliz' } })
const mockToday = vi.fn().mockResolvedValue({ data: { emotion_key: null } })

vi.mock('../services/api', () => ({
  emotionsApi: {
    list:  () => mockList(),
    log:   (key) => mockLog(key),
    today: () => mockToday(),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

function renderSelector() {
  return render(<MemoryRouter><EmotionSelector /></MemoryRouter>)
}

describe('EmotionSelector — fase selecting (sin emoción previa)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockToday.mockResolvedValue({ data: { emotion_key: null } })
  })

  it('muestra el título y 5 tarjetas de emociones', async () => {
    renderSelector()
    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument()
      expect(screen.getByText('Feliz')).toBeInTheDocument()
      expect(screen.getByText('Nervioso')).toBeInTheDocument()
      expect(screen.getByText('Confundido')).toBeInTheDocument()
      expect(screen.getByText('Frustrado')).toBeInTheDocument()
      expect(screen.getByText('Cansado')).toBeInTheDocument()
    })
  })

  it('después de seleccionar Feliz muestra mensaje de Lumi y 3 sugerencias', async () => {
    renderSelector()
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => {
      expect(screen.getByText(/Qué bueno que te sientes feliz/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Escenarios sociales/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Chat con Lumi/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Mi aventura/i })).toBeInTheDocument()
    })
  })

  it('la sugerencia principal navega a /escenarios al hacer clic', async () => {
    renderSelector()
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => screen.getByRole('button', { name: /Escenarios sociales/i }))
    await userEvent.click(screen.getByRole('button', { name: /Escenarios sociales/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/escenarios')
  })

  it('después de seleccionar Frustrado la primera sugerencia es Zona de calma', async () => {
    renderSelector()
    await waitFor(() => screen.getByText('Frustrado'))
    await userEvent.click(screen.getByText('Frustrado'))
    await waitFor(() => {
      expect(screen.getByText(/Entiendo que estás frustrado/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Zona de calma/i })).toBeInTheDocument()
    })
  })

  it('error en log muestra mensaje y permite reintentar', async () => {
    mockLog.mockRejectedValueOnce(new Error('network'))
    renderSelector()
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => {
      expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument()
    })
    // después del error las tarjetas siguen disponibles
    expect(screen.getByText('Feliz')).toBeInTheDocument()
  })
})

describe('EmotionSelector — fase already_selected (con emoción previa)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockToday.mockResolvedValue({ data: { emotion_key: 'nervioso' } })
  })

  it('muestra mensaje de emoción ya registrada', async () => {
    renderSelector()
    await waitFor(() => {
      expect(screen.getByText(/Ya registraste que te sientes Nervioso hoy/i)).toBeInTheDocument()
    })
  })

  it('botón Ir al inicio navega a /inicio', async () => {
    renderSelector()
    await waitFor(() => screen.getByRole('button', { name: /Ir al inicio/i }))
    await userEvent.click(screen.getByRole('button', { name: /Ir al inicio/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/inicio')
  })

  it('botón Cambiar emoción muestra la grilla de selección', async () => {
    renderSelector()
    await waitFor(() => screen.getByRole('button', { name: /Cambiar emoción/i }))
    await userEvent.click(screen.getByRole('button', { name: /Cambiar emoción/i }))
    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument()
      expect(screen.getByText('Feliz')).toBeInTheDocument()
    })
  })
})
