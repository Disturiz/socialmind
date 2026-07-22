import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LegalFooter } from '../components/layout/LegalFooter'

describe('LegalFooter', () => {
  it('enlaza a /terminos y /privacidad', () => {
    render(<MemoryRouter><LegalFooter /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Términos y Condiciones/i })).toHaveAttribute('href', '/terminos')
    expect(screen.getByRole('link', { name: /Política de Privacidad/i })).toHaveAttribute('href', '/privacidad')
  })
})
