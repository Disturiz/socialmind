import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it } from 'vitest'
import { ScenarioList } from '../pages/ScenarioList'

vi.mock('../services/api', () => ({
  scenariosApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: 1, emoji: '🙋', title: 'Saludar',              description: 'Aprende a saludar',   completed: false },
        { id: 2, emoji: '💬', title: 'Hablar con compañero', description: 'Inicia conversación', completed: true  },
      ],
    }),
  },
}))

import { scenariosApi } from '../services/api'

describe('ScenarioList', () => {
  it('muestra error cuando falla la carga de escenarios', async () => {
    scenariosApi.list.mockRejectedValueOnce(new Error('Network error'))
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('No pudimos cargar los escenarios. Intenta de nuevo.')).toBeInTheDocument()
    })
  })

  it('muestra checkmark y aria-label "Repetir" en escenario completado', async () => {
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByLabelText('Repetir: Hablar con compañero')).toBeInTheDocument()
    })
  })

  it('muestra aria-label "Practicar" en escenario no completado', async () => {
    render(<MemoryRouter><ScenarioList /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByLabelText('Practicar: Saludar')).toBeInTheDocument()
    })
  })
})
