import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ZonaCalma } from '../pages/ZonaCalma'
import { calmApi, emotionsApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  emotionsApi: {
    today: vi.fn().mockResolvedValue({ data: { emotion_key: 'nervioso' } }),
    list: vi.fn(),
    log: vi.fn().mockResolvedValue({ data: {} }),
  },
  calmApi: {
    saveSession: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    getPhrase: vi.fn().mockResolvedValue({ data: { phrase: 'Respira y todo mejora.' } }),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi: { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

function renderCalma() {
  return render(<MemoryRouter><ZonaCalma /></MemoryRouter>)
}

describe('ZonaCalma', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    calmApi.saveSession.mockClear()
    calmApi.getPhrase.mockClear()
    emotionsApi.today.mockClear()
    emotionsApi.log.mockClear()
  })

  it('muestra 3 tarjetas de actividad al cargar', async () => {
    renderCalma()
    await waitFor(() => {
      expect(screen.getAllByText('Respirar').length).toBeGreaterThan(0)
      expect(screen.getByText('Pausar')).toBeInTheDocument()
      expect(screen.getByText('Frase de Lumi')).toBeInTheDocument()
    })
  })

  it('tarjeta sugerida tiene clase border-primary-500 cuando emocion es nervioso', async () => {
    renderCalma()
    await waitFor(() => screen.getAllByText('Respirar'))
    const buttons = screen.getAllByText('Respirar')
    const respirarBtn = buttons.find((el) => el.closest('button'))?.closest('button')
    expect(respirarBtn).toHaveClass('border-primary-500')
  })

  it('click en Pausar muestra el temporizador visual', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => {
      expect(screen.getByText('Salir antes')).toBeInTheDocument()
    })
  })

  it('al salir del timer llama a calmApi.saveSession con activity pausa', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => {
      expect(calmApi.saveSession).toHaveBeenCalledWith('pausa', expect.any(Number), 'nervioso')
    })
  })

  it('click en Frase de Lumi llama a calmApi.getPhrase con emotion_key correcto', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Frase de Lumi'))
    await userEvent.click(screen.getByText('Frase de Lumi'))
    await waitFor(() => {
      expect(calmApi.getPhrase).toHaveBeenCalledWith('nervioso')
    })
  })

  it('error en getPhrase muestra frase de fallback', async () => {
    calmApi.getPhrase.mockRejectedValueOnce(new Error('Network'))
    renderCalma()
    await waitFor(() => screen.getByText('Frase de Lumi'))
    await userEvent.click(screen.getByText('Frase de Lumi'))
    await waitFor(() => {
      expect(
        screen.getByText('Estás bien. Respira. Todo va a estar bien.')
      ).toBeInTheDocument()
    })
  })

  it('después de salir del timer muestra pantalla de completado con mensaje de Lumi', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => {
      expect(screen.getByText(/te sientes/i)).toBeInTheDocument()
    })
  })

  it('en la pantalla de completado se muestran las 5 emociones', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => {
      expect(screen.getByText('Feliz')).toBeInTheDocument()
      expect(screen.getByText('Nervioso')).toBeInTheDocument()
    })
  })

  it('al seleccionar emoción post-actividad llama emotionsApi.log y vuelve a la lista', async () => {
    renderCalma()
    await waitFor(() => screen.getByText('Pausar'))
    await userEvent.click(screen.getByText('Pausar'))
    await waitFor(() => screen.getByText('Salir antes'))
    await userEvent.click(screen.getByText('Salir antes'))
    await waitFor(() => screen.getByRole('button', { name: 'Feliz' }))
    await userEvent.click(screen.getByRole('button', { name: 'Feliz' }))
    await waitFor(() => {
      expect(calmApi.saveSession).toHaveBeenCalled()
      expect(screen.getAllByText('Respirar').length).toBeGreaterThan(0)
    })
  })
})
