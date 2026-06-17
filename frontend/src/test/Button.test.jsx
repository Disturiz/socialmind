import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../components/ui/Button'

describe('Button', () => {
  it('muestra el texto del botón', () => {
    render(<Button>Comenzar</Button>)
    expect(screen.getByRole('button', { name: 'Comenzar' })).toBeInTheDocument()
  })

  it('llama a onClick cuando se hace clic', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Clic aquí</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('está deshabilitado cuando disabled es true', () => {
    render(<Button disabled>Deshabilitado</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('no llama a onClick cuando está deshabilitado', async () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Deshabilitado</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })
})
