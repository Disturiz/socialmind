import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ScenarioList } from '../pages/ScenarioList'

vi.mock('../services/api', () => ({
  scenariosApi: {
    list: vi.fn(),
  },
}))

import { scenariosApi } from '../services/api'

test('muestra error cuando falla la carga de escenarios', async () => {
  scenariosApi.list.mockRejectedValueOnce(new Error('Network error'))
  render(<MemoryRouter><ScenarioList /></MemoryRouter>)
  await waitFor(() => {
    expect(screen.getByText('No pudimos cargar los escenarios. Intenta de nuevo.')).toBeInTheDocument()
  })
})
