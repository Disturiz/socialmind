import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { emotionsApi, calmApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { BreathingExercise } from '../components/calma/BreathingExercise'
import { VisualTimer } from '../components/calma/VisualTimer'
import { LumiPhrase } from '../components/calma/LumiPhrase'

function getSuggestion(emotionKey) {
  if (['nervioso', 'frustrado', 'enojado'].includes(emotionKey)) return 'respirar'
  if (['cansado', 'confundido', 'triste'].includes(emotionKey)) return 'pausa'
  return 'frase'
}

const ACTIVITIES = [
  { id: 'respirar', emoji: '🌬️', label: 'Respirar',      desc: 'Respiración guiada suave' },
  { id: 'pausa',    emoji: '⏸️', label: 'Pausar',         desc: '3 minutos de descanso' },
  { id: 'frase',    emoji: '🦉', label: 'Frase de Lumi',  desc: 'Una frase para vos' },
]

export function ZonaCalma() {
  const navigate = useNavigate()
  const [emotionKey, setEmotionKey]         = useState('feliz')
  const [activeActivity, setActiveActivity] = useState(null)
  const [loading, setLoading]               = useState(true)

  useEffect(() => {
    async function loadEmotion() {
      try {
        const res = await emotionsApi.today()
        setEmotionKey(res.data.emotion_key ?? 'feliz')
      } catch {
        // fallback 'feliz' already set
      } finally {
        setLoading(false)
      }
    }
    loadEmotion()
  }, [])

  async function handleComplete(durationSeconds) {
    try {
      await calmApi.saveSession(activeActivity, durationSeconds, emotionKey)
    } catch {
      // session loss is acceptable — don't block the child
    }
    setActiveActivity(null)
  }

  const suggestion = getSuggestion(emotionKey)

  if (loading) {
    return (
      <PageWrapper className="items-center justify-center">
        <LumiCharacter state="thinking" size={90} />
        <p className="text-base text-text-secondary mt-4">Cargando...</p>
      </PageWrapper>
    )
  }

  if (activeActivity) {
    return (
      <PageWrapper className="px-0 py-0">
        <div className="flex flex-col min-h-screen max-w-lg mx-auto w-full">
          <div className="flex items-center gap-4 px-6 py-4 bg-calm-bg border-b border-calm-border shrink-0">
            <button
              onClick={() => setActiveActivity(null)}
              className="text-primary-600 text-base font-bold min-h-[44px] px-2"
              aria-label="Volver a las actividades"
            >
              ← Volver
            </button>
            <LumiCharacter state="happy" size={48} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            {activeActivity === 'respirar' && (
              <BreathingExercise onComplete={handleComplete} />
            )}
            {activeActivity === 'pausa' && (
              <VisualTimer onComplete={handleComplete} />
            )}
            {activeActivity === 'frase' && (
              <LumiPhrase emotionKey={emotionKey} onComplete={handleComplete} />
            )}
          </div>
        </div>
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
          <h1 className="text-xl font-extrabold text-primary-700">Zona de calma</h1>
        </div>

        <div className="flex items-start gap-4 bg-primary-50 border-2 border-primary-200 rounded-3xl p-5">
          <LumiCharacter state="happy" size={64} />
          <p className="text-base text-text-primary leading-relaxed">
            Hoy te sentiste <strong>{emotionKey}</strong>. Te sugiero empezar con la actividad
            destacada con borde azul.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {ACTIVITIES.map((activity, i) => (
            <motion.button
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setActiveActivity(activity.id)}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left min-h-[44px] transition-colors
                ${activity.id === suggestion
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-calm-border bg-white hover:border-primary-300 hover:bg-primary-50'
                }`}
            >
              <span className="text-3xl">{activity.emoji}</span>
              <div>
                <p className="text-base font-bold text-text-primary">{activity.label}</p>
                <p className="text-base text-text-secondary">{activity.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>

      </div>
    </PageWrapper>
  )
}
