import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { emotionsApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { Button } from '../components/ui/Button'

// Clases Tailwind explícitas para que JIT las incluya en el build
const EMOTION_COLORS = {
  feliz:      'bg-primary-100 border-primary-500',
  nervioso:   'bg-primary-50 border-accent-yellow',
  confundido: 'bg-secondary-100 border-secondary-500',
  frustrado:  'bg-primary-50 border-accent-coral',
  cansado:    'bg-calm-bg border-calm-border',
}

const EMOTION_CONFIG = {
  feliz: {
    lumiState: 'happy',
    lumiMessage: '¡Qué bueno que te sientes feliz hoy! 😊 ¿Qué quieres hacer?',
    alreadyMessage: '¡Ya registraste que te sientes Feliz hoy! 😊',
    suggestions: [
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '⭐ Mi aventura',          path: '/mi-aventura' },
    ],
  },
  nervioso: {
    lumiState: 'encouraging',
    lumiMessage: 'Está bien sentirse nervioso. ¡Estoy aquí contigo! 💙',
    alreadyMessage: '¡Ya registraste que te sientes Nervioso hoy! 😰',
    suggestions: [
      { label: '🧘 Zona de calma',       path: '/calma' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
    ],
  },
  confundido: {
    lumiState: 'thinking',
    lumiMessage: 'No pasa nada si estás confundido. ¡Podemos resolverlo juntos! 🤔',
    alreadyMessage: '¡Ya registraste que te sientes Confundido hoy! 🤔',
    suggestions: [
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
      { label: '🧘 Zona de calma',       path: '/calma' },
    ],
  },
  frustrado: {
    lumiState: 'encouraging',
    lumiMessage: 'Entiendo que estás frustrado. Vamos paso a paso. 💪',
    alreadyMessage: '¡Ya registraste que te sientes Frustrado hoy! 😤',
    suggestions: [
      { label: '🧘 Zona de calma',       path: '/calma' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '🤝 Escenarios sociales', path: '/escenarios' },
    ],
  },
  cansado: {
    lumiState: 'encouraging',
    lumiMessage: 'Está bien descansar. Te acompaño a tu ritmo. 😴',
    alreadyMessage: '¡Ya registraste que te sientes Cansado hoy! 😴',
    suggestions: [
      { label: '🧘 Zona de calma',       path: '/calma' },
      { label: '🦉 Chat con Lumi',       path: '/chat' },
      { label: '⭐ Mi aventura',          path: '/mi-aventura' },
    ],
  },
}

export function EmotionSelector() {
  const navigate = useNavigate()
  const [phase, setPhase]         = useState('checking')
  const [todayEmotion, setToday]  = useState(null)
  const [selected, setSelected]   = useState(null)
  const [emotions, setEmotions]   = useState([])
  const [lumiState, setLumiState] = useState('idle')
  const [error, setError]         = useState(null)

  useEffect(() => {
    Promise.all([emotionsApi.list(), emotionsApi.today()])
      .then(([listRes, todayRes]) => {
        setEmotions(listRes.data)
        const key = todayRes.data.emotion_key
        if (key) {
          setToday(key)
          setLumiState(EMOTION_CONFIG[key]?.lumiState ?? 'idle')
          setPhase('already_selected')
        } else {
          setPhase('selecting')
        }
      })
      .catch(() => setPhase('selecting'))
  }, [])

  async function handleSelect(key) {
    if (selected) return
    setSelected(key)
    setError(null)
    try {
      await emotionsApi.log(key)
      setLumiState(EMOTION_CONFIG[key].lumiState)
      setPhase('selected')
    } catch {
      setError('Algo salió mal. Intenta de nuevo.')
      setSelected(null)
    }
  }

  function handleChange() {
    setToday(null)
    setSelected(null)
    setLumiState('idle')
    setPhase('selecting')
  }

  const activeEmotion = selected ?? todayEmotion
  const config = activeEmotion ? EMOTION_CONFIG[activeEmotion] : null

  return (
    <PageWrapper className="items-center justify-center px-6 py-10">
      <div className="max-w-md w-full flex flex-col items-center gap-8">

        {/* Fase: checking */}
        {phase === 'checking' && (
          <>
            <LumiCharacter state="idle" size={90} />
            <p className="text-text-muted text-base">Cargando...</p>
          </>
        )}

        {/* Fase: already_selected */}
        {phase === 'already_selected' && config && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <LumiCharacter state={lumiState} size={90} />
              <span
                className="text-7xl leading-none"
                role="img"
                aria-label={activeEmotion}
              >
                {emotions.find(e => e.key === activeEmotion)?.emoji ?? '😊'}
              </span>
              <div className="bg-calm-surface rounded-2xl p-4 text-base text-text-primary">
                {config.alreadyMessage}
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button
                variant="primary"
                className="w-full"
                aria-label="Ir al inicio"
                onClick={() => navigate('/inicio')}
              >
                Ir al inicio
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                aria-label="Cambiar emoción"
                onClick={handleChange}
              >
                Cambiar emoción
              </Button>
            </div>
          </>
        )}

        {/* Fase: selecting */}
        {phase === 'selecting' && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <LumiCharacter state="idle" size={90} />
              <h1 className="text-2xl font-extrabold text-primary-700">
                ¿Cómo te sientes hoy?
              </h1>
              <p className="text-base text-text-secondary">
                Elige la emoción que más se parece a cómo te sientes ahora.
              </p>
            </div>

            {error && (
              <p className="text-base text-accent-coral">{error}</p>
            )}

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
                  <span className="text-base font-bold text-text-primary">
                    {emotion.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </>
        )}

        {/* Fase: selected */}
        {phase === 'selected' && config && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <LumiCharacter state={lumiState} size={90} />
              <div className="bg-calm-surface rounded-2xl p-4 text-base text-text-primary">
                {config.lumiMessage}
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              {config.suggestions.map((suggestion, i) => (
                <motion.div
                  key={suggestion.path}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Button
                    variant={i === 0 ? 'primary' : 'secondary'}
                    className="w-full"
                    aria-label={suggestion.label}
                    onClick={() => navigate(suggestion.path)}
                  >
                    {suggestion.label}
                  </Button>
                </motion.div>
              ))}
            </div>
          </>
        )}

      </div>
    </PageWrapper>
  )
}
