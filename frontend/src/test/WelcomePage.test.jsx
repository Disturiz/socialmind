// frontend/src/test/WelcomePage.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { WelcomePage } from '../pages/WelcomePage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGetMe = vi.fn().mockResolvedValue({ data: { child: { name: 'Sofía' } } })
vi.mock('../services/api', () => ({
  profilesApi: { getMe: () => mockGetMe() },
}))

function renderPage() {
  return render(<MemoryRouter><WelcomePage /></MemoryRouter>)
}

describe('WelcomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockGetMe.mockResolvedValue({ data: { child: { name: 'Sofía' } } })
  })

  it('muestra el paso 1 con el nombre del niño', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/¡Hola, Sofía!/i)).toBeInTheDocument()
    })
  })

  it('avanza al paso 2 al hacer clic en Siguiente', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText(/aprender juntos/i)).toBeInTheDocument()
    })
  })

  it('en el paso 3 muestra el botón final en lugar de Siguiente', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Vamos a explorar/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Siguiente/i })).not.toBeInTheDocument()
    })
  })

  it('el botón final navega a /inicio', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await waitFor(() => screen.getByRole('button', { name: /Vamos a explorar/i }))
    await userEvent.click(screen.getByRole('button', { name: /Vamos a explorar/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/inicio')
  })

  it('si getMe falla, muestra el paso 1 sin nombre específico', async () => {
    mockGetMe.mockRejectedValueOnce(new Error('network'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/¡Hola!/i)).toBeInTheDocument()
    })
  })
})
