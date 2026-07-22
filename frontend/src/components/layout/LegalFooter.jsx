import { Link } from 'react-router-dom'

export function LegalFooter() {
  return (
    <footer className="flex items-center justify-center gap-3 text-xs text-text-secondary mt-6">
      <Link to="/terminos" className="hover:underline">Términos y Condiciones</Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacidad" className="hover:underline">Política de Privacidad</Link>
    </footer>
  )
}
