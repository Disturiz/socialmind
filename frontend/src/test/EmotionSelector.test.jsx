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

vi.mock('../services/api', () => ({
  emotionsApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { key: 'feliz',      label: 'Feliz',      emoji: '😊' },
        { key: 'nervioso',   label: 'Nervioso',   emoji: '😰' },
        { key: 'confundido', label: 'Confundido', emoji: '🤔' },
        { key: 'frustrado',  label: 'Frustrado',  emoji: '😤' },
        { key: 'cansado',    label: 'Cansado',    emoji: '😴' },
      ]
    }),
    log: vi.fn().mockResolvedValue({ data: { id: 1, emotion_key: 'feliz' } }),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

describe('EmotionSelector', () => {
  beforeEach(() => { mockNavigate.mockClear() })

  it('muestra el título y 5 tarjetas de emociones', async () => {
    render(<MemoryRouter><EmotionSelector /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument()
      expect(screen.getByText('Feliz')).toBeInTheDocument()
      expect(screen.getByText('Nervioso')).toBeInTheDocument()
      expect(screen.getByText('Confundido')).toBeInTheDocument()
      expect(screen.getByText('Frustrado')).toBeInTheDocument()
      expect(screen.getByText('Cansado')).toBeInTheDocument()
    })
  })

  it('navega a /escenarios al seleccionar una emoción', async () => {
    render(<MemoryRouter><EmotionSelector /></MemoryRouter>)
    await waitFor(() => screen.getByText('Feliz'))
    await userEvent.click(screen.getByText('Feliz'))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/escenarios')
    })
  })
})
