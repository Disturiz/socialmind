import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gamificationApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { StarCounter } from '../components/gamification/StarCounter'
import { LevelCard } from '../components/gamification/LevelCard'
import { BadgeGrid } from '../components/gamification/BadgeGrid'
import { Button } from '../components/ui/Button'

export function MiAventura() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    gamificationApi.getProgress()
      .then((res) => setProgress(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageWrapper className="px-6 py-10">
        <p className="text-text-secondary text-base text-center">Cargando tu aventura...</p>
      </PageWrapper>
    )
  }

  if (!progress) {
    return (
      <PageWrapper className="px-6 py-10">
        <div className="max-w-lg mx-auto flex flex-col gap-4 items-center">
          <p className="text-text-secondary text-base">No se pudo cargar el progreso.</p>
          <Button onClick={() => navigate('/inicio')}>Volver al inicio</Button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-extrabold text-primary-700">Mi aventura</h1>
          <p className="text-base text-text-secondary">Tu progreso con Lumi</p>
        </div>

        <StarCounter totalStars={progress.total_stars} currentStreak={progress.current_streak} />

        <LevelCard
          level={progress.level}
          nextLevel={progress.next_level}
          progressPct={progress.progress_pct}
        />

        <BadgeGrid badges={progress.badges} />

        <Button variant="ghost" onClick={() => navigate('/inicio')} className="self-start">
          Volver al inicio
        </Button>
      </div>
    </PageWrapper>
  )
}
