import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { panelApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function PanelProfesional() {
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    panelApi.listChildren()
      .then((res) => setChildren(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageWrapper className="items-center justify-center">
        <LumiCharacter state="thinking" size={90} />
        <p className="text-base text-text-secondary mt-4">Cargando...</p>
      </PageWrapper>
    )
  }

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
          <h1 className="text-xl font-extrabold text-primary-700">Panel Profesional</h1>
        </div>

        {children.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-10">
            Aún no hay niños registrados en la plataforma.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {children.map((child, i) => (
              <motion.button
                key={child.child_profile_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => navigate(`/panel/ninos/${child.child_profile_id}`)}
                className="
                  w-full flex items-center gap-4 p-5 rounded-3xl text-left
                  bg-calm-surface border-2 border-calm-border
                  hover:border-primary-500 hover:bg-primary-50
                  transition-colors min-h-[72px]
                "
                aria-label={`Ver perfil de ${child.name}`}
              >
                <span className="text-3xl">{child.avatar_emoji}</span>
                <div className="flex-1">
                  <p className="font-bold text-text-primary text-base">{child.name}</p>
                  <p className="text-base text-text-secondary">{child.age} años</p>
                </div>
                <div className="text-right">
                  {child.last_emotion_key && (
                    <p className="text-base text-text-secondary">
                      Hoy: {child.last_emotion_key}
                    </p>
                  )}
                  <p className="text-base text-text-muted">
                    {child.total_chats} chats · {child.total_calm_sessions} calma
                  </p>
                </div>
                <span className="text-text-muted text-xl">›</span>
              </motion.button>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
