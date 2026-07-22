import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TerminosPage } from '../pages/TerminosPage'
import { PrivacidadPage } from '../pages/PrivacidadPage'

describe('TerminosPage', () => {
  it('muestra el título y la cláusula de propiedad intelectual', () => {
    render(<MemoryRouter><TerminosPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /Términos y Condiciones/i })).toBeInTheDocument()
    expect(screen.getByText(/prohibido copiar, reproducir/i)).toBeInTheDocument()
  })

  it('incluye el enlace para volver a SocialMind', () => {
    render(<MemoryRouter><TerminosPage /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Volver a SocialMind/i })).toBeInTheDocument()
  })
})

describe('PrivacidadPage', () => {
  it('muestra el título y menciona el almacenamiento local', () => {
    render(<MemoryRouter><PrivacidadPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /Política de Privacidad/i })).toBeInTheDocument()
    expect(screen.getByText(/almacenamiento local/i)).toBeInTheDocument()
  })
})
