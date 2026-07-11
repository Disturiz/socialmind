// frontend/src/pages/ManageSpecialistsPage.jsx
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { SpecialistAssignments } from '../components/SpecialistAssignments'

export function ManageSpecialistsPage() {
  const { childId } = useParams()
  const navigate    = useNavigate()

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-extrabold text-primary-700">Especialistas del niño</h1>
        </div>
        <SpecialistAssignments childProfileId={parseInt(childId, 10)} />
      </div>
    </PageWrapper>
  )
}
