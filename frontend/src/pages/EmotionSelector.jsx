import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { emotionsApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

// Mapa estático: las clases Tailwind deben estar aquí para que JIT las incluya en el build
const EMOTION_COLORS = {
  feliz:      'bg-primary-100 border-primary-500',
  nervioso:   'bg-primary-50 border-accent-yellow',
  confundido: 'bg-secondary-100 border-secondary-500',
  frustrado:  'bg-primary-50 border-accent-coral',
  cansado:    'bg-calm-bg border-calm-border',
}

export function EmotionSelector() {
  const navigate = useNavigate()
  const [emotions, setEmotions] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    emotionsApi.list()
      .then(res => setEmotions(res.data))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = async (key) => {
    if (selected) return
    setSelected(key)
    try {
      await emotionsApi.log(key)
    } catch {
      // Si no está autenticado, continúa igual
    }
    setTimeout(() => navigate('/escenarios'), 600)
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-10">
      <div className="max-w-md w-full flex flex-col items-center gap-8">

        <div className="flex flex-col items-center gap-3 text-center">
          <LumiCharacter state="idle" size={90} />
          <h1 className="text-2xl font-extrabold text-primary-700">
            ¿Cómo te sientes hoy?
          </h1>
          <p className="text-sm text-text-secondary">
            Elige la emoción que más se parece a cómo te sientes ahora.
          </p>
        </div>

        {loading ? (
          <p className="text-text-muted text-base">Cargando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 w-full">
            {emotions.map((emotion, i) => (
              <motion.button
                key={emotion.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelect(emotion.key)}
                className={`
                  flex flex-col items-center gap-2 p-5 rounded-3xl border-2
                  min-h-[100px] cursor-pointer transition-all
                  ${EMOTION_COLORS[emotion.key] || 'bg-calm-surface border-calm-border'}
                  ${selected === emotion.key ? 'ring-4 ring-primary-500 ring-offset-2 scale-95' : ''}
                  ${selected && selected !== emotion.key ? 'opacity-40' : ''}
                `}
                aria-label={emotion.label}
                disabled={!!selected}
              >
                <span className="text-5xl leading-none" role="img" aria-hidden="true">
                  {emotion.emoji}
                </span>
                <span className="text-sm font-bold text-text-primary">
                  {emotion.label}
                </span>
              </motion.button>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
