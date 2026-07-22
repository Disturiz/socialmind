import { Link } from 'react-router-dom'
import { PageWrapper } from './PageWrapper'
import { Card } from '../ui/Card'

export function LegalDocument({ title, updatedLabel, children }) {
  return (
    <PageWrapper className="items-center px-6 py-12">
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div className="text-center">
          <Link to="/" className="text-sm text-primary-600 hover:underline">
            ← Volver a SocialMind
          </Link>
          <h1 className="text-2xl font-extrabold text-primary-700 mt-3">{title}</h1>
          <p className="text-xs text-text-secondary mt-1">{updatedLabel}</p>
        </div>
        <Card className="flex flex-col gap-6 text-text-primary text-sm leading-relaxed">
          {children}
        </Card>
      </div>
    </PageWrapper>
  )
}
