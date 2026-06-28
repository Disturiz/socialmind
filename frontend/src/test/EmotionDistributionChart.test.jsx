import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EmotionDistributionChart } from '../components/panel/EmotionDistributionChart'

const FIXED_NOW = new Date('2026-06-28T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

const emotions = [
  { emotion_key: 'nervioso', logged_at: '2026-06-27T10:00:00Z' }, // dentro — 1 día atrás
  { emotion_key: 'nervioso', logged_at: '2026-06-26T10:00:00Z' }, // dentro — 2 días atrás
  { emotion_key: 'feliz',    logged_at: '2026-06-25T10:00:00Z' }, // dentro — 3 días atrás
  { emotion_key: 'cansado',  logged_at: '2026-06-10T10:00:00Z' }, // fuera — 18 días atrás
]

describe('EmotionDistributionChart', () => {
  it('muestra emociones de los últimos 7 días', () => {
    render(<EmotionDistributionChart emotions={emotions} />)
    expect(screen.getByText(/Nervioso/)).toBeInTheDocument()
    expect(screen.getByText(/Feliz/)).toBeInTheDocument()
  })

  it('no muestra emociones fuera de los 7 días', () => {
    render(<EmotionDistributionChart emotions={emotions} />)
    expect(screen.queryByText(/Cansado/)).not.toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay emociones esta semana', () => {
    render(<EmotionDistributionChart emotions={[]} />)
    expect(screen.getByText('Sin emociones registradas esta semana.')).toBeInTheDocument()
  })

  it('ordena emociones por frecuencia descendente', () => {
    render(<EmotionDistributionChart emotions={emotions} />)
    const rows = screen.getAllByLabelText(/veces/i)
    expect(rows[0]).toHaveAccessibleName(/Nervioso.*2 veces/i)
    expect(rows[1]).toHaveAccessibleName(/Feliz.*1 veces/i)
  })
})
