import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TypingIndicator } from '../components/chat/TypingIndicator'

describe('TypingIndicator', () => {
  it('tiene aria-label de accesibilidad', () => {
    render(<TypingIndicator />)
    expect(screen.getByLabelText('Lumi está escribiendo')).toBeInTheDocument()
  })

  it('muestra 3 puntos animados', () => {
    render(<TypingIndicator />)
    const container = screen.getByLabelText('Lumi está escribiendo')
    expect(container.querySelectorAll('span').length).toBe(3)
  })
})
