import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { scenariosApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function ScenarioList() {
  const navigate  = useNavigate()
  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const fetchScenarios = () => {
    setLoading(true)
    setError(null)
    scenariosApi.list()
      .then(res => setScenarios(res.data))
      .catch(() => setError('No pudimos cargar los escenarios. Intenta de nuevo.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchScenarios()
  }, [])

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-md mx-auto w-full flex flex-col gap-6">

        <div className="flex items-center gap-4">
          <LumiCharacter state="encouraging" size={70} />
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">
              Escenarios sociales
            </h1>
            <p className="text-base text-text-secondary">
              Elige uno para practicar
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-text-muted text-base text-center py-8">Cargando...</p>
        ) : error ? (
          <div className="flex flex-col gap-4 items-center justify-center py-8">
            <p className="text-base text-accent-coral text-center">{error}</p>
            <button
              onClick={() => fetchScenarios()}
              className="text-base text-primary-600 font-semibold underline min-h-[44px] px-4 py-2 hover:text-primary-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {scenarios.map((scenario, i) => (
              <motion.button
                key={scenario.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/escenarios/${scenario.id}`)}
                className="
                  flex items-center gap-4 p-5 rounded-3xl
                  bg-calm-surface border-2 border-calm-border
                  hover:border-primary-500 hover:bg-primary-50
                  transition-colors text-left w-full min-h-[72px]
                "
                aria-label={`Practicar: ${scenario.title}`}
              >
                <span className="text-4xl leading-none flex-shrink-0" role="img" aria-hidden="true">
                  {scenario.emoji}
                </span>
                <div>
                  <p className="font-bold text-text-primary text-base">{scenario.title}</p>
                  <p className="text-base text-text-muted">{scenario.description}</p>
                </div>
                <span className="ml-auto text-text-muted text-xl">›</span>
              </motion.button>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/inicio')}
          className="text-base text-text-muted underline text-center mt-2 min-h-[44px]"
        >
          Volver al inicio
        </button>

      </div>
    </PageWrapper>
  )
}
