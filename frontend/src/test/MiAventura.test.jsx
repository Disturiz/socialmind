import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MiAventura } from '../pages/MiAventura'
import * as api from '../services/api'

vi.mock('../services/api', () => ({
  gamificationApi: { getProgress: vi.fn() },
}))

const MOCK_PROGRESS = {
  total_stars: 28,
  current_streak: 3,
  level: { key: 'explorador', name: 'Explorador' },
  next_level: { key: 'aventurero', name: 'Aventurero', min_stars: 50 },
  progress_pct: 56,
  badges: [
    { key: 'primer_paso', name: 'Primer Paso', earned: true },
    { key: 'social_pro',  name: 'Social Pro',  earned: false },
  ],
}

describe('MiAventura', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra spinner mientras carga', () => {
    api.gamificationApi.getProgress.mockReturnValue(new Promise(() => {}))
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    expect(screen.getByText('Cargando tu aventura...')).toBeInTheDocument()
  })

  it('muestra estrellas y nivel cuando carga', async () => {
    api.gamificationApi.getProgress.mockResolvedValue({ data: MOCK_PROGRESS })
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('28')).toBeInTheDocument()
      expect(screen.getByText('Explorador')).toBeInTheDocument()
    })
  })

  it('muestra racha correctamente', async () => {
    api.gamificationApi.getProgress.mockResolvedValue({ data: MOCK_PROGRESS })
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('muestra insignia ganada y bloqueada', async () => {
    api.gamificationApi.getProgress.mockResolvedValue({ data: MOCK_PROGRESS })
    render(<MemoryRouter><MiAventura /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Primer Paso')).toBeInTheDocument()
      expect(screen.getByText('Social Pro')).toBeInTheDocument()
    })
  })
})
