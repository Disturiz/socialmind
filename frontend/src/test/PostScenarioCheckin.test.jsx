import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PostScenarioCheckin } from '../components/scenarios/PostScenarioCheckin'

vi.mock('../services/api', () => ({
  emotionsApi: { log: vi.fn().mockResolvedValue({}) },
}))

import { emotionsApi } from '../services/api'

const onDone = vi.fn()

beforeEach(() => {
  onDone.mockClear()
  emotionsApi.log.mockClear()
})

function renderCheckin(props = {}) {
  return render(
    <PostScenarioCheckin
      badgeEmoji="🌟"
      scenarioTitle="Saludar"
      onDone={onDone}
      {...props}
    />
  )
}

describe('PostScenarioCheckin', () => {
  it('muestra el badge y el mensaje con el título del escenario', () => {
    renderCheckin()
    expect(screen.getByRole('img', { name: /insignia/i })).toBeInTheDocument()
    expect(screen.getByText(/Completaste «Saludar»/)).toBeInTheDocument()
  })

  it('seleccionar emoción llama emotionsApi.log y onDone', async () => {
    renderCheckin()
    await userEvent.click(screen.getByLabelText('Feliz'))
    await waitFor(() => {
      expect(emotionsApi.log).toHaveBeenCalledWith('feliz')
      expect(onDone).toHaveBeenCalled()
    })
  })

  it('saltar por ahora llama onDone sin registrar emoción', async () => {
    renderCheckin()
    await userEvent.click(screen.getByLabelText('Saltar por ahora'))
    expect(onDone).toHaveBeenCalled()
    expect(emotionsApi.log).not.toHaveBeenCalled()
  })
})
