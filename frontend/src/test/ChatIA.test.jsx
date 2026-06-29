import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ChatIA } from '../pages/ChatIA'
import { chatApi, emotionsApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  emotionsApi: {
    today: vi.fn().mockResolvedValue({ data: { emotion_key: 'nervioso' } }),
    list: vi.fn(),
    log: vi.fn(),
  },
  chatApi: {
    start: vi.fn().mockResolvedValue({
      data: {
        conversation_id: 1,
        message: 'Hola, veo que hoy te sentiste nervioso.',
        options: ['Sí, quiero hablar', 'No mucho', 'Otro tema', 'Terminar'],
        lumi_state: 'happy',
      },
    }),
    sendMessage: vi.fn().mockResolvedValue({
      data: {
        message: '¡Gracias por contarme!',
        options: ['Cuéntame más', 'Está bien', 'Terminar'],
        lumi_state: 'encouraging',
        ended: false,
      },
    }),
    getHistory: vi.fn(),
    getConversation: vi.fn(),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

function renderChat() {
  return render(<MemoryRouter><ChatIA /></MemoryRouter>)
}

describe('ChatIA', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    chatApi.start.mockClear()
    chatApi.sendMessage.mockClear()
    emotionsApi.today.mockClear()
  })

  it('muestra el primer mensaje de Lumi al cargar', async () => {
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('Hola, veo que hoy te sentiste nervioso.')).toBeInTheDocument()
    })
  })

  it('muestra los botones de opciones iniciales', async () => {
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('Sí, quiero hablar')).toBeInTheDocument()
      expect(screen.getByText('Terminar')).toBeInTheDocument()
    })
  })

  it('al tocar una opción llama a chatApi.sendMessage con el texto del botón', async () => {
    renderChat()
    await waitFor(() => screen.getByText('Sí, quiero hablar'))
    await userEvent.click(screen.getByText('Sí, quiero hablar'))
    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith(1, 'Sí, quiero hablar')
    })
  })

  it('muestra la respuesta de Lumi después de seleccionar una opción', async () => {
    renderChat()
    await waitFor(() => screen.getByText('Sí, quiero hablar'))
    await userEvent.click(screen.getByText('Sí, quiero hablar'))
    await waitFor(() => {
      expect(screen.getByText('¡Gracias por contarme!')).toBeInTheDocument()
    })
  })

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

  it('error de red muestra mensaje de reintento en español', async () => {
    chatApi.start.mockRejectedValueOnce(new Error('Network Error'))
    renderChat()
    await waitFor(() => {
      expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
    })
  })

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
})
