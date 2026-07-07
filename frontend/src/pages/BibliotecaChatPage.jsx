import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { BibliotecaChat } from '../components/BibliotecaChat'

export function BibliotecaChatPage() {
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const isSpecialist = user?.role === 'specialist'
  const backPath     = isSpecialist ? '/panel' : '/inicio'

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(backPath)}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">
              Consultar Biblioteca
            </h1>
            <p className="text-sm text-text-secondary">
              {isSpecialist
                ? 'Consulta los documentos clínicos subidos a la biblioteca'
                : 'Encuentra información sobre el autismo en los documentos educativos'}
            </p>
          </div>
        </div>

        <BibliotecaChat />
      </div>
    </PageWrapper>
  )
}
