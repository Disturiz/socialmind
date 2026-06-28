import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PostActivityCheckin } from '../components/calma/PostActivityCheckin'

vi.mock('../services/api', () => ({
  emotionsApi: {
    log: vi.fn().mockResolvedValue({ data: { id: 1, emotion_key: 'feliz' } }),
  },
  authApi: { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, full_name: 'Test', role: 'parent' }, loading: false }),
}))

describe('PostActivityCheckin', () => {
  it('muestra el mensaje correcto para actividad respirar', () => {
    const onDone = vi.fn()
    render(
      <PostActivityCheckin activityId="respirar" emotionsBefore="nervioso" onDone={onDone} />
    )
    expect(screen.getByText(/Terminaste de respirar/i)).toBeInTheDocument()
  })

  it('muestra las 5 emociones', () => {
    const onDone = vi.fn()
    render(
      <PostActivityCheckin activityId="respirar" emotionsBefore="nervioso" onDone={onDone} />
    )
    expect(screen.getByText('Feliz')).toBeInTheDocument()
    expect(screen.getByText('Nervioso')).toBeInTheDocument()
    expect(screen.getByText('Confundido')).toBeInTheDocument()
    expect(screen.getByText('Frustrado')).toBeInTheDocument()
    expect(screen.getByText('Cansado')).toBeInTheDocument()
  })

  it('al hacer clic en una emoción llama onDone', async () => {
    const onDone = vi.fn()
    render(
      <PostActivityCheckin activityId="pausa" emotionsBefore="cansado" onDone={onDone} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Feliz' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
  })
})
