import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Biblioteca } from '../pages/Biblioteca'
import { bibliotecaApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  bibliotecaApi: {
    list:   vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
  },
  authApi:      { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  emotionsApi:  { list: vi.fn(), log: vi.fn(), today: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi:      { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
  calmApi:      { saveSession: vi.fn(), getPhrase: vi.fn() },
  panelApi:     { listChildren: vi.fn(), getChild: vi.fn(), saveNote: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, full_name: 'Dra. García', role: 'specialist' },
    loading: false,
  }),
}))

const mockDocs = [
  {
    id: 1,
    original_name: 'guia-autismo.pdf',
    file_size_bytes: 204800,
    status: 'ready',
    chunk_count: 12,
    created_at: '2026-06-17T10:00:00Z',
  },
]

function renderBiblioteca() {
  return render(<MemoryRouter><Biblioteca /></MemoryRouter>)
}

describe('Biblioteca', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    bibliotecaApi.list.mockResolvedValue({ data: mockDocs })
    bibliotecaApi.upload.mockResolvedValue({ data: mockDocs[0] })
    bibliotecaApi.delete.mockResolvedValue({})
  })

  it('muestra lista de documentos al cargar', async () => {
    renderBiblioteca()
    await waitFor(() => {
      expect(screen.getByText('guia-autismo.pdf')).toBeInTheDocument()
    })
  })

  it('muestra mensaje si no hay documentos', async () => {
    bibliotecaApi.list.mockResolvedValueOnce({ data: [] })
    renderBiblioteca()
    await waitFor(() => {
      expect(
        screen.getByText('Aún no hay documentos en la biblioteca.')
      ).toBeInTheDocument()
    })
  })

  it('subir archivo llama a bibliotecaApi.upload', async () => {
    renderBiblioteca()
    await waitFor(() => screen.getByText('guia-autismo.pdf'))

    const file = new File(['%PDF-content'], 'nuevo.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(bibliotecaApi.upload).toHaveBeenCalledTimes(1)
    })
  })

  it('eliminar documento llama a bibliotecaApi.delete con id correcto', async () => {
    renderBiblioteca()
    await waitFor(() => screen.getByText('guia-autismo.pdf'))

    await userEvent.click(screen.getByText('Eliminar'))
    await userEvent.click(screen.getByText('Sí, eliminar'))

    await waitFor(() => {
      expect(bibliotecaApi.delete).toHaveBeenCalledWith(1)
    })
  })

  it('error en upload muestra mensaje de error visible', async () => {
    bibliotecaApi.upload.mockRejectedValueOnce(new Error('Network'))
    renderBiblioteca()
    await waitFor(() => screen.getByText('guia-autismo.pdf'))

    const file = new File(['%PDF-content'], 'error.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo subir el documento. Intentá de nuevo.')
      ).toBeInTheDocument()
    })
  })
})
